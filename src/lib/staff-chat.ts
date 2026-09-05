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
// The retention sweep itself now runs in the database, hourly (migration
// 0271, pg_cron "staff-chat-retention-sweep"). It used to fire from here on
// EVERY hub page load for every tutor -- two lookups and a delete per
// distinct retention value, per request -- and stale messages were only
// ever cleared when somebody happened to open a page (perf audit, 5 Sep
// 2026).

export type RetentionLabel = "nightly" | "days" | "course" | "permanent";

function resolveRetention(
  courseId: string | null,
  retentionByCourseId: Map<string, { chat_retention_days: number | null; chat_retention_mode: string }>
): { days: number | null; label: RetentionLabel } {
  if (!courseId) return { days: 1, label: "nightly" };
  const course = retentionByCourseId.get(courseId);
  if (course?.chat_retention_mode === "course") return { days: null, label: "course" };
  const days = course?.chat_retention_days ?? 1;
  return { days, label: days === 1 ? "nightly" : "days" };
}

export interface ChannelSummary {
  id: string;
  type: "center_trainers" | "all_staff" | "tp_group" | "dm" | "course_admin" | "centre_admin";
  name: string;
  // Resolved per channel from its own course (migration 0154) -- a
  // centre-wide channel (no course_id) always reads 1. null only for
  // "course" mode (migration 0174), where there's no rolling cutoff to
  // report -- retentionLabel is what the bar should actually say.
  retentionDays: number | null;
  retentionLabel: RetentionLabel;
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

  // Ramy, 28 Aug 2026: "no project if we don't fix this." This function ran
  // up to 7 real sequential round trips. Two were the same `profiles` row
  // fetched twice (once for cleanup's center_id, again later for
  // course_id/role) -- merged into one. deleteStaleStaffMessages is a
  // centre-wide cleanup sweep (its own multi-query scan+delete) whose
  // result nothing here ever uses (`Promise<void>`, called purely for the
  // side effect) -- it was blocking the ENTIRE page response regardless.
  // Fired without awaiting instead: stale messages get swept by the next
  // load instead of gating this one.
  // Perf audit 5 Sep 2026: four waves became two. Membership, channel and
  // the channel's course retention come back in ONE embedded read (the
  // foreign keys staff_channel_members.channel_id -> staff_channels and
  // staff_channels.course_id -> courses carry the join), so the channel
  // lookup and the retention lookup no longer wait on each other.
  const [{ data: profile }, { data: membershipRows }] = await Promise.all([
    supabase.from("profiles").select("center_id, course_id, role").eq("id", profileId).maybeSingle(),
    supabase
      .from("staff_channel_members")
      .select("channel_id, staff_channels(*, courses(id, chat_retention_days, chat_retention_mode))")
      .eq("profile_id", profileId),
  ]);
  type ChannelRow = Database["public"]["Tables"]["staff_channels"]["Row"] & {
    courses: { id: string; chat_retention_days: number | null; chat_retention_mode: string } | null;
  };
  const channels: ChannelRow[] = (membershipRows ?? [])
    .map((m) => (m as unknown as { staff_channels: ChannelRow | null }).staff_channels)
    .filter((c): c is ChannelRow => Boolean(c));

  // Who this person may start a conversation with.
  //
  // An ADMIN may message other admins, and nobody on a course. Ramy,
  // 2026-08-16: "they can only message people from the centre admin, but not
  // course tutors." A TRAINER may message registered trainers on the same
  // course -- "you cannot be on the course unless registered as one of the
  // trainers on the course," no admin exception, ever (migration 0039).
  const isAdmin = profile?.role === "admin";
  const dmChannelIds = channels.filter((c) => c.type === "dm").map((c) => c.id);

  // Wave 2: the DM partners (with their names embedded) and the coworker
  // list, together.
  const [{ data: dmOtherMembers }, { data: coworkerRows }] = await Promise.all([
    dmChannelIds.length > 0
      ? supabase.from("staff_channel_members").select("channel_id, profile_id, profiles(full_name)").in("channel_id", dmChannelIds).neq("profile_id", profileId)
      : Promise.resolve({ data: [] as { channel_id: string; profile_id: string; profiles: { full_name: string } | null }[] }),
    isAdmin
      ? profile?.center_id
        ? supabase.from("profiles").select("id, full_name").eq("center_id", profile.center_id).eq("role", "admin").neq("id", profileId).order("full_name")
        : Promise.resolve({ data: [] as { id: string; full_name: string }[] })
      : profile?.course_id
        ? supabase.from("profiles").select("id, full_name").eq("course_id", profile.course_id).eq("role", "trainer").neq("id", profileId).order("full_name")
        : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);
  const retentionByCourseId = new Map(channels.filter((c) => c.courses).map((c) => [c.courses!.id, c.courses!]));
  const otherProfiles = (dmOtherMembers ?? []).map((m) => ({ id: m.profile_id, full_name: (m as { profiles?: { full_name: string } | null }).profiles?.full_name ?? "Unknown" }));

  const nameByProfileId = new Map((otherProfiles ?? []).map((p) => [p.id, p.full_name]));
  const dmNameByChannelId = new Map(
    (dmOtherMembers ?? []).map((m) => [m.channel_id, nameByProfileId.get(m.profile_id) ?? "Unknown"])
  );

  const summaries: ChannelSummary[] = channels
    .map((c) => {
      const retention = resolveRetention(c.course_id, retentionByCourseId);
      return {
        id: c.id,
        type: c.type,
        name: c.type === "dm" ? (dmNameByChannelId.get(c.id) ?? "Direct message") : (c.name ?? ""),
        retentionDays: retention.days,
        retentionLabel: retention.label,
      };
    })
    .sort((a, b) => {
      // course_admin never actually appears here in practice -- admins are
      // never added to trainer-only channels and vice versa (see
      // src/lib/admin-chat.ts for the separate admin-facing fetch) -- but
      // the type includes it, so this map needs to stay exhaustive.
      const order = { center_trainers: 0, all_staff: 0, tp_group: 0, course_admin: 0, centre_admin: 0, dm: 1 };
      return order[a.type] - order[b.type] || a.name.localeCompare(b.name);
    });

  const coworkers: Coworker[] = (coworkerRows ?? []).map((c) => ({
    id: c.id,
    full_name: c.full_name,
    role: isAdmin ? "admin" : "trainer",
  }));

  return { channels: summaries, coworkers };
}
