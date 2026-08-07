import type {
  CriteriaRating,
  StandardRating,
  SubmissionStatus,
  TpPointStatus,
} from "@/lib/supabase/types";

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

const STANDARD_RATING_GLYPH: Record<StandardRating, string> = {
  above_standard: "S+",
  to_standard: "S",
  not_to_standard: "N",
};

// Compact 1-2 character variant for dense tables (Grades Report's cohort
// sheet and per-candidate TP row) -- same 3-color mapping as
// StandardRatingPill, just without the full label. No rating = a dim empty
// slot (TP not yet taught/graded), not an error state.
export function StandardRatingGlyph({ rating, title }: { rating: StandardRating | null; title?: string }) {
  if (!rating) {
    return (
      <span
        title={title}
        className="inline-flex h-[22px] w-[30px] items-center justify-center rounded-[5px] border border-dashed border-border-faint text-xs text-muted"
      >
        --
      </span>
    );
  }
  return (
    <span
      title={title}
      className={`status-pill inline-flex h-[22px] w-[30px] items-center justify-center rounded-[5px] px-0 ${STANDARD_RATING_CLASS[rating]}`}
    >
      {STANDARD_RATING_GLYPH[rating]}
    </span>
  );
}

const TP_POINT_STATUS_LABEL: Record<TpPointStatus, string> = {
  pending_review: "Pending review",
  published: "Published",
  archived: "Archived",
};

const TP_POINT_STATUS_CLASS: Record<TpPointStatus, string> = {
  pending_review: "status-pill-pending",
  published: "status-pill-on-track",
  archived: "status-pill-at-risk",
};

export function TpPointStatusPill({ status }: { status: TpPointStatus }) {
  return (
    <span className={`status-pill ${TP_POINT_STATUS_CLASS[status]}`}>
      {TP_POINT_STATUS_LABEL[status]}
    </span>
  );
}
