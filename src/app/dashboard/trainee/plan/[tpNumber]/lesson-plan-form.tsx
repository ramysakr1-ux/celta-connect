"use client";

import { useActionState, useRef, useState } from "react";
import {
  saveLessonPlanDraft,
  submitLessonPlan,
  type FormState,
} from "@/app/dashboard/trainee/plan/[tpNumber]/actions";
import { LanguageAnalysisEditor } from "@/app/dashboard/trainee/plan/[tpNumber]/language-analysis-editor";
import { FormSubmitBar } from "@/components/form-submit-bar";
import { DictateAnywhere } from "@/components/dictate-anywhere";
import { bulletListProps } from "@/lib/bullet-list";
import { InteractionPatternPopup } from "@/components/interaction-pattern-popup";
import { FrameworkPicker } from "@/components/framework-picker";
import { getDensityTier, offersLessonShapes } from "@/lib/tp-density";
import {
  LESSON_FRAMEWORKS,
  TP_LESSON_LENGTH_MINUTES,
  normalizeFrameworkName,
  emptyAnalysisBlock,
  sumProcedureMinutes,
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
  "w-full rounded-[6px] border border-border bg-card-inset px-3 py-2 text-sm text-ink outline-none focus:border-primary";

function emptyProcedureRow(): PlanProcedureRow {
  return { stage: "", aim: "", procedure: "", interaction: "", time: "" };
}

// Was `new Date(submitted_at).toLocaleString()` -- no locale, no timeZone.
// In a client component that renders on the server too, that is two
// different strings: the server formats in ITS locale and zone (UTC on
// Vercel), the browser in the reader's. React then reports a hydration
// mismatch, and this was the only console error anywhere in the app --
// React #418 on every TP lesson-plan page. Found 31 Aug 2026 in the
// pre-demo sweep.
//
// It also produced the third date format in one workspace: "8/29/2026,
// 4:10:40 PM" beside "31 Aug" and "2026-08-25".
//
// Fixed locale and an explicit UTC zone makes both renders identical, and
// the format now matches the rest of the app. UTC rather than the centre's
// zone only because this component is not given one; a submission
// timestamp to the day is what the sentence needs, and the exact minute
// never was.
function formatSubmittedAt(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function LessonPlanForm({
  tpNumber,
  plan,
  languageAnalysis,
  previousPlanningActionPoint,
}: {
  tpNumber: number;
  plan: TpPlan | null;
  languageAnalysis: TpLanguageAnalysis | null;
  /** Starred planning action point from the previous TP's feedback, if any -- tap-to-use suggestion under Personal Aims. */
  previousPlanningActionPoint?: string | null;
}) {
  const locked = Boolean(plan?.submitted_at);
  const [draftState, draftAction, draftPending] = useActionState(saveLessonPlanDraft, initialState);
  const [submitState, submitActionFn, submitPending] = useActionState(submitLessonPlan, initialState);

  const [procedure, setProcedure] = useState<PlanProcedureRow[]>(
    plan?.procedure && plan.procedure.length > 0
      ? plan.procedure
      : [{ ...emptyProcedureRow(), stage: "LEAD-IN" }, ...Array.from({ length: 4 }, emptyProcedureRow)]
  );
  const [frameworkName, setFrameworkName] = useState(normalizeFrameworkName(plan?.framework_used));
  // The chosen framework's aim for each stage, shown as placeholder text in the
  // empty aim box -- never written into the plan. Parallel to `procedure`, so
  // every mutation of that array moves this one with it.
  const [aimHints, setAimHints] = useState<string[]>([]);
  const scaffoldedByDefault = offersLessonShapes(getDensityTier(tpNumber));
  const [showShapes, setShowShapes] = useState(scaffoldedByDefault);
  const personalAimsRef = useRef<HTMLTextAreaElement>(null);

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

  const totalMinutes = sumProcedureMinutes(procedure);
  const overBy = totalMinutes - TP_LESSON_LENGTH_MINUTES;

  // Fills the STAGE names only. The stage aims are the candidate's to write --
  // the framework's own wording goes in as placeholder text, so they can see
  // what that stage is for and then say it for their own lesson. Ramy, 12 Sep
  // 2026: "it tells them the stage aims... they should at least write that part."
  function applyFramework() {
    const framework = LESSON_FRAMEWORKS.find((f) => f.name === frameworkName);
    if (!framework) return;
    const hasTyped = procedure.some((row) => row.procedure.trim() || row.aim.trim());
    if (
      hasTyped &&
      !window.confirm("This will rename the stages. Your stage aims and procedure stay -- continue?")
    ) {
      return;
    }
    setProcedure(
      framework.stages.map((stage, i) => ({
        ...(procedure[i] ?? emptyProcedureRow()),
        stage: stage.name,
      }))
    );
    setAimHints(framework.stages.map((stage) => stage.aim));
  }

  function updateProcedureRow(index: number, patch: Partial<PlanProcedureRow>) {
    setProcedure(procedure.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addProcedureRow() {
    setProcedure([...procedure, emptyProcedureRow()]);
    setAimHints([...aimHints, ""]);
  }

  function removeProcedureRow(index: number) {
    setProcedure(procedure.filter((_, i) => i !== index));
    setAimHints(aimHints.filter((_, i) => i !== index));
  }

  function clearStages() {
    setProcedure(procedure.map((row) => ({ ...row, stage: "", aim: "" })));
    setAimHints([]);
  }

  function useCarriedPersonalAim() {
    const textarea = personalAimsRef.current;
    if (!textarea || !previousPlanningActionPoint) return;
    const joined = textarea.value.trim() ? `${textarea.value.trim()}\n${previousPlanningActionPoint}` : previousPlanningActionPoint;
    textarea.value = joined;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
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
      <div className="card rounded-[9px] p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg text-ink">Your lesson plan</h2>
          <span className="status-pill status-pill-on-track">Submitted -- locked</span>
        </div>
        <p className="mt-1 text-sm text-muted">
          Submitted {plan!.submitted_at ? formatSubmittedAt(plan!.submitted_at) : ""}. This is now your
          record of the lesson -- ask your trainer if it needs reopening.
        </p>
        <div className="mt-4 flex flex-col gap-4">
          <ReadOnlyField label="Main Aims" value={plan?.main_aims} />
          <ReadOnlyField label="Subsidiary Aims" value={plan?.subsidiary_aims} />
          <ReadOnlyField label="Personal Aims" value={plan?.personal_aims} />
          {/* The candidate wrote these, and then could not see them again:
              the editable form has the field but this -- the submitted
              record, the thing the page itself calls "your record of the
              lesson" -- dropped it. Anticipating difficulties with tasks,
              materials and learners is criterion 4j, assessed from the plan
              and moderated from the portfolio, so the evidence cannot
              vanish at the moment of submitting. The tutor's view and the
              PDF always showed it; only the candidate's own did not.
              Ramy, 12 Sep 2026. */}
          {(plan?.anticipated_problems ?? []).some((p) => p.problem || p.solution) ? (
            <div>
              <p className="text-sm text-muted">Anticipated Problems &amp; Solutions</p>
              <ul className="mt-1 flex flex-col gap-1.5">
                {(plan?.anticipated_problems ?? []).map((p, i) =>
                  p.problem || p.solution ? (
                    <li key={i} className="text-sm text-ink">
                      <span className="whitespace-pre-line">{p.problem}</span>
                      {p.solution ? (
                        <span className="mt-0.5 block whitespace-pre-line text-muted">{p.solution}</span>
                      ) : null}
                    </li>
                  ) : null
                )}
              </ul>
            </div>
          ) : null}
          <ReadOnlyField label="Class Profile" value={plan?.class_profile} />
          <ReadOnlyField label="Materials" value={plan?.materials_description} />
          <div>
            <p className="text-sm text-muted">Procedure</p>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <colgroup>
                  <col className="w-[168px]" />
                  <col className="w-[92px]" />
                  <col className="w-[62px]" />
                  <col />
                </colgroup>
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
                          <p className="mt-1 text-xs italic text-muted">{row.aim}</p>
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
            <p className="mt-1.5 text-xs text-muted">
              {totalMinutes} of {TP_LESSON_LENGTH_MINUTES} min{overBy > 0 ? ` · Over by ${overBy} min` : ""}
            </p>
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
    // Ramy, 12 Sep 2026: "the top part -- main aims, problem solutions, class
    // profile -- could be side by side. But once you start the procedure, it
    // needs to be the full page. Need space for that." The three short cards
    // are written once and read at a glance; the procedure table is what a
    // candidate works on for hours, and it was living in a column beside them.
    <form id="plan" action={draftAction} className="scroll-mt-20 flex flex-col gap-4">
      <input type="hidden" name="tp_number" value={tpNumber} />

      <div className="flex items-center justify-between">
        <h2 className="font-serif text-lg text-ink">Your lesson plan</h2>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 xl:items-start">
        <div className="card rounded-[9px] flex flex-col gap-4 p-5">
          <Field label="Main Aims" hint="What the learners will be able to do by the end.">
            <textarea
              name="main_aims"
              rows={3}
              defaultValue={plan?.main_aims ?? ""}
              data-dictate-label="Main Aims"
              className={inputClass}
              {...bulletListProps}
            />
          </Field>
          <Field label="Subsidiary Aims" hint="What else the lesson develops along the way.">
            <textarea
              name="subsidiary_aims"
              rows={3}
              defaultValue={plan?.subsidiary_aims ?? ""}
              data-dictate-label="Subsidiary Aims"
              className={inputClass}
              {...bulletListProps}
            />
          </Field>
          <Field label="Personal Aims" hint="Take these from the action points in your last feedback.">
            <textarea
              ref={personalAimsRef}
              name="personal_aims"
              rows={3}
              defaultValue={plan?.personal_aims ?? ""}
              data-dictate-label="Personal Aims"
              className={inputClass}
              {...bulletListProps}
            />
          </Field>
          {previousPlanningActionPoint ? (
            <button
              type="button"
              onClick={useCarriedPersonalAim}
              className="flex items-start gap-2 rounded-[6px] border border-status-warning-text/40 bg-status-warning-bg p-2.5 text-left"
            >
              <span className="mt-0.5 shrink-0 text-xs text-status-warning-text">★</span>
              <span className="text-xs leading-relaxed text-ink">
                From TP{tpNumber - 1}: {previousPlanningActionPoint}
                <span className="ml-1.5 font-semibold text-primary">Tap to use it.</span>
              </span>
            </button>
          ) : null}
        </div>

        <div className="card rounded-[9px] p-5">
          <label className="text-sm text-muted">Anticipated Problems &amp; Solutions</label>
          <p className="text-xs italic text-muted">
            Problems with tasks and materials, technology, classroom management, interaction patterns (NOT
            language).
          </p>
          <div className="mt-2 flex flex-col gap-3">
            {[1, 2, 3].map((n) => {
              const existing = plan?.anticipated_problems?.[n - 1];
              return (
                <div key={n} className="flex flex-col gap-1.5 border-b border-dashed border-border-faint pb-2.5 last:border-b-0 last:pb-0">
                  <textarea
                    name={`problem_${n}`}
                    rows={2}
                    defaultValue={existing?.problem ?? ""}
                    placeholder={`Problem #${n}`}
                    data-dictate-label={`Problem #${n}`}
                    className={inputClass}
                    {...bulletListProps}
                  />
                  <textarea
                    name={`solution_${n}`}
                    rows={2}
                    defaultValue={existing?.solution ?? ""}
                    placeholder="Solution"
                    data-dictate-label={`Solution #${n}`}
                    {...bulletListProps}
                    className={`${inputClass} ml-3.5`}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="card rounded-[9px] flex flex-col gap-4 p-5 md:col-span-2 xl:col-span-1">
          <Field label="Class Profile" hint="Who you are teaching -- two or three lines is enough.">
            <textarea
              name="class_profile"
              rows={3}
              defaultValue={plan?.class_profile ?? ""}
              data-dictate-label="Class Profile"
              className={inputClass}
            />
          </Field>
          <Field label="Materials" hint="Everything you and the learners will need, including where it came from.">
            <textarea
              name="materials_description"
              rows={3}
              defaultValue={plan?.materials_description ?? ""}
              data-dictate-label="Materials"
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      <input type="hidden" name="framework_used" value={frameworkName} />
      {showShapes ? (
        <div className="card rounded-[9px] flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <h3 className="font-serif text-base text-ink">Lesson shape</h3>
            <p className="text-xs text-muted">
              Choosing a shape names the stages for you. The stage aims are yours to write.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-48">
              <FrameworkPicker value={frameworkName} onChange={setFrameworkName} />
            </div>
            <button
              type="button"
              onClick={applyFramework}
              className="rounded-[6px] border border-border px-3 py-1.5 text-sm text-ink trainee-hover-fill"
            >
              Fill in the stages
            </button>
            <button
              type="button"
              onClick={clearStages}
              className="rounded-[6px] border border-border px-3 py-1.5 text-sm text-muted trainee-hover-fill"
            >
              Clear
            </button>
            {scaffoldedByDefault ? null : (
              <button
                type="button"
                onClick={() => setShowShapes(false)}
                className="text-xs text-muted hover:text-ink"
              >
                Hide
              </button>
            )}
          </div>
        </div>
      ) : (
        // Scaffolding fades: by TP5 a candidate stages their own lesson. Still
        // one click away, because nothing the system decides is final.
        <button
          type="button"
          onClick={() => setShowShapes(true)}
          className="self-start text-xs text-muted underline-offset-4 hover:text-ink hover:underline"
        >
          Show lesson shapes
        </button>
      )}

      <div className="card rounded-[9px] p-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="font-serif text-lg text-ink">Lesson Procedure</h2>
            <p className="text-xs italic text-muted">Write the procedure in short bullet points -- one action per line.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            <span className="font-serif text-xl leading-none text-ink">{totalMinutes}</span>
            <span className="text-xs text-muted">of {TP_LESSON_LENGTH_MINUTES} min</span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                overBy > 0 ? "bg-status-warning-bg text-status-warning-text" : "bg-status-neutral-bg text-ink"
              }`}
            >
              <span className="size-1 rounded-full bg-current" />
              {overBy > 0 ? `Over by ${overBy} min` : "Fits"}
            </span>
          </div>
        </div>
        <input type="hidden" name="procedure" value={JSON.stringify(procedure)} />
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse text-sm">
            <colgroup>
              <col className="w-[200px]" />
              <col className="w-[104px]" />
              <col className="w-[68px]" />
              <col />
              <col className="w-[30px]" />
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
                <tr key={i} className="group even:bg-background">
                  <td className="border-b border-border-faint p-1.5 align-top">
                    <textarea
                      rows={2}
                      value={row.stage}
                      onChange={(e) => updateProcedureRow(i, { stage: e.target.value })}
                      data-dictate-label={`Stage ${i + 1}`}
                      className={`${inputClass} resize-none`}
                    />
                    <textarea
                      rows={2}
                      value={row.aim}
                      onChange={(e) => updateProcedureRow(i, { aim: e.target.value })}
                      placeholder={aimHints[i] || "Stage aim"}
                      data-dictate-label={`Stage ${i + 1} aim`}
                      className="mt-1 w-full resize-none bg-transparent text-xs italic text-muted outline-none placeholder:text-muted/70"
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
                      data-dictate-label={`Stage ${i + 1} procedure`}
                      className={inputClass}
                      {...bulletListProps}
                    />
                  </td>
                  <td className="border-b border-border-faint p-1.5 align-top">
                    <button
                      type="button"
                      onClick={() => removeProcedureRow(i)}
                      className="text-destructive opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
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
        <div className="mt-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={addProcedureRow}
            className="rounded-[6px] border border-border px-3 py-1.5 text-sm text-ink trainee-hover-fill"
          >
            + Add stage
          </button>
          <span className="text-xs text-muted">Interaction patterns and the phonemic keyboard open from the cell.</span>
        </div>
      </div>

      <input type="hidden" name="la_type" value={laType} />
      <input type="hidden" name="la_main_aim" value={laMainAim ? "Yes" : "No"} />
      <input type="hidden" name="la_context" value={laContext} />
      <input type="hidden" name="la_blocks" value={JSON.stringify(laBlocks)} />
      <input type="hidden" name="la_vocab_rows" value={JSON.stringify(laVocabRows)} />
      <input type="hidden" name="la_vocab_reference" value={laVocabReference} />
      <input type="hidden" name="la_has_content" value={laHasContent ? "1" : "0"} />

      <div id="analysis" className="scroll-mt-20">
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
      </div>

      <FormSubmitBar
        raiseForMobileNav
        leading={<DictateAnywhere scopeId="plan" />}
        warning="Submitting locks this lesson plan -- you won't be able to edit it afterwards."
        draftPending={draftPending}
        submitPending={submitPending}
        onSubmitAction={submitActionFn}
        submitLabel="Submit lesson plan"
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

function ReadOnlyField({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-sm text-muted">{label}</p>
      <p className="whitespace-pre-line text-ink">{value}</p>
    </div>
  );
}
