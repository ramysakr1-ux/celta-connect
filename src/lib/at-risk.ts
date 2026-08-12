import type { FeedbackPoint } from "@/lib/tp-plan-content";

export type AtRiskReason =
  | "back_to_back_fails"
  | "self_contradiction"
  | "missing_must_submit"
  | "repeating_action_point";

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
  today: string
): AtRiskReason[] {
  const reasons = new Set<AtRiskReason>();

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
};
