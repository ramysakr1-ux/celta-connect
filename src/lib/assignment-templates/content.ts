// Shared shapes + static reference content for assignment briefs. Kept
// dependency-free from src/lib/supabase/types.ts (which imports this file)
// to avoid a circular import -- same reasoning as src/lib/tp-plan-content.ts.

// Duplicates the assignments.assignment_type union rather than importing it
// from src/lib/assignment-info.ts (which itself imports supabase/types.ts).
export type AssignmentTypeValue = "Focus on Learner" | "LRT" | "Skills" | "LfC";

export interface TemplateSection {
  key: string;
  title: string;
  instruction: string;
}

export function emptyTemplateSection(): TemplateSection {
  return { key: "", title: "", instruction: "" };
}

// The spec's default section skeleton per assignment type -- used to guide
// the AI parse (src/lib/assignment-templates/generate.ts) toward sensible,
// criteria-aligned chunking, not shown to trainees directly (the published
// template's own section titles/instructions, drawn from the centre's
// actual brief wording, are what trainees see).
export const DEFAULT_SECTION_SKELETONS: Record<AssignmentTypeValue, string[]> = {
  "Focus on Learner": ["Learner profile", "Needs and motivation", "Diagnosis of difficulties", "Remedial activities"],
  LRT: [
    "Per target item: meaning, form and phonology analysis",
    "Anticipated problems and solutions per item",
  ],
  Skills: ["Text rationale and justification", "Receptive skills tasks", "Productive skills tasks"],
  LfC: ["Strengths", "Areas to develop", "Action plan"],
};
