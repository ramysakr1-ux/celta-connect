export type DensityTier = "scripted" | "framework" | "coaching_prose" | "minimal";

export const DEFAULT_DENSITY_BY_TP_NUMBER: Record<number, DensityTier> = {
  1: "scripted",
  2: "scripted",
  3: "framework",
  4: "framework",
  5: "minimal",
  6: "minimal",
};

// TP5 coincides with a coursebook level change and needs richer scaffolding
// than standard TP5-6 -- expressed as an explicit override layered on the
// base mapping (not a hardcoded `if tpNumber === 5` branch), so future
// exceptions can be added here without touching tiering logic. Real
// reference material shows TP5's actual shape is coaching prose, not the
// TP3-4 stage-list -- richer than TP6, but its own distinct format.
export const DENSITY_TIER_OVERRIDES: Partial<Record<number, DensityTier>> = {
  5: "coaching_prose",
};

export function getDensityTier(tpNumber: number): DensityTier {
  return DENSITY_TIER_OVERRIDES[tpNumber] ?? DEFAULT_DENSITY_BY_TP_NUMBER[tpNumber] ?? "minimal";
}

// Trainee-facing labels for the tiers -- the raw union values are internal
// jargon ("coaching_prose") that shouldn't surface on the Plan page. The
// second line frames how much scaffolding the trainee is getting, since the
// whole point of the tiers is a deliberate, progressive step-down.
export const DENSITY_TIER_LABELS: Record<DensityTier, { name: string; blurb: string }> = {
  scripted: {
    name: "Fully scripted",
    blurb: "A minute-by-minute procedure to follow closely.",
  },
  framework: {
    name: "Framework-based",
    blurb: "A named framework and stages -- write your own aims and procedure into it.",
  },
  coaching_prose: {
    name: "Coaching notes",
    blurb: "Guidance to shape your own procedure -- more support as the level changes.",
  },
  minimal: {
    name: "Aims & materials only",
    blurb: "Build the full lesson yourself from the aims and materials below.",
  },
};

// Matches the real per-subgroup slot count (~3 trainees per subgroup).
export const POINTS_PER_TP = 3;

export interface ScriptedStage {
  name: string;
  timing: string | null;
  instructions: string;
}
export interface ScriptedProcedure {
  stages: ScriptedStage[];
}

export interface FrameworkStage {
  name: string;
  reference: string;
}
export interface FrameworkProcedure {
  framework_name: string;
  stages: FrameworkStage[];
  analysis_label: string;
  analysis_prompt: string;
}

export interface CoachingProseProcedure {
  guidance_paragraphs: string[];
}

export type TpProcedure = ScriptedProcedure | FrameworkProcedure | CoachingProseProcedure | null;

// Static reference text shown alongside a trainee's assigned TP content --
// identical center-wide boilerplate, not per-point generated content.
export const ABBREVIATIONS_GLOSSARY: { abbr: string; meaning: string }[] = [
  { abbr: "SB", meaning: "students book" },
  { abbr: "WB", meaning: "work book" },
  { abbr: "p.", meaning: "page number" },
  { abbr: "HO", meaning: "handout" },
  { abbr: "AK", meaning: "answer key" },
  { abbr: "PC", meaning: "paircheck, peer check" },
  { abbr: "PW", meaning: "pair work, peerwork" },
  { abbr: "WC", meaning: "whole class" },
  { abbr: "WCFB", meaning: "whole class feedback" },
  { abbr: "FB", meaning: "feedback" },
  { abbr: "ECDW", meaning: "elicit, CCQ, drill, write" },
  { abbr: "CCQ", meaning: "concept checking questions" },
  { abbr: "TL", meaning: "target language" },
];

export const PLANNING_TIPS = [
  "Check your aims are clear and achievable in the time you have.",
  "Make sure materials are ready and accessible before the lesson.",
  "Think through anticipated problems with language, materials, and learners.",
];

export const TEACHING_TIPS = [
  "Keep teacher talking time to a minimum.",
  "Monitor learners closely and adjust your plan if needed.",
  "Leave time for feedback and error correction at the end.",
];

export function showsAbbreviationsGlossary(tier: DensityTier): boolean {
  return tier === "scripted" || tier === "framework";
}

export function showsTips(tier: DensityTier): boolean {
  return tier !== "minimal";
}
