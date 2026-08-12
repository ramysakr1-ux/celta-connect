// Shared shapes + static reference content for assignment briefs. Kept
// dependency-free from src/lib/supabase/types.ts (which imports this file)
// to avoid a circular import -- same reasoning as src/lib/tp-plan-content.ts.

// Duplicates the assignments.assignment_type union rather than importing it
// from src/lib/assignment-info.ts (which itself imports supabase/types.ts).
// "Plagiarism Reflection" is the centre-sanction task from build-spec.md's
// "Assignment 5" section -- not one of the 4 Cambridge assignments (see
// ASSIGNMENT_ORDER in assignment-info.ts, which deliberately excludes it),
// but it reuses the same AssignmentReviewForm/AssignmentAuthoringForm
// pipeline, so it has to satisfy the same type.
export type AssignmentTypeValue = "Focus on Learner" | "LRT" | "Skills" | "LfC" | "Plagiarism Reflection";

export const PLAGIARISM_REFLECTION_TYPE: AssignmentTypeValue = "Plagiarism Reflection";

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
  // Unused in practice -- this type's sections are fixed
  // (PLAGIARISM_REFLECTION_SECTIONS below) rather than parsed from an
  // uploaded brief, so nothing ever calls the AI-parse pipeline for it.
  // Present only so this Record stays exhaustive over AssignmentTypeValue.
  "Plagiarism Reflection": ["What happened", "Which rule it breached", "Why it matters here", "What you will do differently"],
};

// build-spec.md's exact 4-section shape, verbatim -- fixed content, not
// something a centre authors or a PDF gets parsed into (there is no brief
// to upload; this is a centre sanction, not a Cambridge assignment). Used
// directly as an assignment_templates.sections value when a case is
// decided upheld -- see src/lib/malpractice/decide-case.ts.
export const PLAGIARISM_REFLECTION_SECTIONS: TemplateSection[] = [
  {
    key: "what_happened",
    title: "What happened",
    instruction:
      "In your own words: what you submitted and how it came about. Not an apology -- an account.",
  },
  {
    key: "which_rule",
    title: "Which rule it breached",
    instruction:
      "Quote the centre's policy and the Cambridge guidance you accepted at enrolment: which clause, and why it applies here.",
  },
  {
    key: "why_it_matters",
    title: "Why it matters here",
    instruction:
      "What it would mean for a learner, a colleague, or the centre if a teacher's materials or claims were not their own.",
  },
  {
    key: "going_forward",
    title: "What you will do differently",
    instruction:
      "Be specific: how you will note sources while reading, how you will use and declare AI, what you will do at 1am with a deadline in seven hours.",
  },
];
