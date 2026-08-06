import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// Ramy, 2026-08-06: "all chats will reset at midnight and be deleted...
// we don't wanna clutter our system" -- matches the existing "informal
// venting, nothing important lives there" purpose (see
// feedback_staff_chat_design memory). No new migration/table needed --
// the admin client (service role, bypasses RLS) can just delete straight
// out of the existing staff_messages table. Local server midnight, not
// per-user timezone -- there's no stored timezone to key off, and this is
// a "keep things tidy" cleanup, not a precision guarantee. Called from
// getInitialStaffChatData below so it runs on every chat-enabled page
// load rather than needing a real cron job this environment can't run
// anyway (no deploy, no pg_cron access confirmed this session).
async function deleteStaleStaffMessages(): Promise<void> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const admin = createAdminClient();
  await admin.from("staff_messages").delete().lt("created_at", startOfToday.toISOString());
}

export interface ChannelSummary {
  id: string;
  type: "center_trainers" | "all_staff" | "tp_group" | "dm";
  name: string;
}

export interface Coworker {
  id: string;
  full_name: string;
  role: "trainer";
}

// `client` defaults to the normal RLS-scoped session client, which reads
// as WHOEVER is actually logged in -- correct for a profile fetching their
// own data. It's an explicit param (not always createClient()) so a staff
// "preview as this trainee" caller can pass an admin client instead: RLS
// only lets a member read a channel's OWN membership rows, so staff asking
// for a trainee's channels under their own session silently gets back
// nothing (confirmed live) -- not a bug, just RLS correctly refusing to
// let staff read a channel they're not in. An admin client is the
// deliberate, narrow bypass for that one legitimate preview case.
export async function getInitialStaffChatData(
  profileId: string,
  client?: SupabaseClient<Database>
): Promise<{
  channels: ChannelSummary[];
  coworkers: Coworker[];
}> {
  const supabase = client ?? (await createClient());

  await deleteStaleStaffMessages();

  const { data: memberships } = await supabase
    .from("staff_channel_members")
    .select("channel_id")
    .eq("profile_id", profileId);

  const channelIds = (memberships ?? []).map((m) => m.channel_id);
  if (channelIds.length === 0) {
    return { channels: [], coworkers: [] };
  }

  const { data: channels } = await supabase
    .from("staff_channels")
    .select("*")
    .in("id", channelIds);

  const dmChannelIds = (channels ?? []).filter((c) => c.type === "dm").map((c) => c.id);

  let dmOtherMembers: { channel_id: string; profile_id: string }[] = [];
  if (dmChannelIds.length > 0) {
    const { data } = await supabase
      .from("staff_channel_members")
      .select("channel_id, profile_id")
      .in("channel_id", dmChannelIds)
      .neq("profile_id", profileId);
    dmOtherMembers = data ?? [];
  }

  const otherProfileIds = dmOtherMembers.map((m) => m.profile_id);
  const { data: otherProfiles } =
    otherProfileIds.length > 0
      ? await supabase.from("profiles").select("id, full_name").in("id", otherProfileIds)
      : { data: [] };

  const nameByProfileId = new Map((otherProfiles ?? []).map((p) => [p.id, p.full_name]));
  const dmNameByChannelId = new Map(
    dmOtherMembers.map((m) => [m.channel_id, nameByProfileId.get(m.profile_id) ?? "Unknown"])
  );

  const summaries: ChannelSummary[] = (channels ?? [])
    .map((c) => ({
      id: c.id,
      type: c.type,
      name: c.type === "dm" ? (dmNameByChannelId.get(c.id) ?? "Direct message") : (c.name ?? ""),
    }))
    .sort((a, b) => {
      const order = { center_trainers: 0, all_staff: 0, tp_group: 0, dm: 1 };
      return order[a.type] - order[b.type] || a.name.localeCompare(b.name);
    });

  const { data: profile } = await supabase
    .from("profiles")
    .select("course_id")
    .eq("id", profileId)
    .maybeSingle();

  // Only registered trainers on the SAME course -- "you cannot be on the
  // course unless registered as one of the trainers on the course," no
  // admin exception, ever (see migration 0039).
  const { data: coworkerRows } = profile?.course_id
    ? await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("course_id", profile.course_id)
        .eq("role", "trainer")
        .neq("id", profileId)
        .order("full_name")
    : { data: [] };

  const coworkers: Coworker[] = (coworkerRows ?? []).map((c) => ({
    id: c.id,
    full_name: c.full_name,
    role: "trainer",
  }));

  return { channels: summaries, coworkers };
}
