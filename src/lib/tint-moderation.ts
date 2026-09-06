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
// Deliberately returns "unknown" rather than guessing when the centre has not
// recorded its scheme. Both facts are read off a Cambridge approval letter and
// neither is inferable from anything else in the database -- a page that
// asserted "moderation applies" on a hunch would have a centre under-booking
// or over-booking its assessor by a day.

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
  /** centers.tint_scheme -- null when the centre has not recorded it. */
  scheme: "internal" | "external" | null;
  /** course_tutors.tint_nominated_by -- null when this centre nominated them. */
  nominatedBy: string | null;
}

export function tintModeration({ scheme, nominatedBy }: TintModerationInput): TintModeration {
  const reportTo = nominatedBy
    ? `the JCA for ${nominatedBy}, the centre that nominated them`
    : "the JCA for this centre";

  if (scheme === null) {
    return {
      verdict: "unknown",
      because:
        "Connect does not know which trainer-in-training scheme Cambridge approved this centre for, so it cannot say whether your assessor has to moderate this training.",
      action: "Set the scheme in Centre settings — it is on the approval letter. Until then, agree it with your assessor directly.",
      reportTo: null,
    };
  }

  if (scheme === "external") {
    return {
      verdict: "required",
      because: "This centre is on the external scheme, so the course assessor assesses the trainer-in-training alongside their supervisor.",
      action: "Tell your assessor there is a trainer-in-training to moderate, and agree a schedule that fits it alongside the course assessment.",
      reportTo,
    };
  }

  if (nominatedBy) {
    return {
      verdict: "required",
      because: `This centre is on the internal scheme, but ${nominatedBy} nominated this trainer-in-training — a trainer from another centre is moderated by the course assessor.`,
      action: "Tell your assessor there is a trainer-in-training to moderate, and agree a schedule that fits it alongside the course assessment.",
      reportTo,
    };
  }

  return {
    verdict: "optional",
    because:
      "This centre is on the internal scheme and this is your own trainer, so the supervisor assesses them and no assessor moderation is required.",
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
