"use client";

import { useActionState, useState } from "react";
import {
  saveLessonPlanDraft,
  submitLessonPlan,
  type FormState,
} from "@/app/dashboard/trainee/plan/[tpNumber]/actions";
import { LanguageAnalysisEditor } from "@/app/dashboard/trainee/plan/[tpNumber]/language-analysis-editor";
import { VoiceTextarea } from "@/components/voice-textarea";
import { bulletListProps } from "@/lib/bullet-list";
import { InteractionPatternPopup } from "@/components/interaction-pattern-popup";
import { FrameworkPicker } from "@/components/framework-picker";
import {
  LESSON_FRAMEWORKS,
  emptyAnalysisBlock,
  type AnalysisBlock,
  type LanguageAnalysisType,
  type PlanProcedureRow,
  type VocabRow,
} from "@/lib/tp-plan-content";
import type { Database } from "@/lib/supabase/types";

type TpPlan = Database["public"]["Tables"]["tp_plans"]["Row"];
type TpLanguageAnalysis = Database["public"]["Tables"]["tp_language_analyses"]["Row"];

const initialState: FormState = { error: null };
const inputClass =
  "w-full rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary";

function emptyProcedureRow(): PlanProcedureRow {
  return { stage: "", aim: "", procedure: "", interaction: "", time: "" };
}

function timeValue(s: string): number {
  const match = s.match(/\d+(?:\.\d+)?/g);
  if (!match) return 0;
  return Math.max(...match.map(Number));
}

