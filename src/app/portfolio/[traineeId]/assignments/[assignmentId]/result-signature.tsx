"use client";

import { useActionState } from "react";
import { signAssignmentOutcome, type AbsenceFormState } from "@/app/portfolio/[traineeId]/status-actions";

const initial: AbsenceFormState = { error: null };

// Ramy, 30 Aug 2026, asking whether a trainee can actually sign everything
// the CELTA 5 needs: they could sign seven of eight. This was the eighth.
// Migration 0245 added the columns and the signature ledger got its row,
// but nothing ever rendered a control -- so the ledger listed a signature
// that could not be given, and the booklet export was gated on it.
//
// Distinct from the own-work declaration on the same page: that one is made
// BEFORE submitting, about authorship. This is made after, acknowledging
// the result and what follows from it -- a resubmission window opening, a
// resubmission being spent. Not agreement, and signing it does not waive
// the right to query the grade.
export function AssignmentResultSignature({
  assignmentId,
  round,
  status,
  signedAt,
  signatureName,
  viewerSignatureName,
  canSign,
}: {
  assignmentId: string;
  round: "first" | "resubmission";
  status: string;
  signedAt: string | null;
  signatureName: string | null;
  viewerSignatureName: string | null;
  canSign: boolean;
}) {
  const [state, formAction, pending] = useActionState(signAssignmentOutcome, initial);

  // Nothing to acknowledge until there is a decision. "submitted" and
  // "pending" are mid-flight, not results.
  const hasResult = status === "approved" || status === "resubmission_required";
  if (!hasResult) return null;

  const resultLine =
    status === "approved"
      ? round === "resubmission"
        ? "Passed on resubmission."
        : "Passed on first submission."
      : "Resubmission required.";

  const consequence =
    status === "approved"
      ? "Nothing further is needed for this assignment."
      : round === "resubmission"
        ? "This was your resubmission. Speak to your tutor about what happens next."
        : "You have one resubmission for this assignment. Your tutor will set the deadline.";

  return (
    <div className="sheet flex flex-col gap-2">
      <h3 className="font-serif text-lg text-ink">Your result</h3>
      <p className="text-sm text-ink">{resultLine}</p>
      <p className="text-sm text-muted">{consequence}</p>

      {signedAt ? (
        <p className="mt-1 rounded-[6px] border border-border bg-card-inset px-3 py-2 text-sm text-muted">
          Acknowledged by {signatureName} on{" "}
          {new Date(signedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.
        </p>
      ) : !canSign ? (
        <p className="mt-1 text-xs text-muted">Not yet acknowledged by the candidate.</p>
      ) : !viewerSignatureName ? (
        <p className="mt-1 text-xs text-muted">Set your signature name on your CELTA 5 page before acknowledging this.</p>
      ) : (
        <form action={formAction} className="mt-1 flex flex-col gap-1">
          <input type="hidden" name="assignment_id" value={assignmentId} />
          <input type="hidden" name="round" value={round} />
          <p className="text-sm text-ink">I have seen this result and understand what it means for this assignment.</p>
          {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
          <button
            type="submit"
            disabled={pending}
            className="mt-1 self-start rounded-[6px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {pending ? "Saving…" : `Sign as ${viewerSignatureName}`}
          </button>
          <span className="text-[11px] text-muted">
            Signing records that you were shown the result. It is not agreement, and it does not affect your right to
            query the grade.
          </span>
        </form>
      )}
    </div>
  );
}
