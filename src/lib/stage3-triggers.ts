import type { StandardRating } from "@/lib/supabase/types";

// Who must be given a Stage Three progress record and tutorial.
//
// CELTA 5 (July 2023, p.20) prints three triggers: "This record must be
// completed by tutors in the final third of the course for all candidates
// who: a) were not to standard at Stage 2; b) were at standard at Stage 2
// but are not making the expected progress in the second half of the
// course; c) were above standard at Stage 2 but are not making the expected
// progress in the second half of the course. A tutorial must be given and
// the whole record completed."
//
// CELTA Administration Handbook 10.2 adds a fourth the booklet doesn't
// print -- candidates who have received indications of Pass B or Pass A but
// have not maintained their progress -- and permits a centre to give Stage
// Three to everyone as a centre setting.
//
// Ramy, 29 Aug 2026: "leave it to the centre to decide, with the exception
// of a violation of the Cambridge rules." So the centre may opt everyone
// in, but may not opt a triggered candidate out: the four triggers are a
// floor the centre setting can raise and never lower.

export type Stage3Trigger =
  | "not_to_standard_at_stage2"
  | "at_standard_not_progressing"
  | "above_standard_not_progressing"
  | "higher_grade_not_maintained"
  | "centre_gives_to_all";

export const STAGE3_TRIGGER_LABELS: Record<Stage3Trigger, string> = {
  not_to_standard_at_stage2: "Not to standard at Stage 2",
  at_standard_not_progressing: "At standard at Stage 2 but not making the expected progress in the second half",
  above_standard_not_progressing: "Above standard at Stage 2 but not making the expected progress in the second half",
  higher_grade_not_maintained: "Indications of Pass B or Pass A but progress not maintained",
  centre_gives_to_all: "Centre gives Stage Three to every candidate",
};

export interface Stage3TriggerInput {
  stage2TutorOverall: StandardRating | null;
  /** Tutor assessments of TPs taught after the Stage 2 tutorial, most recent last. */
  postStage2TpOutcomes: (StandardRating | null)[];
  /** Whether the candidate has been shown Pass B / Pass A indications. */
  higherGradeIndicated: boolean;
  /** Centre setting -- Handbook 10.2 allows a centre to give Stage Three to everyone. */
  centreGivesStage3ToAll: boolean;
}

// "Not making the expected progress" is read from the candidate's own TPs
// after Stage 2 rather than from a tutor remembering to tick something:
// any TP below standard since the tutorial, or a drop from the Stage 2
// level, is the observable form of it. Deliberately generous -- a missed
// trigger means a candidate who was entitled to a Stage Three tutorial
// never got one, which is a compliance failure; a spare trigger only means
// a tutorial that turns out to be reassuring.
function notProgressing(outcomes: (StandardRating | null)[], since: StandardRating | null): boolean {
  const seen = outcomes.filter((o): o is StandardRating => !!o);
  if (seen.length === 0) return false;
  if (seen.some((o) => o === "not_to_standard")) return true;
  if (since === "above_standard" && seen.every((o) => o !== "above_standard")) return true;
  return false;
}

export function computeStage3Triggers(input: Stage3TriggerInput): Stage3Trigger[] {
  const fired: Stage3Trigger[] = [];
  const { stage2TutorOverall: s2, postStage2TpOutcomes: post } = input;

  if (s2 === "not_to_standard") fired.push("not_to_standard_at_stage2");
  if (s2 === "to_standard" && notProgressing(post, s2)) fired.push("at_standard_not_progressing");
  if (s2 === "above_standard" && notProgressing(post, s2)) fired.push("above_standard_not_progressing");
  if (input.higherGradeIndicated && notProgressing(post, s2)) fired.push("higher_grade_not_maintained");
  if (input.centreGivesStage3ToAll) fired.push("centre_gives_to_all");

  return fired;
}

/** Cambridge-mandated triggers only -- the floor a centre setting cannot lower. */
export function isStage3Mandatory(triggers: Stage3Trigger[]): boolean {
  return triggers.some((t) => t !== "centre_gives_to_all");
}

export function stage3Expected(triggers: Stage3Trigger[]): boolean {
  return triggers.length > 0;
}
