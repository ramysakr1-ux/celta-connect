// Standard ELT level names, the same scale used across the center's real
// courses -- not a free-text field, so a trainer/trainee can't enter "B2"
// in one place and "Upper-Int" in another for the same level.
export const CEFR_LEVELS = [
  { code: "A1", name: "Beginner" },
  { code: "A2", name: "Elementary" },
  { code: "A2+", name: "Pre-Intermediate" },
  { code: "B1", name: "Intermediate" },
  { code: "B2", name: "Upper-Intermediate" },
  { code: "C1", name: "Advanced" },
  { code: "C2", name: "Proficiency" },
] as const;

// Ramy, 2026-08-20: the descriptive name is redundant with the code for
// anyone working in ELT ("Elementary" and "A2" are the same fact twice) --
// every level picker in the app offers the bare code only from here on.
export const LEVEL_OPTIONS = CEFR_LEVELS.map((l) => l.code);

// Corrected 2026-08-20 against the real Volunteer Pool.dc.html handoff
// (Desktop/Connect.zip) -- a fixed 4-color map, reusing Connect's own
// existing brand tokens rather than an invented rainbow spread across all 7
// CEFR codes. A2+/C1/C2 have no assigned color in the design and fall back
// to muted/grey, same as levelPillClass already did for an unrecognized
// code.
//
// Re-pointed 2026-08-21 per the color audit: gold is reserved for
// brand/top-achievement use only, so A2 moves off it. Simply swapping A2 to
// amber and B1 to teal (an earlier pass here did exactly that) collides B1
// with A1, since both would land on the same hue -- this map needs 4
// visually distinct colors, not 4 legend-compliant ones. Resolved the same
// way Observation Tasks.dc.html solves an identical problem (a category
// axis, not a status axis, needing a hue outside the 5-color legend): A2
// takes amber (status-warning ink, since it's already established
// elsewhere), B1 takes blue (status-info ink) rather than colliding with
// A1's teal. B2 stays red.
const LEVEL_PILL_CLASS: Partial<Record<(typeof CEFR_LEVELS)[number]["code"], string>> = {
  A1: "bg-[color-mix(in_oklab,oklch(38%_0.072_195)_14%,transparent)] text-[oklch(38%_0.072_195)]",
  A2: "bg-[color-mix(in_oklab,oklch(44%_0.095_68)_14%,transparent)] text-[oklch(44%_0.095_68)]",
  B1: "bg-[color-mix(in_oklab,oklch(42%_0.095_250)_14%,transparent)] text-[oklch(42%_0.095_250)]",
  B2: "bg-[color-mix(in_oklab,oklch(45%_0.16_27)_14%,transparent)] text-[oklch(45%_0.16_27)]",
};

// Rows created before 2026-08-20 stored the old full label ("Elementary
// (A2)"); rows created after store the bare code directly. Handles both --
// pulls the code out of a trailing "(...)" if present, otherwise the value
// already is the code.
export function extractLevelCode(level: string): string {
  const match = level.match(/\(([^)]+)\)\s*$/);
  return match ? match[1] : level;
}

export function levelPillClass(level: string): string {
  const code = extractLevelCode(level);
  return LEVEL_PILL_CLASS[code as keyof typeof LEVEL_PILL_CLASS] ?? "bg-surface-muted text-muted";
}
