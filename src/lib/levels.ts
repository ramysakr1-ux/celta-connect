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
// (Desktop/Connect.zip) -- a fixed 4-color map (A1 teal / A2 gold / B1
// green / B2 red), reusing Connect's own existing brand tokens rather than
// an invented rainbow spread across all 7 CEFR codes. A2+/C1/C2 have no
// assigned color in the design and fall back to muted/grey, same as
// levelPillClass already did for an unrecognized code.
const LEVEL_PILL_CLASS: Partial<Record<(typeof CEFR_LEVELS)[number]["code"], string>> = {
  A1: "bg-[color-mix(in_oklab,oklch(38%_0.072_195)_14%,transparent)] text-[oklch(38%_0.072_195)]",
  A2: "bg-[color-mix(in_oklab,oklch(60%_0.11_70)_14%,transparent)] text-[oklch(60%_0.11_70)]",
  B1: "bg-[color-mix(in_oklab,oklch(48%_0.09_150)_14%,transparent)] text-[oklch(48%_0.09_150)]",
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
