import { ASSIGNMENT_INFO } from "@/lib/assignment-info";
import { TP_LESSON_LENGTH_MINUTES } from "@/lib/tp-plan-content";
import type { Database, SubmissionStatus } from "@/lib/supabase/types";

type AssignmentType = Database["public"]["Tables"]["assignments"]["Row"]["assignment_type"];
type TimetableEvent = Pick<
  Database["public"]["Tables"]["course_timetable_events"]["Row"],
  "type" | "event_date" | "linked_tp_number" | "linked_assignment_type" | "title"
>;

export interface ProgressIssue {
  label: string;
  detail: string;
}

// Trainee-facing "are you keeping pace" indicator -- deliberately not a
// grade signal (see project memory: trainees never see the real grade
// in-app). Only flags things the trainee themselves controls: a TP that
// should have been taught by now but hasn't, or an assignment whose due
// date has passed with nothing submitted at all. A trainer/tutor being
// slow to review something already submitted is never the trainee's
// fault, so "pending"/"submitted"/"resubmission_required" don't count as
// behind -- only "not_submitted" past its due date does.
export function computeProgressIssues(input: {
  today: string; // YYYY-MM-DD, strictly before an event's date counts as "due"
  timetableEvents: TimetableEvent[];
  taughtTpNumbers: Set<number>;
  assignmentStatusByType: Map<AssignmentType, { first_status: SubmissionStatus; resubmission_status: SubmissionStatus }>;
}): ProgressIssue[] {
  const { today, timetableEvents, taughtTpNumbers, assignmentStatusByType } = input;
  const issues: ProgressIssue[] = [];

  for (const event of timetableEvents) {
    if (event.event_date >= today) continue; // not due yet

    if (event.type === "tp" && event.linked_tp_number != null) {
      if (!taughtTpNumbers.has(event.linked_tp_number)) {
        issues.push({
          label: `TP${event.linked_tp_number}`,
          detail: `not yet taught -- was due ${event.event_date}`,
        });
      }
      continue;
    }

    if (event.type === "assignment_due" && event.linked_assignment_type) {
      const assignmentType = event.linked_assignment_type as AssignmentType;
      const status = assignmentStatusByType.get(assignmentType)?.first_status;
      if (!status || status === "not_submitted") {
        issues.push({
          label: ASSIGNMENT_INFO[assignmentType]?.title ?? event.linked_assignment_type,
          detail: `awaiting submission -- was due ${event.event_date}`,
        });
      }
      continue;
    }

    if (event.type === "resubmission_due" && event.linked_assignment_type) {
      const assignmentType = event.linked_assignment_type as AssignmentType;
      const status = assignmentStatusByType.get(assignmentType)?.resubmission_status;
      if (!status || status === "not_submitted") {
        issues.push({
          label: `${ASSIGNMENT_INFO[assignmentType]?.title ?? event.linked_assignment_type} resubmission`,
          detail: `awaiting submission -- was due ${event.event_date}`,
        });
      }
    }
  }

  return issues;
}

// CELTA5's Section 6 record ("assessed teaching practice") needs both hours
// AND a distinct-levels count -- build-spec.md's own note: "Track levels
// taught, not only hours." At least 2 distinct levels is the real Cambridge
// requirement (build-spec.md's transcription of the final-day checklist:
// "six hours of assessed teaching practice at at least two levels").
//
// tp_lessons.level exists in the schema but that table is only ever written
// by the old, pre-rebuild trainer page (dashboard/trainer/actions.ts) -- the
// live TP pipeline (plan_assignments.taught_at) never populates it, so it
// reads as permanently empty for any course run through the current app.
// The real, live source is the tp_point a taught TP was assigned from, via
// its coursebook's level -- confirmed against migrations 0013/0014/0017.
export const MIN_LEVELS_REQUIRED = 2;

// Shared with the trainer Today page's own overline calc -- extracted here
// so Centre Admin's course-state grouping doesn't reimplement it.
export function computeWeekOf(startDate: string, endDate: string, today: string): string {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const now = new Date(`${today}T00:00:00`);
  const totalWeeks = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (7 * 86400000)));
  const currentWeek = Math.min(totalWeeks, Math.max(1, Math.ceil((now.getTime() - start.getTime()) / (7 * 86400000)) + 1));
  return `week ${currentWeek} of ${totalWeeks}`;
}

