"use client";

import { useActionState } from "react";
import { updateGradeReviewComments, type FormState } from "@/app/dashboard/trainer/celta5-actions";
import { TrainerFeedbackTextarea } from "@/components/trainer-feedback-textarea";
import type { Database } from "@/lib/supabase/types";

type Celta5Record = Database["public"]["Tables"]["celta5_records"]["Row"];

const initialState: FormState = { error: null };

// Verbatim wording from the CELTA5 booklet, only shown for candidates whose
// portfolios actually get submitted to Cambridge (stage3_required) -- see
// project_content_architecture_spec memory, 2026-08-04.
export function GradeReviewCommentsForm({ record }: { record: Celta5Record }) {
  const [state, action, pending] = useActionState(updateGradeReviewComments, initialState);

  return (
    <form action={action} className="sheet flex flex-col gap-3 p-6">
      <input type="hidden" name="trainee_id" value={record.trainee_id} />
      <div>
        <p className="text-xs font-semibold tracking-[0.06em] text-muted uppercase">
          Information for the CELTA grade review
        </p>
        <p className="mt-1 text-sm text-muted">
          Tutor comments on action points detailed in the Stage Three progress record. This box
          is completed for all candidates whose portfolios are submitted to Cambridge English.
          State whether the candidate did or did not demonstrate effectiveness in the areas
          identified, referencing feedback given in final lessons and/or written assignments as
          appropriate. Never shown to the candidate.
        </p>
      </div>

      <TrainerFeedbackTextarea
        name="grade_review_tutor_comments"
        rows={4}
        defaultValue={record.grade_review_tutor_comments ?? ""}
        className="rounded-[6px] border border-border bg-card-inset px-3 py-2 text-ink outline-none focus:border-primary"
      />

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-card disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
