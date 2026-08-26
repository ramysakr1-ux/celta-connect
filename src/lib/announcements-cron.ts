import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { toLocalIso, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";
import { getCachedCenter } from "@/lib/supabase/cached-queries";

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

// connect-spec-corrections-for-claude-code.md item 4: priority ranking when
// several routine announcements are eligible the same day, highest wins.
// 1 (lesson plan reminders) and 3 (observation task reminders) are
// reserved -- no such capped reminder exists in the catalog to rank yet;
// they'll slot in correctly the day one does. Categories that fire
// instantly at creation (TP round released, Stage 2/3 booking sheets) never
// enter this pool at all (their own insert already sets sent_at), so they
// need no entry here -- they're structurally exempt already.
function categoryRank(sourceKey: string | null): number {
  if (sourceKey?.startsWith("deadline:")) return 2; // assignment deadline reminders
  if (sourceKey === "stage1_tutorial") return 4; // booking windows (Stage 1/2/3 tutorial slots)
  if (sourceKey === "assessor_visit") return 5; // assessor-visit heads-up
  if (sourceKey === "final_day") return 6; // final-day reminder
  return 7; // tutor-typed broadcasts/group messages, or anything unrecognised
}

interface PendingRow {
  id: string;
  anchor_event_id: string | null;
  anchor_offset_days: number | null;
  source_key: string | null;
  course_id: string;
  visible_to_trainee_id: string | null;
  visible_to_tp_group_id: string | null;
  visible_to_subgroup_id: string | null;
}

// The narrowest granularity course_broadcasts can actually enforce a cap
// at: firing is one flag per row, not per-viewer, so "one message a day"
// is capped within an exact visibility target (course-wide / one tp_group
// / one subgroup / one trainee), not truly per-candidate. A genuine
// cross-scope collision (a course-wide reminder landing the same day as
// one candidate's own individual reminder) isn't caught here -- there's no
// per-viewer read state in this data model to catch it with.
function scopeKey(row: PendingRow): string {
  return `${row.course_id}|${row.visible_to_trainee_id ?? ""}|${row.visible_to_tp_group_id ?? ""}|${row.visible_to_subgroup_id ?? ""}`;
}

// for-claude-code-trainer-remaining-screens.md's Announcements screen:
// "Scheduled ... announcements written once and fired automatically by
// the timetable." Runs daily, bundled into the existing admissions-
// waiting-list cron slot -- the Hobby plan's 2-cron/day cap is already
// spent by course-close-out-wipe + that route (see its own comment).
export async function runAnnouncementsFireCron(): Promise<{ fired: number; deferred: number; dropped: number }> {
  const supabase = createAdminClient();

  const { data: pending } = await supabase
    .from("course_broadcasts")
    .select("id, anchor_event_id, anchor_offset_days, source_key, course_id, visible_to_trainee_id, visible_to_tp_group_id, visible_to_subgroup_id")
    .is("sent_at", null)
    .is("held_at", null)
    .not("anchor_event_id", "is", null);

  const anchorEventIds = [...new Set((pending ?? []).map((p) => p.anchor_event_id).filter((id): id is string => !!id))];
  const { data: anchorEvents } =
    anchorEventIds.length > 0
      ? await supabase.from("course_timetable_events").select("id, event_date").in("id", anchorEventIds)
      : { data: [] };
  const eventDateById = new Map((anchorEvents ?? []).map((e) => [e.id, e.event_date]));

  // "Today" depends on each row's own course's centre -- a single cron run
  // can span centres in different timezones.
  const courseIds = [...new Set((pending ?? []).map((p) => p.course_id))];
  const { data: coursesForBroadcasts } = courseIds.length > 0 ? await supabase.from("courses").select("id, center_id").in("id", courseIds) : { data: [] };
  const centerIdByCourseId = new Map((coursesForBroadcasts ?? []).map((c) => [c.id, c.center_id]));
  const centerIds = [...new Set([...centerIdByCourseId.values()])];
  const centers = await Promise.all(centerIds.map((id) => getCachedCenter(id)));
  const timezoneByCenterId = new Map(centers.filter((c) => c !== null).map((c) => [c.id, c.time_zone]));
  const todayForCourseId = (courseId: string) => {
    const centerId = centerIdByCourseId.get(courseId);
    const timeZone = (centerId ? timezoneByCenterId.get(centerId) : null) ?? DEFAULT_TIMEZONE;
    return toLocalIso(new Date(), timeZone);
  };

  // Due today, or carried forward from a day it lost the day's slot on --
  // <= today already gives that for free, no separate bookkeeping needed.
  const due = (pending ?? []).filter((row) => {
    const eventDate = row.anchor_event_id ? eventDateById.get(row.anchor_event_id) : null;
    if (!eventDate || row.anchor_offset_days === null) return false;
    return addDays(eventDate, row.anchor_offset_days) <= todayForCourseId(row.course_id);
  });

  // "A message stops the moment its subject's state changes" -- a
  // carried-forward deadline reminder (anchored at due_date - 1) that's
  // now past the actual due date itself would read as "due tomorrow" on
  // something already overdue. Dropped outright, never posted late --
  // checked before ranking, not just on whichever loses the day's slot.
  const dropIds: string[] = [];
  const eligible = due.filter((row) => {
    if (!row.source_key?.startsWith("deadline:")) return true;
    const eventDate = row.anchor_event_id ? eventDateById.get(row.anchor_event_id) : null;
    if (eventDate && todayForCourseId(row.course_id) > eventDate) {
      dropIds.push(row.id);
      return false;
    }
    return true;
  });

  const byScope = new Map<string, PendingRow[]>();
  for (const row of eligible) {
    const key = scopeKey(row);
    const list = byScope.get(key) ?? [];
    list.push(row);
    byScope.set(key, list);
  }

  const fireIds: string[] = [];
  let deferred = 0;
  for (const rows of byScope.values()) {
    const winner = [...rows].sort((a, b) => categoryRank(a.source_key) - categoryRank(b.source_key))[0];
    fireIds.push(winner.id);
    deferred += rows.length - 1;
  }

  if (fireIds.length > 0) {
    await supabase.from("course_broadcasts").update({ sent_at: new Date().toISOString() }).in("id", fireIds);
  }
  if (dropIds.length > 0) {
    // Never shown to anyone (sent_at was always null) -- equivalent to
    // never having existed, so deleted rather than kept around unsent
    // forever with nothing left to check it against.
    await supabase.from("course_broadcasts").delete().in("id", dropIds);
  }

  return { fired: fireIds.length, deferred, dropped: dropIds.length };
}
