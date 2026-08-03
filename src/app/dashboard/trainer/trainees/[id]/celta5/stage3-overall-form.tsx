"use client";

import { useActionState } from "react";
import { updateStage3Overall, type FormState } from "@/app/dashboard/trainer/celta5-actions";
import { STANDARD_RATING_OPTIONS } from "@/lib/celta-criteria";
import { TrainerFeedbackTextarea } from "@/components/trainer-feedback-textarea";
import type { Database } from "@/lib/supabase/types";

type Celta5Record = Database["public"]["Tables"]["celta5_records"]["Row"];

const initialState: FormState = { error: null };

export function Stage3OverallForm({ record }: { record: Celta5Record }) {
  const [state, action, pending] = useActionState(updateStage3Overall, initialState);

  return (
    <form action={action} className="card flex flex-col gap-4 p-6">
      <input type="hidden" name="trainee_id" value={record.trainee_id} />
      <h2 className="font-serif text-lg text-ink">Stage Three -- final third (conditional)</h2>
      <p className="text-xs text-muted">
        Only required if the candidate was not to standard at Stage 2, stalled after being
        on/above standard, or is showing signs of a higher grade (Pass B/A) but not
        maintaining progress. Not every candidate needs this.
      </p>

      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          name="stage3_required"
          defaultChecked={record.stage3_required}
        />
        Stage Three required for this candidate
      </label>

      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          name="stage3_tutorial_given"
          defaultChecked={record.stage3_tutorial_given}
        />
        Tutorial given
      </label>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">Hours taught so far</label>
        <input
          name="stage3_hours_taught"
          type="number"
          step="0.1"
          defaultValue={record.stage3_hours_taught ?? ""}
          className="w-32 rounded-[6px] border border-border bg-card px-3 py-2 text-ink outline-none focus:border-primary"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">Tutor&apos;s overall progress assessment</label>
        <select
          name="stage3_tutor_overall"
          defaultValue={record.stage3_tutor_overall ?? ""}
          className="appearance-none rounded-[6px] border border-border bg-card px-3 py-2 text-center text-ink outline-none focus:border-primary"
        >
          <option value="">Not yet assessed</option>
          {STANDARD_RATING_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">Summary of tutorial and action points</label>
        <TrainerFeedbackTextarea
          name="stage3_tutor_notes"
          rows={3}
          defaultValue={record.stage3_tutor_notes ?? ""}
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-ink outline-none focus:border-primary"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">Written assignments notes</label>
        <TrainerFeedbackTextarea
          name="stage3_tutor_written_assignments_notes"
          rows={2}
          defaultValue={record.stage3_tutor_written_assignments_notes ?? ""}
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-ink outline-none focus:border-primary"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">Other notes</label>
        <TrainerFeedbackTextarea
          name="stage3_tutor_other_notes"
          rows={2}
          defaultValue={record.stage3_tutor_other_notes ?? ""}
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-ink outline-none focus:border-primary"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          name="stage3_finalized"
          defaultChecked={!!record.stage3_finalized_at}
        />
        Finalize Stage Three (reveals these ratings to the candidate)
      </label>

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
