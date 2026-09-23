import type { FeedbackPoint } from "@/lib/tp-plan-content";

export type AtRiskReason =
  | "back_to_back_fails"
  | "self_contradiction"
  | "missing_must_submit"
  | "repeating_action_point"
  | "attendance_below_threshold";

/**
 * The centre's attendance policy, and Cambridge puts it there on purpose:
 * CELTA 5 p3 lists "the attendance policy" among the things the CENTRE sets
 * out in the candidate agreement.
 *
 * Cambridge itself names no percentage anywhere. CELTA 5 p9 (identical in the
 * May and July 2023 editions) says "100% attendance is expected. However, in
 * the event of unavoidable absence such as illness, family bereavement or
 * unexpected family commitment, this must be recorded ... and the work from
 * the session missed must be made up", and Administration Handbook June 2025
 * §7.5 says candidates "are expected to attend the whole course" and that
 * absence "may jeopardise their chances of successfully meeting the assessment
 * criteria". Neither gives a figure; the Handbook's only hard numbers are the
 * six hours' teaching practice and the written assignments.
 *
 * Ramy, 23 Sep 2026: "for the trainees it's 100% and if there are absences
 * exceeding 10% even with a doctor report they will it will be flagged." So
 * the line is below 90%, and documentation does NOT suppress it -- a recorded
 * reason changes what the centre does about the absence, not whether anyone is
 * told about it. It RAISES A FLAG and forces nothing: an at-risk reason is only
 * ever sorted, counted and displayed, never a gate.
 *
 * 80% is not this rule and never was -- that is the VOLUNTEER students' line,
 * 160 of 200 hours for their certificate of attendance
 * (CERTIFICATE_HOURS_THRESHOLD, and centers.volunteer_certificate_hours_threshold
 * behind it). Here 80% is only the red band on the roster row's three-tone
 * attendance colour (red < 80, gold < 90, teal >= 90).
 */
export const ATTENDANCE_AT_RISK_PCT = 90;

export interface AtRiskFeedbackInput {
  tp_number: number;
  grade: "above_standard" | "to_standard" | "not_to_standard" | null;
  submitted_at: string | null;
  strengths_planning: FeedbackPoint[];
  strengths_teaching: FeedbackPoint[];
  action_points_planning: FeedbackPoint[];
  action_points_teaching: FeedbackPoint[];
}

export interface AtRiskAssignmentInput {
  due_date: string | null;
  first_submitted_at: string | null;
}

const codesOf = (points: FeedbackPoint[]): string[] => points.flatMap((p) => p.criteria_codes);

// build-spec.md's master backlog item 1 -- 3 streams plus a same-TP
// contradiction flag. Pure function so the roster/Today alert computations
// (the only two callers) can never disagree on what "at risk" means.
export function computeAtRiskReasons(
  feedback: AtRiskFeedbackInput[],
  assignments: AtRiskAssignmentInput[],
  today: string,
  /** Percent of expected hours attended so far. Omit where it is not known. */
  attendancePct?: number | null
): AtRiskReason[] {
  const reasons = new Set<AtRiskReason>();

  // Ramy, 23 Sep 2026: "attendance should make someone at risk." Until this,
  // at-risk read only feedback and assignments, so a candidate below the
  // threshold was counted On track on the roster while the hub flagged them.
  if (typeof attendancePct === "number" && attendancePct < ATTENDANCE_AT_RISK_PCT) {
    reasons.add("attendance_below_threshold");
  }

  const submitted = feedback
    .filter((f) => f.submitted_at)
    .sort((a, b) => a.tp_number - b.tp_number);

  // Stream 1 -- back-to-back fails on consecutive TP numbers.
  for (let i = 1; i < submitted.length; i++) {
    const prev = submitted[i - 1];
    const curr = submitted[i];
    if (
      curr.tp_number === prev.tp_number + 1 &&
      prev.grade === "not_to_standard" &&
      curr.grade === "not_to_standard"
    ) {
      reasons.add("back_to_back_fails");
      break;
    }
  }

  // Self-contradiction -- the same criterion marked as both a strength and
  // an action point on one TP's feedback.
  for (const f of submitted) {
    const strengthCodes = new Set(codesOf([...f.strengths_planning, ...f.strengths_teaching]));
    const actionCodes = codesOf([...f.action_points_planning, ...f.action_points_teaching]);
    if (actionCodes.some((code) => strengthCodes.has(code))) {
      reasons.add("self_contradiction");
      break;
    }
  }

  // Stream 3 -- a criterion recurring as an action point across 2+ TPs.
  const actionPointTpsByCode = new Map<string, number>();
  for (const f of submitted) {
    const codes = new Set(codesOf([...f.action_points_planning, ...f.action_points_teaching]));
    for (const code of codes) {
      actionPointTpsByCode.set(code, (actionPointTpsByCode.get(code) ?? 0) + 1);
    }
  }
  if ([...actionPointTpsByCode.values()].some((count) => count >= 2)) {
    reasons.add("repeating_action_point");
  }

  // Stream 2 -- a required assignment overdue with no first submission.
  if (assignments.some((a) => a.due_date && a.due_date < today && !a.first_submitted_at)) {
    reasons.add("missing_must_submit");
  }

  return [...reasons];
}

export const AT_RISK_LABELS: Record<AtRiskReason, string> = {
  back_to_back_fails: "Back-to-back TP fails",
  self_contradiction: "Feedback marks the same criterion as both a strength and an action point",
  missing_must_submit: "Overdue assignment never submitted",
  repeating_action_point: "Same action point recurring across TPs",
  attendance_below_threshold: `Attendance below ${ATTENDANCE_AT_RISK_PCT}%`,
};