// for-claude-code-trainee-interface.md §5's "Input sessions (this week)"
// panel needs an actual date range to filter timetable events by, not just
// computeWeekOf's display label. Course-start-anchored 7-day blocks (not a
// calendar Mon-Sun week) -- simple and self-consistent, though it won't
// always agree exactly with computeWeekOf's own "week N" boundary (that
// function's +1/ceil math was tuned for its label, not derived from a real
// week-start date) -- a cosmetic mismatch only, not a data problem.
export function computeThisWeekRange(startDate: string, today: string): { weekStart: string; weekEnd: string } {
  const start = new Date(`${startDate}T00:00:00`);
  const now = new Date(`${today}T00:00:00`);
  const daysSinceStart = Math.max(0, Math.round((now.getTime() - start.getTime()) / 86400000));
  const weekIndex = Math.floor(daysSinceStart / 7);
  const weekStart = new Date(start.getTime() + weekIndex * 7 * 86400000);
  const weekEnd = new Date(weekStart.getTime() + 6 * 86400000);
  const toIso = (d: Date) => d.toISOString().slice(0, 10);
  return { weekStart: toIso(weekStart), weekEnd: toIso(weekEnd) };
}

export type CourseState = "running" | "upcoming" | "closed";

// Purely date-derived -- Close-out (build-spec item 20, not built yet) will
// eventually be the real "this course is done" signal (export + erase).
// Until then "closed" just means the end date has passed; the UI must not
// imply an export happened that never did.
export function computeCourseState(startDate: string, endDate: string, today: string): CourseState {
  if (today < startDate) return "upcoming";
  if (today > endDate) return "closed";
  return "running";
}

export interface AssessedTpStats {
  hoursAssessed: number;
  tpsTaught: number;
  levels: string[]; // distinct, in first-taught order
}

// assessment-model.md link 3 needs "which TP round has the cohort reached"
// as a cohort-wide, calendar fact -- not a per-trainee count of lessons
// actually delivered, since scope entry is about whether the WHOLE COHORT
// has had the input session yet, true regardless of any one candidate's
// own pace. Each TP round has two timetable rows (one per half/group,
// same linked_tp_number, different dates); a round only counts as reached
// once its LATER date has passed, so isCriterionLiveAtTp() never treats a
// round as done while one half is still mid-way through it.
export function computeCurrentTpRound(events: Pick<TimetableEvent, "type" | "event_date" | "linked_tp_number">[], today: string): number {
  const latestDateByTp = new Map<number, string>();
  for (const e of events) {
    if (e.type !== "tp" || e.linked_tp_number == null) continue;
    const current = latestDateByTp.get(e.linked_tp_number);
    if (!current || e.event_date > current) latestDateByTp.set(e.linked_tp_number, e.event_date);
  }
  let currentRound = 0;
  for (const [tpNumber, latestDate] of latestDateByTp) {
    if (latestDate <= today && tpNumber > currentRound) currentRound = tpNumber;
  }
  return currentRound;
}

export function computeAssessedTpStats(input: {
  taughtAssignments: { tp_point_id: string | null }[]; // plan_assignments rows already filtered to taught_at is not null
  tpPointCoursebookById: Map<string, string>; // tp_points.id -> tp_coursebook_id
  coursebookLevelById: Map<string, string>; // tp_coursebooks.id -> level
}): AssessedTpStats {
  const { taughtAssignments, tpPointCoursebookById, coursebookLevelById } = input;
  const levels: string[] = [];
  for (const a of taughtAssignments) {
    if (!a.tp_point_id) continue; // TP7/8 self-select, no library point to trace a level from
    const coursebookId = tpPointCoursebookById.get(a.tp_point_id);
    const level = coursebookId ? coursebookLevelById.get(coursebookId) : null;
    if (level && !levels.includes(level)) levels.push(level);
  }
  return {
    hoursAssessed: (taughtAssignments.length * TP_LESSON_LENGTH_MINUTES) / 60,
    tpsTaught: taughtAssignments.length,
    levels,
  };
}
