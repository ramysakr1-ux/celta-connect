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

const STAGE_LABEL: Partial<Record<ApplicantStage, string>> = {
  submitted: "Applied",
  task_returned: "Task returned",
  interview_booked: "Interview booked",
  interview_completed: "Interviewed",
  offer_sent: "Offer sent",
  accepted: "Interviewed",
  waiting_list: "Waiting list",
};

export interface ApplicantSummaryRow {
  id: string;
  fullName: string;
  stageLabel: string;
  flagged: boolean;
  accepted: boolean;
  statusLabel: string;
}

export interface ApplicantSummaryInput {
  id: string;
  full_name: string;
  stage: ApplicantStage;
  special_requirements: string | null;
}

// Course Administrator Landing.dc.html, Screen 2: individual candidate
// rows on the per-course page itself, not just the landing list's
// aggregate counts. Terminal-negative stages (rejected/withdrawn/not this
// time) are dropped -- they're no longer "in the pipeline" this card is
// summarizing. Sorted flagged-first, since that's the one that needs a
// look before any decision gets made (§5b).
export function summarizeApplicantsForCard(applicants: ApplicantSummaryInput[]): ApplicantSummaryRow[] {
  return applicants
    .filter((a) => !TERMINAL_NEGATIVE_STAGES.includes(a.stage as (typeof TERMINAL_NEGATIVE_STAGES)[number]))
    .map((a) => {
      const accepted = a.stage === "accepted";
      const flagged = !accepted && Boolean(a.special_requirements);
      return {
        id: a.id,
        fullName: a.full_name,
        stageLabel: STAGE_LABEL[a.stage] ?? a.stage,
        flagged,
        accepted,
        statusLabel: accepted ? "Accepted" : flagged ? "Reviewing" : "Pending",
      };
    })
    .sort((a, b) => {
      const rank = (r: ApplicantSummaryRow) => (r.flagged ? 0 : r.accepted ? 1 : 2);
      return rank(a) - rank(b);
    });
}

/**
 * Cambridge's age entry requirement, Administration Handbook (June 2025)
 * section 7.3, quoted from the real PDF:
 *
 *   "applicants must be at least 18. It is generally recommended that
 *    candidates should be aged 20 or over, but candidates aged between 18
 *    and 20 can be accepted at the centre's discretion."
 *
 * Two rules. Under 18 is refused at /apply -- "must". Between 18 and 20 is
 * expressly permitted "at the centre's discretion", so the app must not
 * block it; it says so on the applicant, because a discretion nobody is
 * told about is not a discretion being exercised.
 *
 * Derived from the stored date of birth rather than written to a column of
 * its own: there is only one date of birth, and a second copy of a fact
 * computed from it can only ever go stale -- if the DOB is corrected, this
 * follows automatically.
 *
 * Measured at the course start, the moment the requirement is actually
 * about, falling back to today when the course has no date yet.
 */
export function celtaAgeBand(
  dateOfBirth: string | null | undefined,
  courseStart: string | null | undefined
): { band: "under_18" | "discretionary_18_20" | "ok" | "unknown"; age: number | null } {
  if (!dateOfBirth) return { band: "unknown", age: null };
  const dob = new Date(`${dateOfBirth}T00:00:00Z`);
  if (Number.isNaN(dob.getTime())) return { band: "unknown", age: null };
  const reference = courseStart ? new Date(`${courseStart}T00:00:00Z`) : new Date();

  let age = reference.getUTCFullYear() - dob.getUTCFullYear();
  const beforeBirthday =
    reference.getUTCMonth() < dob.getUTCMonth() ||
    (reference.getUTCMonth() === dob.getUTCMonth() && reference.getUTCDate() < dob.getUTCDate());
  if (beforeBirthday) age -= 1;

  if (age < 18) return { band: "under_18", age };
  if (age < 20) return { band: "discretionary_18_20", age };
  return { band: "ok", age };
}
