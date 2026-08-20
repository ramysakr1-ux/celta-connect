import { halfTpDates } from "@/lib/rotation";

// Centre Admin.dc.html 2a -- delivery mode is asked once at course setup.
// Text below is lifted verbatim from that reference (Handbook 2.2.1/2.2.2
// paraphrase already vetted by Ramy's design pass), not reworded here.
export type DeliveryMode = "f2f" | "online" | "mixed";

export const DELIVERY_MODE_OPTIONS: { value: DeliveryMode; label: string; description: string }[] = [
  {
    value: "f2f",
    label: "Face-to-face",
    description: "All teaching practice on-site. Input may still be online or on Moodle.",
  },
  {
    value: "online",
    label: "Fully online",
    description: "All teaching practice online, live, on the centre platform.",
  },
  {
    value: "mixed",
    label: "Mixed-mode",
    description:
      "Teaching practice in both modes -- each candidate teaches one level face-to-face and the other online.",
  },
];

export const DELIVERY_MODE_LABEL: Record<DeliveryMode, string> = {
  f2f: "Face-to-face",
  online: "Fully online",
  mixed: "Mixed-mode",
};

interface ImpactRow {
  what: string;
  text: string;
  tone: "default" | "warning" | "danger";
}

interface ModeImpact {
  heading: string;
  tone: "default" | "warning";
  rows: ImpactRow[];
}

export const DELIVERY_MODE_IMPACT: Record<DeliveryMode, ModeImpact> = {
  f2f: {
    heading: "What this sets",
    tone: "default",
    rows: [
      { what: "Timetable", tone: "default", text: "Every TP is on-site. No mode column, nothing to validate." },
      {
        what: "Observations",
        tone: "default",
        text: "The six hours of experienced-teacher observation are face-to-face, up to three of them filmed.",
      },
      {
        what: "Pre-course task",
        tone: "default",
        text: "Section 6 goes out with Part A shortened to two awareness-raising tasks -- recommended even on single-mode courses.",
      },
    ],
  },
  online: {
    heading: "What this sets",
    tone: "default",
    rows: [
      {
        what: "Required extras",
        tone: "warning",
        text: "A tutor demonstration lesson and an unassessed TP slot, at least 20 minutes of individual teaching, before assessed TP begins.",
      },
      {
        what: "Observations",
        tone: "default",
        text: "Experienced-teacher observation is online live, up to three hours filmed.",
      },
      {
        what: "Tutors",
        tone: "default",
        text: "Every tutor on the course must be able to evidence online teaching or training experience.",
      },
      {
        what: "Length",
        tone: "default",
        text: "Extending beyond four weeks is advised for screen-time breaks and technical contingency.",
      },
    ],
  },
  mixed: {
    heading: "What this sets -- and the two rules that bite",
    tone: "warning",
    rows: [
      {
        what: "One mode per block",
        tone: "danger",
        text: "A TP group teaches in only one mode at a time. Each candidate teaches one level face-to-face and the other online -- never a mix inside one group at one stage. The timetable enforces this: locking refuses if a group's tagged rounds switch mode more than once.",
      },
      {
        what: "Two hours minimum",
        tone: "danger",
        text: "At least two of the six assessed hours in each mode; 3 / 3 is what Cambridge calls desirable. The hours counter splits in two on each candidate's CELTA5 record, with a warning until both sides clear the floor.",
      },
      {
        what: "Block order",
        tone: "warning",
        text: "No required order between the modes -- start with either. But if the six hours split into a 2-hour and a 4-hour block, the 2-hour block goes first.",
      },
      {
        what: "Observations",
        tone: "default",
        text: "Experienced-teacher observation must cover both modes -- the observation log has a mode field, asked whenever the course is mixed-mode.",
      },
      {
        what: "Length",
        tone: "default",
        text: "Add at least one day to the 20-day minimum for the transition between modes.",
      },
    ],
  },
};

export interface Stage3ModeLockCheck {
  lastTwoTpNumbers: [number, number];
  modes: (("f2f" | "online") | null)[];
  mismatched: boolean;
}

// connect-spec-corrections-for-claude-code.md item 1 (Handbook 9.2): "the
// final two assessed TP lessons must be in the same mode of delivery," for
// a mixed-mode candidate who both gets a Stage 3 tutorial and is borderline
// Pass/Fail (the VALID_SLASH_PAIRS "Fail/Pass" slash, celta5-actions.ts).
// TP mode lives on course_timetable_events, shared by a whole TP round, not
// per-trainee -- there's no per-candidate override to write, so this stays
// advisory: resolve what the timetable currently says for this candidate's
// last two assessed rounds (same half -> halfTpDates -> event.mode bridge
// computeAssessedHoursByMode already uses) and flag it when they disagree.
// A trainer acts on the flag by re-tagging the round's mode, the same
// existing control every other TP round mode already goes through.
export function computeStage3MixedModeLock(input: {
  deliveryMode: DeliveryMode | null;
  stage3Required: boolean;
  stage3FinalizedAt: string | null;
  provisionalGrade: string | null;
  provisionalGradeUpper: string | null;
  totalAssessedTpCount: number;
  halfOrder: 1 | 2 | null;
  tpEvents: { event_date: string; mode: "f2f" | "online" | null }[];
}): Stage3ModeLockCheck | null {
  const triggered =
    input.deliveryMode === "mixed" &&
    input.stage3Required &&
    Boolean(input.stage3FinalizedAt) &&
    input.provisionalGrade === "Fail" &&
    input.provisionalGradeUpper === "Pass";
  if (!triggered || input.totalAssessedTpCount < 2 || !input.halfOrder) return null;

  const halfDates = halfTpDates(input.tpEvents, input.halfOrder);
  const modeByDate = new Map(input.tpEvents.map((e) => [e.event_date, e.mode]));
  const lastTwoTpNumbers: [number, number] = [input.totalAssessedTpCount - 1, input.totalAssessedTpCount];
  const modes = lastTwoTpNumbers.map((n) => {
    const date = halfDates[n - 1];
    return date ? (modeByDate.get(date) ?? null) : null;
  });
  const mismatched = modes[0] !== null && modes[1] !== null && modes[0] !== modes[1];

  return { lastTwoTpNumbers, modes, mismatched };
}
