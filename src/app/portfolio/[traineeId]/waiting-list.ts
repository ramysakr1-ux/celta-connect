import { formatCalendarDate } from "@/lib/format-date";
import { ASSIGNMENT_INFO } from "@/lib/assignment-info";
import type { AssignmentTypeValue } from "@/lib/assignment-templates/content";
import { getTpCardStatus, type StandardRatingValue } from "@/lib/tp-plan-content";
import { SCAVENGER_HUNT_QUESTIONS } from "@/lib/scavenger-hunt";

// Course Stream's Catch up list.
//
// Trainee spec C4: lifted out of today-tab.tsx whole, beside the hero state
// machine. The order is the priority order and the reasons for it are kept
// with the code that depends on them.
//
// design_handoff_trainee_landing: "Catch up is never truncated. If nothing is
// outstanding, drop the column rather than showing an empty state." There is
// no cap here, and nothing can be crowded off a list with no lid.

const OBSERVATION_HOURS_REQUIRED = 6;

const LETTER_LABEL: Record<string, string> = {
  fail_risk: "A formal notice about your progress",
  assignment_warning: "A formal notice about an assignment",
  deferral: "Your deferral letter",
};

export interface WaitingItem {
  label: string;
  detail: string;
  href: string;
  /** What sort of thing this is, which is what the Catch up badge colours by:
   *  garnet for something overdue, teal for an action someone is waiting on,
   *  gold for a figure that is simply progressing. They were all one colour
   *  until 9 Sep 2026, which made the list read as uniformly urgent. */
  kind?: "overdue" | "scheduled" | "progress" | "assignment";
  isLetter?: boolean;
  // Ramy, 28 Aug 2026: matches the real mockup's row() pill fields --
  // "Assignment 3 due today" and "Book your Stage 1 tutorial slot" both
  // carry a due-by pill (amber), while self-eval/observation rows don't --
  // only date-bound urgency gets one. Reuses the sitewide .pill system
  // (pill-warning/pill-danger), not a new color invention.
  pill?: string;
  pillClass?: "pill-warning" | "pill-danger";
  // "urgent items never get bumped off this list even when more pile up" --
  // previously only formal letters had this guarantee; extended to any
  // date-bound urgent item (assignment due today/overdue), same reasoning.
  urgent?: boolean;
}

interface AssignmentRow {
  id: string;
  assignment_type: AssignmentTypeValue;
  first_status: string | null;
  due_date: string | null;
}

