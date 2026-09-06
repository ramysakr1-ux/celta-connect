import "server-only";

// Does the course assessor moderate this trainer-in-training, and what does
// that add to the visit?
//
// CELTA Trainer-in-Training Handbook 2026 §5.1, steps 6a and 6b. Three cases,
// and the trap is that it is NOT simply "external scheme":
//
//   external scheme                              -> required
//   internal scheme, trainer from another centre -> required
//   internal scheme, the centre's own trainer    -> not required; the
//     supervisor assesses them, and may still ask the visiting assessor for a
//     second opinion, in which case the same report is completed.
//
// Both facts already live on tit_records (migrations 0148 and 0234): `scheme`
// and `trains_at_nominating_centre`, set on the Trainer-in-Training screen.
// This is the same rule workspace.tsx has computed as `requiresAssessorDay`
// since 28 Aug 2026 -- lifted into a lib so the Assessor tab and the TinT
// screen cannot drift, not reinvented beside it.

export type ModerationVerdict = "required" | "optional" | "not_applicable" | "unknown";

export interface TintModeration {
  verdict: ModerationVerdict;
  /** One sentence, in the centre's own terms, saying why. */
  because: string;
  /** What the centre has to do about it before the visit, where anything. */
  action: string | null;
  /** Where the assessor's report goes when moderation happens. */
  reportTo: string | null;
}

export interface TintModerationInput {
  /** tit_records.scheme */
  scheme: "internal" | "external" | null;
  /** tit_records.trains_at_nominating_centre -- false = another centre nominated them. */
  trainsAtNominatingCentre: boolean;
}

export function tintModeration({ scheme, trainsAtNominatingCentre }: TintModerationInput): TintModeration {
  const reportTo = trainsAtNominatingCentre
    ? "the JCA for this centre"
    : "the JCA for the centre that nominated them";

  // No tit_records row yet -- the course_tutors flag is set but the record has
  // not been opened on the Trainer-in-Training screen.
  if (scheme === null) {
    return {
      verdict: "unknown",
      because:
        "This course has a trainer-in-training, but their record has not been opened yet, so Connect cannot say whether your assessor has to moderate the training.",
      action: "Open the Trainer-in-Training tab and set the scheme — it is on their Cambridge approval letter.",
      reportTo: null,
    };
  }

  if (scheme === "external") {
    return {
      verdict: "required",
      because: "This trainer-in-training is on the external scheme, so the course assessor assesses them alongside their supervisor.",
      action: "Tell your assessor there is a trainer-in-training to moderate, and agree a schedule that fits it alongside the course assessment.",
      reportTo,
    };
  }

  if (!trainsAtNominatingCentre) {
    return {
      verdict: "required",
      because:
        "Internal scheme, but this trainer-in-training does not train at the centre that nominated them — a trainer from another centre is moderated by the course assessor.",
      action: "Tell your assessor there is a trainer-in-training to moderate, and agree a schedule that fits it alongside the course assessment.",
      reportTo,
    };
  }

  return {
    verdict: "optional",
    because:
      "Internal scheme, training at the centre that nominated them, so the supervisor assesses them and no assessor moderation is required.",
    action:
      "Nothing, unless the supervisor wants a second opinion — they may ask the visiting assessor to observe the input and the TP feedback, and the same report is then completed.",
    reportTo,
  };
}

/**
 * §5.2.2's list, in its order. Kept here rather than in the component so the
 * pack and the tab can never show different duties, and so the one that is a
 * constraint on Connect itself -- the approved tutor still writes the
 * candidates' feedback -- travels with the rest.
 */
export const TINT_ASSESSOR_DUTIES: { label: string; detail: string }[] = [
  {
    label: "Observe them conducting input",
    detail:
      "The supervisor does not need to sit in on this one. And note Administration Handbook §14.2: a trainer-in-training's input session is the only input session an assessor is ever required to attend.",
  },
  {
    label: "Observe them supervising teaching practice",
    detail:
      "Your approved tutor must observe the same lessons and write the feedback notes, so the candidates' portfolios still carry written feedback from an approved CELTA tutor.",
  },
  { label: "Discuss the training process with the trainer-in-training", detail: "" },
  { label: "Discuss the training process with the supervisor", detail: "So the supervisor needs to be free on the day too." },
  {
    label: "Read the trainer-in-training's e-portfolio",
    detail:
      "Eight required contents, from the nomination form to written TP feedback with the candidates' own plans and self-evaluations.",
  },
];
