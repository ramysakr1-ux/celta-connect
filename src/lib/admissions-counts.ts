import type { Database } from "@/lib/supabase/types";

type ApplicantStage = Database["public"]["Tables"]["applicants"]["Row"]["stage"];

export const TERMINAL_NEGATIVE_STAGES = [
  "rejected_before_interview",
  "rejected_after_interview",
  "not_this_time",
  "withdrawn_application",
] as const;

export const MIN_CANDIDATES = 4;

export interface ApplicantCountRow {
  stage: ApplicantStage;
  special_requirements: string | null;
}

export interface ApplicantCounts {
  accepted: number;
  pending: number;
  flagged: number;
}

// Shared by the Course Admin landing list and the per-course page, so
// "accepted" and "pending" mean the same thing in both places. Flagged is
// deliberately a subset of pending, not accepted -- §5b's flag is about
// what needs checking before a decision, so once accepted it has already
// been seen (or the centre chose to proceed anyway).
export function computeApplicantCounts(applicants: ApplicantCountRow[]): ApplicantCounts {
  let accepted = 0;
  let pending = 0;
  let flagged = 0;
  for (const a of applicants) {
    const isTerminalNegative = TERMINAL_NEGATIVE_STAGES.includes(a.stage as (typeof TERMINAL_NEGATIVE_STAGES)[number]);
    if (a.stage === "accepted") {
      accepted++;
    } else if (!isTerminalNegative) {
      pending++;
      if (a.special_requirements) flagged++;
    }
  }
  return { accepted, pending, flagged };
}
