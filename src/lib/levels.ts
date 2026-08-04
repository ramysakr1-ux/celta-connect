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

export const LEVEL_OPTIONS = CEFR_LEVELS.map((l) => `${l.name} (${l.code})`);
