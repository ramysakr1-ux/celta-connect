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
        text: "A TP group teaches in only one mode at a time. Each candidate teaches one level face-to-face and the other online -- never a mix inside one group at one stage. The timetable should enforce this, not just warn (not yet built).",
      },
      {
        what: "Two hours minimum",
        tone: "danger",
        text: "At least two of the six assessed hours in each mode; 3 / 3 is what Cambridge calls desirable. The hours counter should split in two (not yet built).",
      },
      {
        what: "Block order",
        tone: "warning",
        text: "No required order between the modes -- start with either. But if the six hours split into a 2-hour and a 4-hour block, the 2-hour block goes first.",
      },
      {
        what: "Observations",
        tone: "default",
        text: "Experienced-teacher observation must cover both modes, so the observation log should gain a mode field (not yet built).",
      },
      {
        what: "Length",
        tone: "default",
        text: "Add at least one day to the 20-day minimum for the transition between modes.",
      },
    ],
  },
};
