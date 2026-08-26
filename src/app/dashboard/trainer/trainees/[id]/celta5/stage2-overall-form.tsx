"use client";

import { useActionState } from "react";
import { updateStage2Overall, type FormState } from "@/app/dashboard/trainer/celta5-actions";
import { STANDARD_RATING_OPTIONS } from "@/lib/celta-criteria";
import { StandardRatingPill } from "@/lib/status-pill";
import { TrainerFeedbackTextarea } from "@/components/trainer-feedback-textarea";
import { SetSignatureForm } from "@/components/set-signature-form";
import type { Database } from "@/lib/supabase/types";

type Celta5Record = Database["public"]["Tables"]["celta5_records"]["Row"];

const initialState: FormState = { error: null };

export function Stage2OverallForm({
  record,
  trainerFullName,
  trainerSignatureName,
}: {
  record: Celta5Record;
  trainerFullName: string;
  trainerSignatureName: string | null;
}) {
  const [state, action, pending] = useActionState(updateStage2Overall, initialState);

  return (
    <div className="sheet flex flex-col gap-4 p-6">
      {record.stage2_tutor_signature_name && record.stage2_completed_at ? null : !trainerSignatureName ? (
        <SetSignatureForm fullName={trainerFullName} />
      ) : null}

    <form action={action} className="contents">
      <input type="hidden" name="trainee_id" value={record.trainee_id} />
      <h2 className="font-serif text-lg text-ink">Progress Record — Stage 2: mid-course tutorial</h2>

      {record.stage2_candidate_submitted_at ? (
        <div className="rounded-[6px] border border-border p-3">
          <p className="text-sm text-muted">
            Candidate self-assessment submitted{" "}
            {new Date(record.stage2_candidate_submitted_at).toLocaleString()}.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-sm text-muted">Candidate&apos;s overall:</span>
            <StandardRatingPill rating={record.stage2_candidate_overall} />
          </div>
          {record.stage2_candidate_notes ? (
            <p className="mt-2 text-sm text-ink">{record.stage2_candidate_notes}</p>
          ) : null}
        </div>
      ) : (
        <p className="rounded-[6px] border border-border p-3 text-sm text-muted">
          The candidate hasn&apos;t submitted their self-assessment yet. Your ratings below
          are saved either way, but stay hidden from them until they do.
        </p>
      )}

      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          name="stage2_tutorial_given"
          defaultChecked={record.stage2_tutorial_given}
        />
        Tutorial given
      </label>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">Hours taught so far</label>
        <input
          name="stage2_hours_taught"
          type="number"
          step="0.1"
          defaultValue={record.stage2_hours_taught ?? ""}
          className="w-32 rounded-[6px] border border-border bg-card-inset px-3 py-2 text-ink outline-none focus:border-primary"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">Tutor&apos;s overall progress assessment</label>
        <select
          name="stage2_tutor_overall"
          defaultValue={record.stage2_tutor_overall ?? ""}
          className="appearance-none rounded-[6px] border border-border bg-card-inset px-3 py-2 text-center text-ink outline-none focus:border-primary"
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
          name="stage2_tutor_notes"
          rows={3}
          defaultValue={record.stage2_tutor_notes ?? ""}
          className="rounded-[6px] border border-border bg-card-inset px-3 py-2 text-ink outline-none focus:border-primary"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">Written assignments notes</label>
        <TrainerFeedbackTextarea
          name="stage2_tutor_written_assignments_notes"
          rows={2}
          defaultValue={record.stage2_tutor_written_assignments_notes ?? ""}
          className="rounded-[6px] border border-border bg-card-inset px-3 py-2 text-ink outline-none focus:border-primary"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">Other notes</label>
        <TrainerFeedbackTextarea
          name="stage2_tutor_other_notes"
          rows={2}
          defaultValue={record.stage2_tutor_other_notes ?? ""}
          className="rounded-[6px] border border-border bg-card-inset px-3 py-2 text-ink outline-none focus:border-primary"
        />
      </div>

      {record.stage2_tutor_signature_name && record.stage2_completed_at ? (
        <p className="text-xs text-muted">
          Signed by {record.stage2_tutor_signature_name} on {new Date(record.stage2_completed_at).toLocaleDateString()}.
        </p>
      ) : null}

      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          name="stage2_completed"
          defaultChecked={!!record.stage2_completed_at}
        />
        Progress Record — Stages 1 and 2 complete — reveal to trainee
      </label>
      <p className="text-xs text-muted">
        Checking this is what makes Progress Record Stages 1 and 2 (including your ratings above) visible
        to the trainee for the first time, so they can review and sign off. Nothing is shown
        to them before this, however far along you&apos;ve gotten.
      </p>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-card disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save"}
      </button>
    </form>
    </div>
  );
}