export function buildWaitingList({
  traineeId,
  today,
  preCourse,
  precourseSectionsDone,
  precourseSectionsTotal,
  scavengerDone,
  huntFoundCount,
  assignments,
  filmedObservationReminder,
  unacknowledgedLetters,
  tutorialInvites,
  tutorialEventById,
  planByTpNumber,
  tpPlanByTpNumber,
  selfEvalByTpNumber,
  feedbackByTpNumber,
  observations,
}: {
  traineeId: string;
  today: string;
  preCourse: boolean;
  precourseSectionsDone: number;
  precourseSectionsTotal: number;
  scavengerDone: boolean;
  huntFoundCount: number;
  assignments: AssignmentRow[] | null;
  filmedObservationReminder: WaitingItem | null;
  unacknowledgedLetters: { id: string; letter_type: string }[] | null;
  tutorialInvites: { id: string; stage: string; timetable_event_id: string }[] | null;
  tutorialEventById: Map<string, { event_date: string; event_time: string | null }>;
  planByTpNumber: Map<number, { taught_at: string | null }>;
  tpPlanByTpNumber: Map<number, { submitted_at: string | null }>;
  selfEvalByTpNumber: Map<number, { submitted_at: string | null }>;
  feedbackByTpNumber: Map<number, { submitted_at: string | null; grade?: StandardRatingValue | null }>;
  observations: { length_minutes: number | null }[] | null;
}): WaitingItem[] {
  const waiting: WaitingItem[] = [];
  if (preCourse && precourseSectionsDone < precourseSectionsTotal) {
    waiting.push({
      label: "Finish your pre-course task",
      detail: `${precourseSectionsDone} of ${precourseSectionsTotal} tasks answered`,
      href: `/portfolio/${traineeId}/pre-course-task`,
    });
  }
  if (preCourse && !scavengerDone) {
    waiting.push({
      label: "Find your way around Connect",
      kind: "progress",
      detail: `${huntFoundCount} of ${SCAVENGER_HUNT_QUESTIONS.length} found`,
      href: `/portfolio/${traineeId}/pre-course-task`,
    });
  }
  for (const a of assignments ?? []) {
    if (a.first_status === "not_submitted" && a.due_date && a.due_date <= today) {
      waiting.push({
        // Ramy, 10 Sep 2026: "the assignments avatar will be garnet and the
        // assignment itself -- LRT or FOL -- will be written in the same
        // colour. Just let it pop a little bit. It's too bland."
        label: `${ASSIGNMENT_INFO[a.assignment_type]?.title ?? a.assignment_type} due`,
        kind: "assignment",
        // A date-only column, said the way a person says it -- "due 3 Sept",
        // not "due 2026-09-03" (seen on a finished course, 12 Sep 2026).
        detail: formatCalendarDate(a.due_date),
        href: `/portfolio/${traineeId}/assignments/${a.id}`,
        pill: a.due_date === today ? "Today" : "Overdue",
        pillClass: a.due_date === today ? "pill-warning" : "pill-danger",
        urgent: true,
      });
    }
  }
  if (filmedObservationReminder) waiting.push(filmedObservationReminder);
  for (const letter of unacknowledgedLetters ?? []) {
    waiting.push({
      label: LETTER_LABEL[letter.letter_type] ?? "A formal letter",
      detail: "Please read and acknowledge it",
      href: `/portfolio/${traineeId}/letters/${letter.id}`,
      isLetter: true,
    });
  }
  for (const invite of tutorialInvites ?? []) {
    const event = tutorialEventById.get(invite.timetable_event_id);
    const stageLabel = invite.stage === "stage1" ? "Stage 1" : "Stage 3";
    waiting.push({
      label: `Confirm your ${stageLabel} tutorial`,
      kind: "scheduled",
      detail: event ? `${formatCalendarDate(event.event_date)}${event.event_time ? ` · ${event.event_time.slice(0, 5)}` : ""}` : "Time set by your tutor",
      href: `/portfolio/${traineeId}/individual-tutorial/${invite.id}`,
    });
  }
  for (const [tpNumber, plan] of planByTpNumber) {
    if (!plan.taught_at) continue;
    const status = getTpCardStatus({
      planSubmitted: Boolean(tpPlanByTpNumber.get(tpNumber)?.submitted_at),
      taught: true,
      selfEvalSubmitted: Boolean(selfEvalByTpNumber.get(tpNumber)?.submitted_at),
      feedbackSubmitted: Boolean(feedbackByTpNumber.get(tpNumber)?.submitted_at),
      grade: feedbackByTpNumber.get(tpNumber)?.grade,
    });
    if (status.label === "Self-evaluation due") {
      waiting.push({ label: `TP${tpNumber} self-evaluation`, detail: "Write it before feedback opens", href: `/portfolio/${traineeId}/tp/${tpNumber}` });
    }
  }
  const observedMinutes = (observations ?? []).reduce((sum, o) => sum + (o.length_minutes ?? 0), 0);
  if (observedMinutes / 60 < OBSERVATION_HOURS_REQUIRED) {
    waiting.push({
      label: "Observation hours",
      kind: "progress",
      detail: `${(observedMinutes / 60).toFixed(1)} of ${OBSERVATION_HOURS_REQUIRED} hrs logged`,
      href: `/portfolio/${traineeId}/celta5`,
    });
  }
  return waiting;
}
