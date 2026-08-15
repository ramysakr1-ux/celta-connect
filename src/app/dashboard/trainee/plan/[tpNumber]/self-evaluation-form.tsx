"use client";

import { useActionState, useState } from "react";
import {
  saveSelfEvaluationDraft,
  submitSelfEvaluation,
  type FormState,
} from "@/app/dashboard/trainee/plan/[tpNumber]/self-evaluation-actions";
import { FormSubmitBar } from "@/components/form-submit-bar";
import { MobileFormWizard, type WizardStep } from "@/components/mobile-form-wizard";
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
      return previousActionPoints.map((p) => ({ previous_point: p, what_i_did: "", carried: true }));
    }
    return [{ previous_point: "", what_i_did: "" }];
  });

  const state = submitPending ? submitState : draftState;

  // specs/build-spec.md §7: "Trainee -- everything, one question per
  // screen." Same 6 fields as before, just sequenced for MobileFormWizard
  // instead of a 2-column grid -- desktop still sees every field at once
  // (md:block override), just stacked full-width now rather than in a
  // grid; a minor, deliberate layout simplification, not a functional one.
  const steps: WizardStep[] = [
    {
      key: "what_went_well",
      content: (
        <Field label="What went to plan?" hint="Be specific -- a stage, a moment, something a learner said or did.">
          <VoiceTextarea name="what_went_well" rows={4} defaultValue={selfEvaluation?.what_went_well ?? ""} className={inputClass} />
        </Field>
      ),
    },
    {
      key: "what_not_as_planned",
      content: (
        <Field label="What didn't go as planned, and why?" hint="Which stage, and what caused it.">
          <VoiceTextarea
            name="what_not_as_planned"
            rows={4}
            defaultValue={selfEvaluation?.what_not_as_planned ?? ""}
            className={inputClass}
          />
        </Field>
      ),
    },
    {
      key: "evidence_of_learning",
      content: (
        <Field label="What evidence did you see that the learners had learnt?">
          <VoiceTextarea
            name="evidence_of_learning"
            rows={4}
            defaultValue={selfEvaluation?.evidence_of_learning ?? ""}
            className={inputClass}
          />
        </Field>
      ),
    },
    {
      key: "what_differently",
      content: (
        <Field label="What would you do differently if you taught it again?">
          <VoiceTextarea
            name="what_differently"
            rows={4}
            defaultValue={selfEvaluation?.what_differently ?? ""}
            className={inputClass}
          />
        </Field>
      ),
    },
    {
      key: "action_points_table",
      content: (
        <div>
          <label className="text-sm text-muted">Action points from the last TP</label>
          <p className="text-xs italic text-muted">
            Brought in automatically from your tutor&apos;s starred points -- say what you actually did about each one.
          </p>
          <div className="mt-2 overflow-x-auto rounded-[6px] border border-border-faint">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border-b border-border-faint bg-background p-2 text-left text-xs text-muted">
                    Action point set last time
                  </th>
                  <th className="border-b border-border-faint bg-background p-2 text-left text-xs text-muted">
                    What I did about it
                  </th>
                </tr>
              </thead>
              <tbody>
                {actionPoints.map((point, i) => (
                  <tr key={i} className="even:bg-background/50">
                    <td className="border-b border-border-faint p-2 align-top">
                      {point.carried ? (
                        <p className="flex items-start gap-1.5 text-sm text-ink">
                          <span className="mt-0.5 shrink-0 text-xs text-gold">★</span>
                          {point.previous_point}
                        </p>
                      ) : (
                        <input
                          type="text"
                          value={point.previous_point}
                          onChange={(e) =>
                            setActionPoints(
                              actionPoints.map((p, x) => (x === i ? { ...p, previous_point: e.target.value } : p))
                            )
                          }
                          placeholder="Your own point"
                          className={inputClass}
                        />
                      )}
                    </td>
                    <td className="border-b border-border-faint p-2 align-top">
                      <textarea
                        rows={2}
                        value={point.what_i_did}
                        onChange={(e) =>
                          setActionPoints(actionPoints.map((p, x) => (x === i ? { ...p, what_i_did: e.target.value } : p)))
                        }
                        placeholder="What I did about it"
                        className={inputClass}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={() => setActionPoints([...actionPoints, { previous_point: "", what_i_did: "" }])}
            className="mt-2 text-sm text-primary hover:underline"
          >
            + Add another
          </button>
        </div>
      ),
    },
    {
      key: "next_tp_focus",
      content: (
        <Field label="What do you want to work on in the next TP?" hint="Your own priorities, before you read your tutor's.">
          <VoiceTextarea name="next_tp_focus" rows={3} defaultValue={selfEvaluation?.next_tp_focus ?? ""} className={inputClass} />
        </Field>
      ),
    },
  ];

  return (
    <form action={draftAction} className="card flex flex-col gap-4 p-6">
      <h2 className="font-serif text-lg text-ink">Self-evaluation</h2>
      <p className="text-sm text-muted">
        Write this before you read your tutor&apos;s feedback -- that&apos;s the point of it.
      </p>
      <input type="hidden" name="plan_id" value={planId} />
      <input type="hidden" name="tp_number" value={tpNumber} />
      <input type="hidden" name="action_points" value={JSON.stringify(actionPoints)} />

      <div className="flex flex-col gap-4">
        <MobileFormWizard steps={steps} />
      </div>

      <FormSubmitBar
        raiseForMobileNav
        warning="Submitting locks your self-evaluation -- you won't be able to edit it afterwards."
        draftPending={draftPending}
        submitPending={submitPending}
        onSubmitAction={submitActionFn}
        submitLabel="Submit self-evaluation"
        error={state.error}
      />
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
