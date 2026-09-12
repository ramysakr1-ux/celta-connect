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
      "Claim a specific grammar or pronunciation problem from the whole cohort's pooled observation log, then profile it: needs, motivation, and remedial activities.",
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
  // build-spec.md: "not numbered as a Cambridge assignment... label it
  // plainly". Deliberately absent from ASSIGNMENT_ORDER above -- this
  // entry exists only so pages that read ASSIGNMENT_INFO[assignment_type]
  // generically (e.g. the assignment detail page header) don't crash when
  // they happen to be showing one.
  "Plagiarism Reflection": {
    title: "Plagiarism reflection",
    description: "A centre sanction, not a Cambridge assignment -- set when a plagiarism case is upheld.",
  },
};

// The one correct reading of an assignment's overall result.
//
// The trainer marking action (returnAssignment) records a FAIL on the
// resubmission as resubmission_status = "approved" + resubmission_outcome =
// "fail" -- "approved" there means "the marking round is closed", not "passed".
// A first-round Plagiarism Reflection fail is the same shape (first_status
// "approved", resubmission_outcome "fail"). Any view that reads
// resubmission_status === "approved" as a pass, without first checking the
// outcome, prints "Pass" on a failed assignment -- which several did until a
// seeded terminal-fail state finally exercised the path (11 Sep 2026). Check
// the fail FIRST, here, once, so no screen has to remember to.
export type AssignmentResultState =
  | "not_submitted"
  | "under_review"
  | "resubmission_required"
  | "pass_first"
  | "pass_resub"
  | "fail";

/** The one wording for each result, for status lines staff read. */
export const ASSIGNMENT_RESULT_LABEL: Record<AssignmentResultState, string> = {
  not_submitted: "Not submitted",
  under_review: "Under review",
  resubmission_required: "Resubmission required",
  pass_first: "Pass",
  pass_resub: "Pass (on resubmission)",
  fail: "Fail",
};

export function resolveAssignmentResult(a: {
  first_status: SubmissionStatus;
  resubmission_status: SubmissionStatus;
  resubmission_outcome: "pass" | "fail" | null;
  final_grade: string | null;
}): AssignmentResultState {
  if (a.resubmission_outcome === "fail" || a.final_grade?.toLowerCase() === "fail") return "fail";
  if (a.first_status === "approved") return "pass_first";
  if (a.resubmission_status === "approved") return "pass_resub";
  if (a.resubmission_status === "submitted" || a.resubmission_status === "pending") return "under_review";
  if (a.first_status === "resubmission_required") return "resubmission_required";
  if (a.first_status === "submitted" || a.first_status === "pending") return "under_review";
  return "not_submitted";
}
