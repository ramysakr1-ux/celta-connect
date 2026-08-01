import type { SubmissionStatus } from "@/lib/supabase/types";

const SUBMISSION_STATUS_LABEL: Record<SubmissionStatus, string> = {
  not_submitted: "Not submitted",
  pending: "Pending review",
  submitted: "Submitted",
  resubmission_required: "Resubmission required",
  approved: "Approved",
};

const SUBMISSION_STATUS_CLASS: Record<SubmissionStatus, string> = {
  not_submitted: "status-pill-pending",
  pending: "status-pill-pending",
  submitted: "status-pill-on-track",
  resubmission_required: "status-pill-at-risk",
  approved: "status-pill-on-track",
};

export function SubmissionStatusPill({ status }: { status: SubmissionStatus }) {
  return (
    <span className={`status-pill ${SUBMISSION_STATUS_CLASS[status]}`}>
      {SUBMISSION_STATUS_LABEL[status]}
    </span>
  );
}
