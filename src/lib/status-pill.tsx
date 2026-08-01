import type { CriteriaRating, StandardRating, SubmissionStatus } from "@/lib/supabase/types";

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

const CRITERIA_RATING_CLASS: Record<CriteriaRating, string> = {
  "S+": "status-pill-on-track",
  S: "status-pill-on-track",
  N: "status-pill-at-risk",
  X: "status-pill-pending",
};

export function CriteriaRatingPill({ rating }: { rating: CriteriaRating | null }) {
  if (!rating) {
    return <span className="status-pill status-pill-pending">Not rated</span>;
  }
  return <span className={`status-pill ${CRITERIA_RATING_CLASS[rating]}`}>{rating}</span>;
}

const STANDARD_RATING_LABEL: Record<StandardRating, string> = {
  above_standard: "Above standard",
  to_standard: "To standard",
  not_to_standard: "Not to standard",
};

const STANDARD_RATING_CLASS: Record<StandardRating, string> = {
  above_standard: "status-pill-on-track",
  to_standard: "status-pill-on-track",
  not_to_standard: "status-pill-at-risk",
};

export function StandardRatingPill({ rating }: { rating: StandardRating | null }) {
  if (!rating) {
    return <span className="status-pill status-pill-pending">Not yet assessed</span>;
  }
  return (
    <span className={`status-pill ${STANDARD_RATING_CLASS[rating]}`}>
      {STANDARD_RATING_LABEL[rating]}
    </span>
  );
}
