import { ASSIGNMENT_INFO } from "@/lib/assignment-info";
import type { Database } from "@/lib/supabase/types";

type Celta5Record = Database["public"]["Tables"]["celta5_records"]["Row"];
type AssignmentRow = Database["public"]["Tables"]["assignments"]["Row"];

export type SignatureState = "signed" | "ready" | "open" | "locked";

export interface SignatureLedgerRow {
  key: string;
  label: string;
  state: SignatureState;
  at: string | null;
}

// The real signature-equivalent events in the schema, one row per thing the
// booklet needs signed off. Stage One has no distinct candidate signature
// column of its own -- it's released and read alongside Stage Two on the
// same page, gated by the same trainee_signoff_stage2_at button (confirmed
// against portfolio/[traineeId]/celta5/page.tsx), so it's folded into the
// "Stage One & Two -- candidate" row rather than an invented extra column.
// Own-work confirmation is per assignment, per round (migration 0052) --
// one row per assignment, reading whichever round is the trainee's current
// or most recent one.
export function computeSignatureLedger(
  // Omit<..., "admin_access_granted_by"> because the trainee's own record
  // arrives from get_my_celta5_record(), which masks that column along with
  // the grade fields. The ledger only reads signature dates and names, so
  // widening the parameter is honest -- narrowing the caller with a cast
  // would have hidden the fact that a trainee's record is a masked view.
  record: Omit<Celta5Record, "admin_access_granted_by"> & Partial<Pick<Celta5Record, "admin_access_granted_by">>,
  assignments: Pick<
    AssignmentRow,
    "assignment_type" | "first_status" | "resubmission_status" | "first_own_work_confirmed" | "resubmission_own_work_confirmed" | "first_outcome_signed_at" | "resubmission_outcome_signed_at"
  >[]
): SignatureLedgerRow[] {
  const rows: SignatureLedgerRow[] = [
    {
      key: "stage12_tutor",
      label: "Stage One & Two -- tutor",
      state: record.stage2_completed_at ? "signed" : record.stage2_candidate_submitted_at ? "ready" : "open",
      at: record.stage2_completed_at,
    },
    {
      key: "stage12_candidate",
      label: "Stage One & Two -- candidate",
      state: record.trainee_signoff_stage2_at ? "signed" : record.stage2_completed_at ? "ready" : "locked",
      at: record.trainee_signoff_stage2_at,
    },
  ];

  if (record.stage3_tutorial_required) {
    rows.push({
      key: "stage3_tutor",
      label: "Stage Three -- tutor",
      state: record.stage3_finalized_at ? "signed" : "open",
      at: record.stage3_finalized_at,
    });
  }

  for (const a of assignments) {
    const isResubmissionRound = a.first_status === "resubmission_required" || a.resubmission_status !== "not_submitted";
    const status = isResubmissionRound ? a.resubmission_status : a.first_status;
    const confirmed = isResubmissionRound ? a.resubmission_own_work_confirmed : a.first_own_work_confirmed;
    const title = ASSIGNMENT_INFO[a.assignment_type]?.title ?? a.assignment_type;
    rows.push({
      key: `own_work_${a.assignment_type}`,
      label: `${title} -- own work`,
      state: confirmed ? "signed" : status === "not_submitted" ? "locked" : "open",
      at: null,
    });
    // Ramy, 29 Aug 2026: "the trainees must sign for the assignments -- if
    // it's pass, for resubmission, second submission, or fail." A separate
    // signature from own-work above: that one is declared before
    // submitting, this one acknowledges the result afterwards.
    //
    // Only becomes signable once there IS a result -- a status that is
    // still not_submitted or submitted has nothing to acknowledge yet.
    const outcomeSignedAt = isResubmissionRound ? a.resubmission_outcome_signed_at : a.first_outcome_signed_at;
    // The real statuses are approved / resubmission_required -- there is no
    // "passed" or "failed" on an assignment. A resubmission that is still
    // required after the resubmission round IS the fail case.
    const hasResult = status === "approved" || status === "resubmission_required";
    rows.push({
      key: `outcome_${a.assignment_type}`,
      label: `${title} -- result seen`,
      state: outcomeSignedAt ? "signed" : hasResult ? "open" : "locked",
      at: outcomeSignedAt,
    });
  }

  rows.push({
    key: "final_grade_trainer",
    label: "Final grade -- trainer",
    state: record.trainer_signoff_final_at ? "signed" : "open",
    at: record.trainer_signoff_final_at,
  });

  rows.push({
    key: "final_day_candidate",
    label: "Final-day declaration -- candidate",
    state: record.trainee_signoff_final_at ? "signed" : record.trainer_signoff_final_at ? "ready" : "locked",
    at: record.trainee_signoff_final_at,
  });

  return rows;
}

export function isBookletExportReady(rows: SignatureLedgerRow[]): boolean {
  return rows.every((r) => r.state === "signed");
}
