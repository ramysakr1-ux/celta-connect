import "server-only";
import { doubleMarkingPerAssignment } from "@/lib/assessor-requirements";
import type { Database } from "@/lib/supabase/types";

// Where every assignment on the course has got to, read once.
//
// design_handoff_tutor_assignments §1: the board is the tutor's front page
// for assignments -- every candidate against every assignment, a personal
// queue, and the centre's double-marking record. Every cell, every queue card
// and every sample slot is derived from the submission record; nothing here
// is stored.
//
// Kept out of the page so the marking screen can ask the same questions and
// get the same answers -- particularly `needsSecondMark`, which decides
// whether a decision can go straight to the candidate or has to go to another
// tutor first.

type AssignmentRow = Database["public"]["Tables"]["assignments"]["Row"];

export type BoardCellState =
  | "locked"
  | "writing"
  | "awaiting"
  | "draft"
  | "second_pending"
  | "settle"
  | "resub_needed"
  | "resub_in"
  | "pass"
  | "pass_resub"
  | "fail_resub";

export interface BoardCell {
  state: BoardCellState;
  /** The round a marker would be working on right now. */
  round: "first" | "resubmission";
  /** In the double-marked sample: picked, or a fail that entered automatically. */
  inSample: boolean;
  /** Days since the candidate handed this round in, for "waiting 3 days". */
  waitingDays: number | null;
}

/** Which round is live on a row -- the same derivation the detail page makes. */
export function liveRound(a: AssignmentRow): "first" | "resubmission" {
  return a.first_status === "resubmission_required" ? "resubmission" : "first";
}

/** The marks a marker has written for the live round, released or not. */
export function marksFor(a: AssignmentRow, round: "first" | "resubmission"): Record<string, boolean> {
  return (round === "resubmission" ? a.resubmission_criteria_marks : a.first_criteria_marks) ?? {};
}

export function overallCommentFor(a: AssignmentRow, round: "first" | "resubmission"): string | null {
  return round === "resubmission" ? a.resubmission_overall_comment : a.first_overall_comment;
}

export function marksSavedAt(a: AssignmentRow, round: "first" | "resubmission"): string | null {
  return round === "resubmission" ? a.resubmission_marks_saved_at : a.first_marks_saved_at;
}

/**
 * The outcome, derived from the marks and never chosen (§2d).
 * Returns null while the marking is incomplete -- a criterion left unmarked
 * is not the same as a criterion marked Not met.
 */
export function derivedOutcome(
  marks: Record<string, boolean>,
  criterionKeys: string[],
  round: "first" | "resubmission",
  sanction: boolean
): { label: string; failType: boolean } | null {
  if (criterionKeys.length === 0) return null;
  if (criterionKeys.some((k) => marks[k] === undefined)) return null;
  const allMet = criterionKeys.every((k) => marks[k] === true);
  if (sanction) return allMet ? { label: "Accepted", failType: false } : { label: "Not accepted", failType: true };
  if (round === "resubmission") {
    return allMet ? { label: "Pass on resubmission", failType: false } : { label: "Fail on resubmission", failType: true };
  }
  return allMet ? { label: "Pass", failType: false } : { label: "Resubmission needed", failType: true };
}

/**
 * Handbook June 2025 9.2.3 -- "The sample checked should include any fail
 * assignments," and "It is recommended that centres should try to include
 * some blind double-marking." A fail-type outcome therefore cannot be
 * released on one tutor's word; a pass outside the sample can.
 */
export function needsSecondMark(a: AssignmentRow, outcomeIsFailType: boolean): boolean {
  return outcomeIsFailType || a.in_double_marking_sample;
}

function daysSince(iso: string | null, today: string): number | null {
  if (!iso) return null;
  const then = Date.parse(iso.slice(0, 10));
  const now = Date.parse(today);
  if (Number.isNaN(then) || Number.isNaN(now)) return null;
  return Math.max(0, Math.round((now - then) / 86_400_000));
}

export function boardCell(
  a: AssignmentRow,
  {
    today,
    releaseOpen,
    criterionKeys,
  }: { today: string; releaseOpen: boolean; criterionKeys: string[] }
): BoardCell {
  const round = liveRound(a);
  const sanction = a.assignment_type === "Plagiarism Reflection";
  const marks = marksFor(a, round);
  const outcome = derivedOutcome(marks, criterionKeys, round, sanction);
  // A fail already recorded counts as in the sample even where nothing was
  // picked -- that is the rule, not a display choice.
  const failRecorded = a.resubmission_outcome === "fail" || a.final_grade === "Fail";
  const inSample = a.in_double_marking_sample || failRecorded || Boolean(outcome?.failType);
  const submittedAt = round === "resubmission" ? a.resubmission_submitted_at : a.first_submitted_at;
  const waitingDays = daysSince(submittedAt, today);
  const base = { round, inSample, waitingDays } as const;

  // Closed states first -- a released decision outranks everything.
  if (a.resubmission_outcome === "fail" || a.final_grade === "Fail") return { ...base, state: "fail_resub" };
  if (a.resubmission_status === "approved") return { ...base, state: "pass_resub" };
  if (a.first_status === "approved") return { ...base, state: "pass" };

  if (a.first_status === "resubmission_required") {
    if (a.resubmission_status === "not_submitted") return { ...base, state: "resub_needed" };
    // The resubmission is in and being marked: fall through to the marking
    // states below, which read the resubmission round.
  }

  if (round === "first" && a.first_status === "not_submitted") {
    return { ...base, state: releaseOpen ? "writing" : "locked" };
  }

  // Submitted, not yet released. Where in the marking is it?
  // Both marks exist. It stays here -- settle, initial, release -- until the
  // first marker releases it and the status moves; initialling is not itself
  // the release.
  if (a.second_marks_recorded_at && a.second_mark_round === round) {
    return { ...base, state: "settle" };
  }
  if (marksSavedAt(a, round)) {
    const needs = needsSecondMark(a, Boolean(outcome?.failType));
    if (needs) return { ...base, state: "second_pending" };
    return { ...base, state: "draft" };
  }
  if (round === "resubmission") return { ...base, state: "resub_in" };
  return { ...base, state: "awaiting" };
}

