import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface ChannelSummary {
  id: string;
  type: "center_trainers" | "all_staff" | "dm";
  name: string;
}

export interface Coworker {
  id: string;
  full_name: string;
  role: "trainer" | "admin";
}

export async function getInitialStaffChatData(profileId: string): Promise<{
  channels: ChannelSummary[];
  coworkers: Coworker[];
}> {
  const supabase = await createClient();

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
      const order = { center_trainers: 0, all_staff: 1, dm: 2 };
      return order[a.type] - order[b.type] || a.name.localeCompare(b.name);
    });

  const { data: profile } = await supabase
    .from("profiles")
    .select("center_id")
    .eq("id", profileId)
    .maybeSingle();

  const { data: coworkerRows } = profile
    ? await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("center_id", profile.center_id)
        .in("role", ["trainer", "admin"])
        .neq("id", profileId)
        .order("full_name")
    : { data: [] };

  const coworkers: Coworker[] = (coworkerRows ?? []).map((c) => ({
    id: c.id,
    full_name: c.full_name,
    role: c.role as "trainer" | "admin",
  }));

  return { channels: summaries, coworkers };
}
