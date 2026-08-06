import type { Database } from "@/lib/supabase/types";

type AssignmentType = Database["public"]["Tables"]["assignments"]["Row"]["assignment_type"];
type SubmissionStatus = Database["public"]["Tables"]["assignments"]["Row"]["first_status"];

export const ASSIGNMENT_STATUS_PILL_CLASS: Record<SubmissionStatus, string> = {
  not_submitted: "pill-neutral",
  pending: "pill-neutral",
  submitted: "pill-info",
  resubmission_required: "pill-danger",
  approved: "pill-success",
};

export const ASSIGNMENT_STATUS_LABEL: Record<SubmissionStatus, string> = {
  not_submitted: "Draft",
  pending: "Pending review",
  submitted: "Under Review",
  resubmission_required: "Resubmission required",
  approved: "Pass",
};

// Fixed CELTA assignment briefs -- identical for every trainee at every
// centre, so this is static reference content (like ABBREVIATIONS_GLOSSARY
// in tp-density.ts), not per-trainee data. Word count is uniform across all
// four assignments per the current Cambridge syllabus.
export const ASSIGNMENT_WORD_COUNT = "750-1,000 words";

// The canonical teaching order (not alphabetical -- assignment_type sorts as
// "Focus on Learner", "LRT", "LfC", "Skills" alphabetically, which is wrong).
export const ASSIGNMENT_ORDER: AssignmentType[] = ["Focus on Learner", "LRT", "Skills", "LfC"];

export const ASSIGNMENT_INFO: Record<AssignmentType, { title: string; description: string }> = {
  "Focus on Learner": {
    title: "Focus on the Learner",
    description:
      "Profile one learner or a small group: needs, motivation, and a diagnosis of language difficulties with remedial activities.",
  },
  LRT: {
    title: "Language Related Tasks",
    description:
      "Analyse meaning, form, phonology and anticipated problems for a set of target language items, with clarification approaches.",
  },
  Skills: {
    title: "Language Skills Related Tasks",
    description:
      "Select an authentic text, justify its suitability, and design receptive and productive skills tasks around it.",
  },
  LfC: {
    title: "Lessons from the Classroom",
    description:
      "Reflect on your teaching across the course: strengths, areas for development, and an action plan for future professional growth.",
  },
};
