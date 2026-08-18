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
// out of the existing staff_messages table. Called from
// getInitialStaffChatData below so it runs on every chat-enabled page
// load rather than needing a real cron job this environment can't run
// anyway (no deploy, no pg_cron access confirmed this session).
//
// 2026-08-14: retention is a real setting instead of a hardcoded "since
// local server midnight" cutoff -- a genuine rolling N-day window measured
// from now, not a fixed calendar cadence, so it can't wipe mid-cycle on a
// part-time course spread over months.
//
// 2026-08-18: moved from centers.chat_retention_days to courses --
// "chat retention lives in Course Admin, configured by the MCT per
// course." Resolved per channel via its own course_id, not one blanket
// cutoff for the whole centre: a tp_group/course_admin channel uses ITS
// course's setting, and a centre-wide channel (all_staff, dm -- no course
// to own the setting) keeps the fixed 1-day default every channel already
// fell back to before this setting existed.
//
// centre_admin is the one exception, not a default at all -- for-claude-
// code-centre-settings.md: "Permanent -- does not reset. Unlike the
// trainer/course chat... this admin channel stores its history
// indefinitely." Excluded from the sweep entirely, never just given a
// long retention number.
async function deleteStaleStaffMessages(centerId: string): Promise<void> {
  const admin = createAdminClient();

  const { data: channels } = await admin
    .from("staff_channels")
    .select("id, course_id")
    .eq("center_id", centerId)
    .neq("type", "centre_admin");
  if (!channels || channels.length === 0) return;

  const courseIds = [...new Set(channels.map((c) => c.course_id).filter((id): id is string => !!id))];
  const { data: courses } =
    courseIds.length > 0 ? await admin.from("courses").select("id, chat_retention_days").in("id", courseIds) : { data: [] };
  const retentionByCourseId = new Map((courses ?? []).map((c) => [c.id, c.chat_retention_days ?? 1]));

  const channelIdsByRetention = new Map<number, string[]>();
  for (const channel of channels) {
    const days = channel.course_id ? (retentionByCourseId.get(channel.course_id) ?? 1) : 1;
    const list = channelIdsByRetention.get(days) ?? [];
    list.push(channel.id);
    channelIdsByRetention.set(days, list);
  }

  for (const [days, channelIds] of channelIdsByRetention) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    await admin.from("staff_messages").delete().in("channel_id", channelIds).lt("created_at", cutoff.toISOString());
  }
}

function resolveRetentionDays(courseId: string | null, retentionByCourseId: Map<string, number>): number {
  return courseId ? (retentionByCourseId.get(courseId) ?? 1) : 1;
}

export interface ChannelSummary {
  id: string;
  type: "center_trainers" | "all_staff" | "tp_group" | "dm" | "course_admin" | "centre_admin";
  name: string;
  // Resolved per channel from its own course (migration 0154) -- a
  // centre-wide channel (no course_id) always reads 1.
  retentionDays: number;
}

export interface Coworker {
  id: string;
  full_name: string;
  /**
   * Who the viewer is allowed to reach: another admin, or a trainer on their
   * own course. Never both -- an admin's list contains admins only, so no
   * course tutor is ever reachable from the admin side.
   */
  role: "trainer" | "admin";
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

  const { data: profileForCleanup } = await supabase.from("profiles").select("center_id").eq("id", profileId).maybeSingle();
  if (profileForCleanup?.center_id) {
    await deleteStaleStaffMessages(profileForCleanup.center_id);
  }

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

  const channelCourseIds = [...new Set((channels ?? []).map((c) => c.course_id).filter((id): id is string => !!id))];
  const { data: channelCourses } =
    channelCourseIds.length > 0 ? await supabase.from("courses").select("id, chat_retention_days").in("id", channelCourseIds) : { data: [] };
  const retentionByCourseId = new Map((channelCourses ?? []).map((c) => [c.id, c.chat_retention_days ?? 1]));

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
      retentionDays: resolveRetentionDays(c.course_id, retentionByCourseId),
    }))
    .sort((a, b) => {
      // course_admin never actually appears here in practice -- admins are
      // never added to trainer-only channels and vice versa (see
      // src/lib/admin-chat.ts for the separate admin-facing fetch) -- but
      // the type includes it, so this map needs to stay exhaustive.
      const order = { center_trainers: 0, all_staff: 0, tp_group: 0, course_admin: 0, centre_admin: 0, dm: 1 };
      return order[a.type] - order[b.type] || a.name.localeCompare(b.name);
    });

  const { data: profile } = await supabase
    .from("profiles")
    .select("course_id, center_id, role")
    .eq("id", profileId)
    .maybeSingle();

  // Who this person may start a conversation with.
  //
  // An ADMIN may message other admins, and nobody on a course. Ramy,
  // 2026-08-16: "they can only message people from the centre admin, but not
  // course tutors." Previously this read "trainers on the same course" for
  // everyone, so an admin who happened to have a course_id was offered that
  // course's tutors -- the exact thing the trainer-only rule exists to
  // prevent, and it would have looked like a feature rather than a leak.
  //
  // A TRAINER may message registered trainers on the same course -- "you
  // cannot be on the course unless registered as one of the trainers on the
  // course," no admin exception, ever (migration 0039).
  const isAdmin = profile?.role === "admin";

  const { data: coworkerRows } = isAdmin
    ? profile?.center_id
      ? await supabase
          .from("profiles")
          .select("id, full_name")
          .eq("center_id", profile.center_id)
          .eq("role", "admin")
          .neq("id", profileId)
          .order("full_name")
      : { data: [] }
    : profile?.course_id
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
    role: isAdmin ? "admin" : "trainer",
  }));

  return { channels: summaries, coworkers };
}