export function LessonPlanForm({
  tpNumber,
  plan,
  languageAnalysis,
}: {
  tpNumber: number;
  plan: TpPlan | null;
  languageAnalysis: TpLanguageAnalysis | null;
}) {
  const locked = Boolean(plan?.submitted_at);
  const [draftState, draftAction, draftPending] = useActionState(saveLessonPlanDraft, initialState);
  const [submitState, submitActionFn, submitPending] = useActionState(submitLessonPlan, initialState);

  const [procedure, setProcedure] = useState<PlanProcedureRow[]>(
    plan?.procedure && plan.procedure.length > 0
      ? plan.procedure
      : [{ ...emptyProcedureRow(), stage: "LEAD-IN" }, ...Array.from({ length: 4 }, emptyProcedureRow)]
  );
  const [frameworkName, setFrameworkName] = useState(plan?.framework_used ?? "");

  const [laOpen, setLaOpen] = useState(
    Boolean(
      languageAnalysis &&
        (languageAnalysis.context ||
          languageAnalysis.blocks.length > 0 ||
          languageAnalysis.vocab_rows.length > 0)
    )
  );
  const [laType, setLaType] = useState<LanguageAnalysisType>(languageAnalysis?.type ?? "grammar");
  const [laMainAim, setLaMainAim] = useState(languageAnalysis?.is_main_aim ?? false);
  const [laContext, setLaContext] = useState(languageAnalysis?.context ?? "");
  const [laBlocks, setLaBlocks] = useState<AnalysisBlock[]>(
    languageAnalysis && languageAnalysis.blocks.length > 0 ? languageAnalysis.blocks : [emptyAnalysisBlock()]
  );
  const [laVocabRows, setLaVocabRows] = useState<VocabRow[]>(languageAnalysis?.vocab_rows ?? []);
  const [laVocabReference, setLaVocabReference] = useState(languageAnalysis?.vocab_reference ?? "");

  const totalMinutes = procedure.reduce((sum, row) => sum + timeValue(row.time), 0);

  function applyFramework() {
    const framework = LESSON_FRAMEWORKS.find((f) => f.name === frameworkName);
    if (!framework) return;
    const hasTyped = procedure.some((row) => row.procedure.trim());
    if (
      hasTyped &&
      !window.confirm(
        "This will rename the stages and replace the stage aims. Anything you've typed in Procedure stays -- continue?"
      )
    ) {
      return;
    }
    const next = framework.stages.map((stage, i) => ({
      ...(procedure[i] ?? emptyProcedureRow()),
      stage: stage.name,
      aim: stage.aim,
    }));
    setProcedure(next);
  }

  function updateProcedureRow(index: number, patch: Partial<PlanProcedureRow>) {
    setProcedure(procedure.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  const laHasContent =
    laType === "vocab"
      ? laVocabRows.length > 0 && laVocabRows.some((r) => Object.values(r).some((v) => v.trim()))
      : Boolean(laContext.trim()) ||
        laBlocks.some((b) =>
          Object.entries(b).some(([, v]) => (Array.isArray(v) ? v.length > 0 : Boolean((v ?? "").trim())))
        );

  const state = submitPending ? submitState : draftState;

  if (locked) {
    return (
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg text-ink">Your lesson plan</h2>
          <span className="status-pill status-pill-on-track">Submitted -- locked</span>
        </div>
        <p className="mt-1 text-sm text-muted">
          Submitted {plan!.submitted_at ? new Date(plan!.submitted_at).toLocaleString() : ""}. This is now your
          record of the lesson -- ask your trainer if it needs reopening.
        </p>
        <div className="mt-4 flex flex-col gap-4">
          <ReadOnlyField label="Main Aims" value={plan?.main_aims} />
          <ReadOnlyField label="Subsidiary Aims" value={plan?.subsidiary_aims} />
          <ReadOnlyField label="Personal Aims" value={plan?.personal_aims} />
          <ReadOnlyField label="Class Profile" value={plan?.class_profile} />
          <ReadOnlyField label="Materials" value={plan?.materials_description} />
          <div>
            <p className="text-sm text-muted">Procedure</p>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[700px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border-b border-border-faint p-2 text-left text-xs text-muted">Stage / Aim</th>
                    <th className="border-b border-border-faint p-2 text-left text-xs text-muted">Interaction</th>
                    <th className="border-b border-border-faint p-2 text-left text-xs text-muted">Time</th>
                    <th className="border-b border-border-faint p-2 text-left text-xs text-muted">Procedure</th>
                  </tr>
                </thead>
                <tbody>
                  {procedure.map((row, i) => (
                    <tr key={i} className="even:bg-background">
                      <td className="whitespace-pre-line border-b border-border-faint p-2 align-top text-ink">
                        {row.stage}
                        {row.aim ? (
                          <p className="mt-1 text-xs italic text-status-on-track-text">{row.aim}</p>
                        ) : null}
                      </td>
                      <td className="border-b border-border-faint p-2 align-top text-ink">{row.interaction}</td>
                      <td className="border-b border-border-faint p-2 align-top text-ink">{row.time}</td>
                      <td className="whitespace-pre-line border-b border-border-faint p-2 align-top text-ink">
                        {row.procedure}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {languageAnalysis ? (
            <div className="border-t border-border-faint pt-4">
              <p className="text-sm text-muted">Language Analysis ({languageAnalysis.type})</p>
              {languageAnalysis.context ? <p className="mt-1 text-ink">{languageAnalysis.context}</p> : null}
              {languageAnalysis.type === "vocab" ? (
                <ul className="mt-2 flex flex-col gap-2 text-sm">
                  {languageAnalysis.vocab_rows.map((row, i) => (
                    <li key={i} className="text-ink">
                      <b>{row.item}</b> -- {row.definition}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-2 flex flex-col gap-3">
                  {languageAnalysis.blocks.map((block, i) => (
                    <div key={i} className="text-sm text-ink">
                      <p className="font-medium">{block.item}</p>
                      {block.meaning ? <p className="text-muted">{block.meaning}</p> : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <form action={draftAction} className="flex flex-col gap-6">
      <input type="hidden" name="tp_number" value={tpNumber} />

      <div className="card p-6">
        <h2 className="font-serif text-lg text-ink">Your lesson plan</h2>
        <div className="mt-4 flex flex-col gap-4">
          <Field label="Main Aims" hint="What the learners will be able to do by the end.">
            <VoiceTextarea
              name="main_aims"
              rows={3}
              defaultValue={plan?.main_aims ?? ""}
              className={inputClass}
              {...bulletListProps}
            />
          </Field>
          <Field label="Subsidiary Aims" hint="What else the lesson develops along the way.">
            <VoiceTextarea
              name="subsidiary_aims"
              rows={3}
              defaultValue={plan?.subsidiary_aims ?? ""}
              className={inputClass}
              {...bulletListProps}
            />
          </Field>
          <Field label="Personal Aims" hint="Take these from the action points in your last feedback.">
            <VoiceTextarea
              name="personal_aims"
              rows={3}
              defaultValue={plan?.personal_aims ?? ""}
              className={inputClass}
              {...bulletListProps}
            />
          </Field>

          <div>
            <label className="text-sm text-muted">Anticipated Problems &amp; Solutions</label>
            <p className="text-xs italic text-muted">
              Problems with tasks and materials, technology, classroom management, interaction patterns (NOT
              language).
            </p>
            <div className="mt-2 flex flex-col gap-3">
              {[1, 2, 3].map((n) => {
                const existing = plan?.anticipated_problems?.[n - 1];
                return (
                  <div key={n} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <textarea
                      name={`problem_${n}`}
                      rows={2}
                      defaultValue={existing?.problem ?? ""}
                      placeholder={`Problem #${n}`}
                      className={inputClass}
                      {...bulletListProps}
                    />
                    <textarea
                      name={`solution_${n}`}
                      rows={2}
                      defaultValue={existing?.solution ?? ""}
                      placeholder="Solution"
                      {...bulletListProps}
                      className={inputClass}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <Field label="Class Profile" hint="Who you are teaching -- two or three lines is enough.">
            <VoiceTextarea
              name="class_profile"
              rows={3}
              defaultValue={plan?.class_profile ?? ""}
              className={inputClass}
            />
          </Field>
          <Field label="Materials" hint="Everything you and the learners will need, including where it came from.">
            <VoiceTextarea
              name="materials_description"
              rows={3}
              defaultValue={plan?.materials_description ?? ""}
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-serif text-lg text-ink">Lesson shape</h2>
        <p className="text-sm text-muted">Choosing a framework fills the Stage column with that shape&apos;s usual stages.</p>
        <div className="mt-3 flex w-80 flex-col gap-3">
          <input type="hidden" name="framework_used" value={frameworkName} />
          <FrameworkPicker value={frameworkName} onChange={setFrameworkName} />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={applyFramework}
              className="flex-1 rounded-[6px] border border-border px-3 py-1.5 text-sm text-ink hover:border-primary"
            >
              Fill in the stages
            </button>
            <button
              type="button"
              onClick={() => setProcedure(procedure.map((row) => ({ ...row, stage: "", aim: "" })))}
              className="flex-1 rounded-[6px] border border-border px-3 py-1.5 text-sm text-ink hover:border-primary"
            >
              Clear stages
            </button>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-serif text-lg text-ink">Lesson Procedure</h2>
        <p className="text-xs italic text-muted">Write the procedure in short bullet points -- one action per line.</p>
        <input type="hidden" name="procedure" value={JSON.stringify(procedure)} />
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <colgroup>
              <col className="w-44" />
              <col className="w-24" />
              <col className="w-24" />
              <col />
              <col className="w-8" />
            </colgroup>
            <thead>
              <tr>
                <th className="border-b border-border-faint p-2 text-left text-xs text-muted">Stage / Aim</th>
                <th className="border-b border-border-faint p-2 text-left text-xs text-muted">Interaction</th>
                <th className="border-b border-border-faint p-2 text-left text-xs text-muted">Time</th>
                <th className="border-b border-border-faint p-2 text-left text-xs text-muted">Procedure</th>
                <th className="border-b border-border-faint p-2" />
              </tr>
            </thead>
            <tbody>
              {procedure.map((row, i) => (
                <tr key={i} className="even:bg-background">
                  <td className="border-b border-border-faint p-1.5 align-top">
                    <textarea
                      rows={2}
                      value={row.stage}
                      onChange={(e) => updateProcedureRow(i, { stage: e.target.value })}
                      className={`${inputClass} resize-none`}
                    />
                    <textarea
                      rows={2}
                      value={row.aim}
                      onChange={(e) => updateProcedureRow(i, { aim: e.target.value })}
                      placeholder="Stage aim"
                      className="mt-1 w-full resize-none bg-transparent text-xs italic text-status-on-track-text outline-none placeholder:text-muted"
                    />
                  </td>
                  <td className="border-b border-border-faint p-1.5 align-top">
                    <InteractionPatternPopup
                      placeholder="e.g. GW + PW"
                      value={row.interaction}
                      onChange={(v) => updateProcedureRow(i, { interaction: v })}
                      className={`${inputClass} min-h-[60px]`}
                    />
                  </td>
                  <td className="border-b border-border-faint p-1.5 align-top">
                    <input
                      type="text"
                      value={row.time}
                      onChange={(e) => updateProcedureRow(i, { time: e.target.value })}
                      className={`${inputClass} min-h-[60px]`}
                    />
                  </td>
                  <td className="border-b border-border-faint p-1.5 align-top">
                    <textarea
                      rows={3}
                      value={row.procedure}
                      onChange={(e) => updateProcedureRow(i, { procedure: e.target.value })}
                      className={inputClass}
                      {...bulletListProps}
                    />
                  </td>
                  <td className="border-b border-border-faint p-1.5 align-top">
                    <button
                      type="button"
                      onClick={() => setProcedure(procedure.filter((_, x) => x !== i))}
                      className="text-destructive"
                      title="Delete this stage"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setProcedure([...procedure, emptyProcedureRow()])}
            className="rounded-[6px] border border-border px-3 py-1.5 text-sm text-ink hover:border-primary"
          >
            + Add stage
          </button>
          <span className="text-sm font-medium text-primary">Total: {totalMinutes} min</span>
        </div>
      </div>

      <input type="hidden" name="la_type" value={laType} />
      <input type="hidden" name="la_main_aim" value={laMainAim ? "Yes" : "No"} />
      <input type="hidden" name="la_context" value={laContext} />
      <input type="hidden" name="la_blocks" value={JSON.stringify(laBlocks)} />
      <input type="hidden" name="la_vocab_rows" value={JSON.stringify(laVocabRows)} />
      <input type="hidden" name="la_vocab_reference" value={laVocabReference} />
      <input type="hidden" name="la_has_content" value={laHasContent ? "1" : "0"} />

      <LanguageAnalysisEditor
        open={laOpen}
        onToggle={() => setLaOpen(!laOpen)}
        type={laType}
        onTypeChange={setLaType}
        isMainAim={laMainAim}
        onMainAimChange={setLaMainAim}
        context={laContext}
        onContextChange={setLaContext}
        blocks={laBlocks}
        onBlocksChange={setLaBlocks}
        vocabRows={laVocabRows}
        onVocabRowsChange={setLaVocabRows}
        vocabReference={laVocabReference}
        onVocabReferenceChange={setLaVocabReference}
        locked={false}
      />

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
            if (!window.confirm("Submitting locks this lesson plan -- you won't be able to edit it afterwards. Continue?")) {
              e.preventDefault();
            }
          }}
          className="rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-card disabled:opacity-60"
        >
          {submitPending ? "Submitting…" : "Submit lesson plan"}
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

function ReadOnlyField({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-sm text-muted">{label}</p>
      <p className="whitespace-pre-line text-ink">{value}</p>
    </div>
  );
}
