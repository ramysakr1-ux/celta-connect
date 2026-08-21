// TP Points.dc.html (checkpoint 4) -- the CELTA "kind of lesson" taxonomy
// used to check that a round's 3 points are genuinely different lessons,
// and to show each candidate a coverage matrix of what they've already
// taught. Grammar/Lexis/Function are language-system aims; the other four
// are the two skills pairs (receptive: reading/listening, productive:
// speaking/writing) split into their specific kind, per Ramy -- a generic
// "Receptive"/"Productive" bucket wasn't specific enough.
//
// Single source of truth, same role tp-density.ts plays for density tiers:
// nothing else should hardcode this list or its labels/colors.

export type AimType = "grammar" | "lexis" | "function" | "reading" | "listening" | "speaking" | "writing";

export const AIM_TYPES: AimType[] = ["grammar", "lexis", "function", "reading", "listening", "speaking", "writing"];

export const AIM_TYPE_LABELS: Record<AimType, string> = {
  grammar: "Grammar",
  lexis: "Lexis",
  function: "Function",
  reading: "Reading",
  listening: "Listening",
  speaking: "Speaking",
  writing: "Writing",
};

export const AIM_TYPE_OPTIONS: { value: AimType; label: string }[] = AIM_TYPES.map((value) => ({
  value,
  label: AIM_TYPE_LABELS[value],
}));

// Badge colors translated 1:1 from the design reference's own AIM_STYLE
// object (teal/gold/blue/green/muted). The reference had one bucket each
// for "Receptive"/"Productive" -- reading+listening now share its green,
// speaking+writing now share its muted-gray, so the same 5-color palette
// just covers 7 values instead of 5.
//
// Re-pointed 2026-08-21 per the color audit: this is decorative category
// coloring, not status, but gold is reserved for brand/top-achievement use
// only -- lexis had a clean gold value, so it moved to the same muted-gray
// speaking/writing already use. reading+listening moved off the green/
// on-track hue onto teal (same hue as the app's primary teal), keeping the
// existing bg/ink/dot lightness-and-chroma structure, just re-hued.
export const AIM_TYPE_STYLE: Record<AimType, { bg: string; ink: string; dot: string }> = {
  grammar: { bg: "oklch(38% 0.072 195 / 12%)", ink: "oklch(38% 0.072 195)", dot: "oklch(38% 0.072 195)" },
  lexis: { bg: "oklch(93.5% 0.012 85)", ink: "oklch(51% 0.017 70)", dot: "oklch(51% 0.017 70)" },
  function: { bg: "oklch(93% 0.045 235)", ink: "oklch(42% 0.095 250)", dot: "oklch(42% 0.095 250)" },
  reading: { bg: "oklch(93% 0.019 190)", ink: "oklch(37.5% 0.058 195)", dot: "oklch(37.5% 0.058 195)" },
  listening: { bg: "oklch(93% 0.019 190)", ink: "oklch(37.5% 0.058 195)", dot: "oklch(37.5% 0.058 195)" },
  speaking: { bg: "oklch(93.5% 0.012 85)", ink: "oklch(51% 0.017 70)", dot: "oklch(51% 0.017 70)" },
  writing: { bg: "oklch(93.5% 0.012 85)", ink: "oklch(51% 0.017 70)", dot: "oklch(51% 0.017 70)" },
};

/** "3 different kinds" spread check shared by the library banner and the coverage matrix. */
export function aimTypeSpread(types: (AimType | null | undefined)[]): { distinct: number; total: number } {
  const distinct = new Set(types.filter((t): t is AimType => Boolean(t))).size;
  return { distinct, total: AIM_TYPES.length };
}
