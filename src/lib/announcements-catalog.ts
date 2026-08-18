import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { ASSIGNMENT_INFO } from "@/lib/assignment-info";

type AssignmentType = Database["public"]["Tables"]["assignments"]["Row"]["assignment_type"];

// for-claude-code-announcements-list.md table A: "fire automatically the
// moment the timetable is published." Called from setTimetableLock() on
// lock (not unlock). Idempotent via source_key (migration 0095) -- re-
// locking a timetable, or locking after an edit, never duplicates an
// already-generated announcement; it only adds ones for genuinely new
// anchors.
//
// Two of table A's six rows aren't generated here, deliberately:
// - "TP round released" isn't timetable-date-driven at all in this app --
//   rounds are released by trainer action (Rotation's "Release round N"),
//   so that's a system-event hook in rotation/actions.ts instead, not a
//   timetable-lock-time scan.
// - "Stage 1/3 tutorial window opens": only "Stage 1 tutorials begin"
//   exists as a real skeleton milestone (timetable-skeleton.ts) -- there is
//   no equivalent Stage 3 milestone, because Stage 3 is conditional per-
//   candidate (celta5_records.stage3_required), not a whole-cohort date.
//   Stage 3's own reminder isn't generated here; would need per-candidate
//   logic this pass didn't build.
export async function generateStandardAnnouncements(
  supabase: SupabaseClient<Database>,
  courseId: string,
  authorId: string
): Promise<void> {
  const { data: course } = await supabase
    .from("courses")
    .select("assessor_visit_date, end_date")
    .eq("id", courseId)
    .maybeSingle();
  if (!course) return;

  const { data: events } = await supabase
    .from("course_timetable_events")
    .select("id, type, title, event_date, linked_assignment_type, tp_group_scope_id")
    .eq("course_id", courseId);

  const rows: Database["public"]["Tables"]["course_broadcasts"]["Insert"][] = [];

  // Day before an assignment's deadline. Whole cohort by default;
  // tp_group_scope_id (for-claude-code-announcement-infra-fixes.md item 1)
  // narrows it to one group when a course stages ABC/DEF on different
  // dates -- a second assignment_due row for the same assignment_type,
  // its own date, its own scope.
  for (const e of events ?? []) {
    if (e.type !== "assignment_due") continue;
    const title = e.linked_assignment_type ? ASSIGNMENT_INFO[e.linked_assignment_type as AssignmentType]?.title : null;
    rows.push({
      course_id: courseId,
      author_id: authorId,
      title: `${title ?? "An assignment"} is due tomorrow`,
      body: "The brief is in the Resource hub.",
      visible_to_tp_group_id: e.tp_group_scope_id,
      anchor_event_id: e.id,
      anchor_offset_days: -1,
      sent_at: null,
      source_key: `deadline:${e.id}`,
    });
  }

  // Assessor visit -2 days -- no dedicated timetable event exists for this
  // by default, so find-or-create one on the visit date (same tag-based
  // "milestone" convention as Consultation/Stage 2).
  if (course.assessor_visit_date) {
    let anchorId = (events ?? []).find((e) => e.type === "milestone" && e.event_date === course.assessor_visit_date)?.id;
    if (!anchorId) {
      const { data: created } = await supabase
        .from("course_timetable_events")
        .insert({
          course_id: courseId,
          type: "milestone",
          tag: "assessor_visit",
          title: "Assessor visit",
          event_date: course.assessor_visit_date,
        })
        .select("id")
        .single();
      anchorId = created?.id;
    }
    if (anchorId) {
      rows.push({
        course_id: courseId,
        author_id: authorId,
        title: "Your assessor visits soon",
        body: "An external Cambridge assessor will be visiting the course soon, sitting in on some teaching practice and reviewing portfolios. This is a normal, routine part of every CELTA course.",
        anchor_event_id: anchorId,
        anchor_offset_days: -2,
        sent_at: null,
        source_key: "assessor_visit",
      });
    }
  }

  // Final day morning -- find-or-create a milestone on end_date the same way.
  if (course.end_date) {
    let anchorId = (events ?? []).find((e) => e.type === "milestone" && e.event_date === course.end_date)?.id;
    if (!anchorId) {
      const { data: created } = await supabase
        .from("course_timetable_events")
        .insert({
          course_id: courseId,
          type: "milestone",
          tag: "whole_group",
          title: "Course ends -- final feedback",
          event_date: course.end_date,
        })
        .select("id")
        .single();
      anchorId = created?.id;
    }
    if (anchorId) {
      rows.push({
        course_id: courseId,
        author_id: authorId,
        title: "Final day — bring your portfolio complete",
        body: null,
        anchor_event_id: anchorId,
        anchor_offset_days: 0,
        sent_at: null,
        source_key: "final_day",
      });
    }
  }

  // Stage 1 tutorial window -- anchors to the real skeleton milestone when
  // one exists (title match against timetable-skeleton.ts's own wording).
  const stage1Event = (events ?? []).find((e) => e.type === "milestone" && e.title === "Stage 1 tutorials begin");
  if (stage1Event) {
    rows.push({
      course_id: courseId,
      author_id: authorId,
      title: "Stage 1 progress checks start this week",
      body: null,
      anchor_event_id: stage1Event.id,
      anchor_offset_days: 0,
      sent_at: null,
      source_key: "stage1_tutorial",
    });
  }

  if (rows.length === 0) return;

  // App-level idempotency check, not upsert(onConflict) -- Postgres won't
  // accept a partial unique index (migration 0095's `where source_key is
  // not null`) as an ON CONFLICT target unless the same WHERE predicate is
  // repeated in the conflict clause, which supabase-js's upsert() has no
  // way to express (confirmed live: it 42P10s -- "no unique or exclusion
  // constraint matching the ON CONFLICT specification" -- silently, since
  // this call's error was never checked before). The unique index still
  // stands as a real DB-level backstop against a genuine race.
  const { data: existing } = await supabase
    .from("course_broadcasts")
    .select("source_key")
    .eq("course_id", courseId)
    .not("source_key", "is", null);
  const existingKeys = new Set((existing ?? []).map((r) => r.source_key).filter((k): k is string => k !== null));
  const newRows = rows.filter((r) => !r.source_key || !existingKeys.has(r.source_key));
  if (newRows.length === 0) return;

  await supabase.from("course_broadcasts").insert(newRows);
}
