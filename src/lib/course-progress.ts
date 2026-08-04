import { ASSIGNMENT_INFO } from "@/lib/assignment-info";
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
