"use client";

import { useActionState, useState } from "react";
import {
  saveSelfEvaluationDraft,
  submitSelfEvaluation,
  type FormState,
} from "@/app/dashboard/trainee/plan/[tpNumber]/self-evaluation-actions";
import { VoiceTextarea } from "@/components/voice-textarea";
import type { SelfEvalActionPoint } from "@/lib/tp-plan-content";
import type { Database } from "@/lib/supabase/types";

type TpSelfEvaluation = Database["public"]["Tables"]["tp_self_evaluations"]["Row"];

const initialState: FormState = { error: null };
const inputClass =
  "w-full rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary";

export function SelfEvaluationForm({
  planId,
  tpNumber,
  selfEvaluation,
  previousActionPoints,
}: {
  planId: string;
  tpNumber: number;
  selfEvaluation: TpSelfEvaluation | null;
  previousActionPoints: string[];
}) {
  const [draftState, draftAction, draftPending] = useActionState(saveSelfEvaluationDraft, initialState);
  const [submitState, submitActionFn, submitPending] = useActionState(submitSelfEvaluation, initialState);

  const [actionPoints, setActionPoints] = useState<SelfEvalActionPoint[]>(() => {
    if (selfEvaluation && selfEvaluation.action_points.length > 0) return selfEvaluation.action_points;
    if (previousActionPoints.length > 0) {
      return previousActionPoints.map((p) => ({ previous_point: p, what_i_did: "" }));
    }
    return [{ previous_point: "", what_i_did: "" }];
  });

  const state = submitPending ? submitState : draftState;

  return (
    <form action={draftAction} className="card flex flex-col gap-4 p-6">
      <h2 className="font-serif text-lg text-ink">Self-evaluation</h2>
      <p className="text-sm text-muted">
        Write this before you read your tutor&apos;s feedback -- that&apos;s the point of it.
      </p>
      <input type="hidden" name="plan_id" value={planId} />
      <input type="hidden" name="tp_number" value={tpNumber} />
      <input type="hidden" name="action_points" value={JSON.stringify(actionPoints)} />

      <Field label="What went to plan?" hint="Be specific -- a stage, a moment, something a learner said or did.">
        <VoiceTextarea name="what_went_well" rows={4} defaultValue={selfEvaluation?.what_went_well ?? ""} className={inputClass} />
      </Field>
      <Field label="What didn't go as planned, and why?" hint="Which stage, and what caused it.">
        <VoiceTextarea
          name="what_not_as_planned"
          rows={4}
          defaultValue={selfEvaluation?.what_not_as_planned ?? ""}
          className={inputClass}
        />
      </Field>
      <Field label="What evidence did you see that the learners had learnt?">
        <VoiceTextarea
          name="evidence_of_learning"
          rows={4}
          defaultValue={selfEvaluation?.evidence_of_learning ?? ""}
          className={inputClass}
        />
      </Field>
      <Field label="What would you do differently if you taught it again?">
        <VoiceTextarea
          name="what_differently"
          rows={4}
          defaultValue={selfEvaluation?.what_differently ?? ""}
          className={inputClass}
        />
      </Field>

      <div>
        <label className="text-sm text-muted">Action points from the last TP</label>
        <p className="text-xs italic text-muted">
          Brought in automatically from your tutor&apos;s starred points -- say what you actually did about each one.
        </p>
        <div className="mt-2 flex flex-col gap-2">
          {actionPoints.map((point, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                type="text"
                value={point.previous_point}
                onChange={(e) =>
                  setActionPoints(actionPoints.map((p, x) => (x === i ? { ...p, previous_point: e.target.value } : p)))
                }
                placeholder="Action point set last time"
                className={inputClass}
              />
              <textarea
                rows={2}
                value={point.what_i_did}
                onChange={(e) =>
                  setActionPoints(actionPoints.map((p, x) => (x === i ? { ...p, what_i_did: e.target.value } : p)))
                }
                placeholder="What I did about it"
                className={inputClass}
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setActionPoints([...actionPoints, { previous_point: "", what_i_did: "" }])}
          className="mt-2 text-sm text-primary hover:underline"
        >
          + Add another
        </button>
      </div>

      <Field label="What do you want to work on in the next TP?" hint="Your own priorities, before you read your tutor's.">
        <VoiceTextarea name="next_tp_focus" rows={3} defaultValue={selfEvaluation?.next_tp_focus ?? ""} className={inputClass} />
      </Field>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={draftPending || submitPending}
          className="rounded-[6px] border border-border px-4 py-2 text-sm font-medium text-ink hover:border-primary disabled:opacity-60"
        >
          {draftPending ? "Saving…" : "Save draft"}
        </button>
        <button
          type="submit"
          formAction={submitActionFn}
          disabled={draftPending || submitPending}
          onClick={(e) => {
            if (!window.confirm("Submitting locks your self-evaluation. Continue?")) {
              e.preventDefault();
            }
          }}
          className="rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-card disabled:opacity-60"
        >
          {submitPending ? "Submitting…" : "Submit self-evaluation"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm text-muted">{label}</label>
      {hint ? <p className="text-xs italic text-muted">{hint}</p> : null}
      {children}
    </div>
  );
}