export interface QueueItem {
  assignmentId: string;
  traineeId: string;
  traineeName: string;
  assignmentType: string;
  assignmentTitle: string;
  /** Why it is in this tutor's queue. */
  reason: string;
  action: string;
  hue: "gold" | "teal" | "garnet";
  /** Sorted oldest first; null sorts last. */
  waitingDays: number | null;
  order: number;
}

/**
 * Everything that needs THIS tutor now, oldest first (§1c). Another tutor's
 * draft marks and another tutor's second mark are deliberately absent: they
 * are not this tutor's work to do.
 */
export function buildQueue(
  rows: { assignment: AssignmentRow; cell: BoardCell; traineeName: string; title: string }[],
  tutorId: string
): QueueItem[] {
  const items: QueueItem[] = [];
  for (const { assignment: a, cell, traineeName, title } of rows) {
    const common = {
      assignmentId: a.id,
      traineeId: a.trainee_id,
      traineeName,
      assignmentType: a.assignment_type,
      assignmentTitle: title,
      waitingDays: cell.waitingDays,
    };
    if (cell.state === "awaiting") {
      items.push({
        ...common,
        reason: cell.waitingDays === 0 ? "Handed in today" : `Waiting ${cell.waitingDays ?? 0} days`,
        action: "Mark",
        hue: "gold",
        order: 1,
      });
    } else if (cell.state === "draft" && a.marker_id === tutorId) {
      items.push({ ...common, reason: "Your draft marks — not sent", action: "Finish", hue: "teal", order: 2 });
    } else if (cell.state === "second_pending" && a.second_marker_id === tutorId) {
      items.push({ ...common, reason: "Blind second mark", action: "Second-mark", hue: "gold", order: 3 });
    } else if (cell.state === "settle" && (a.marker_id === tutorId || a.second_marker_id === tutorId)) {
      items.push({ ...common, reason: "Both marked — settle and initial", action: "Settle", hue: "garnet", order: 4 });
    } else if (cell.state === "resub_in") {
      items.push({
        ...common,
        reason: cell.waitingDays === 0 ? "Resubmission in today" : `Resubmission in · ${cell.waitingDays ?? 0} days`,
        action: "Mark round 2",
        hue: "gold",
        order: 5,
      });
    }
  }
  return items.sort((x, y) => x.order - y.order || (y.waitingDays ?? -1) - (x.waitingDays ?? -1));
}

export interface SampleRow {
  assignmentType: string;
  title: string;
  /** Settled -- a second mark recorded and both tutors initialled. */
  settled: number;
  /** In progress -- picked or failed, second mark not finished. */
  inProgress: number;
  required: number | null;
  failsOutsideSample: number;
  anyFails: boolean;
}

/** The centre's double-marking record, per assignment (§1c, Handbook 9.2.3). */
export function buildSample(
  rows: { assignment: AssignmentRow; cell: BoardCell }[],
  types: { type: string; title: string }[],
  cohortSize: number
): SampleRow[] {
  const required = doubleMarkingPerAssignment(cohortSize);
  // What counts as double-marked has to match what the assessor's own record
  // at /assessor/double-marking counts, or the same course reads four on one
  // screen and zero on the other. Both readings of 9.2.3 are valid and both
  // are in the data: a COUNTERSIGN (a second tutor opens the marked work,
  // checks the grading and comments, and signs) is complete the moment it is
  // signed; a BLIND second mark -- an independent set of marks -- is complete
  // only once the two tutors have settled and both initialled.
  const isSettled = (a: AssignmentRow) => {
    if (!a.second_marker_recorded_at) return false;
    if (a.second_marks_recorded_at) return Boolean(a.first_initialled_at && a.second_initialled_at);
    return true;
  };
  return types.map(({ type, title }) => {
    const ofType = rows.filter((r) => r.assignment.assignment_type === type);
    const settled = ofType.filter((r) => isSettled(r.assignment)).length;
    const inProgress = ofType.filter((r) => r.cell.inSample && !isSettled(r.assignment)).length;
    const fails = ofType.filter((r) => r.cell.state === "fail_resub" || r.cell.state === "resub_needed");
    const failsOutsideSample = fails.filter((r) => !r.assignment.second_marker_recorded_at).length;
    return { assignmentType: type, title, settled, inProgress, required, failsOutsideSample, anyFails: fails.length > 0 };
  });
}
