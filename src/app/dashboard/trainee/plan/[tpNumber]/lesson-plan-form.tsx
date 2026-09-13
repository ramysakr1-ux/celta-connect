"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  saveLessonPlanDraft,
  submitLessonPlan,
  type FormState,
} from "@/app/dashboard/trainee/plan/[tpNumber]/actions";
import { LanguageAnalysisEditor } from "@/app/dashboard/trainee/plan/[tpNumber]/language-analysis-editor";
import { DictateButton, DictationScope, WakeWordToggle } from "@/components/dictate-anywhere";
import { bulletListProps } from "@/lib/bullet-list";
import { autosizeOnInput, useAutosize } from "@/lib/autosize";
import { offersLessonSequences } from "@/lib/tp-density";
import {
  INTERACTION_PATTERNS,
  LESSON_FRAMEWORKS,
  TP_LESSON_LENGTH_MINUTES,
  emptyAnalysisBlock,
  normalizeFrameworkName,
  sumProcedureMinutes,
  timeValue,
  type AnalysisBlock,
  type LanguageAnalysisType,
  type PlanProcedureRow,
  type ProblemSolutionPair,
  type VocabRow,
} from "@/lib/tp-plan-content";
import type { Database } from "@/lib/supabase/types";

type TpPlan = Database["public"]["Tables"]["tp_plans"]["Row"];
type TpLanguageAnalysis = Database["public"]["Tables"]["tp_language_analyses"]["Row"];

// design_handoff_trainee_lesson_plan (v3), 13 Sep 2026.
//
// The old form was a stack of cards in two columns. This reads as ONE CELTA
// plan document: a dark identity band, a sequence + time-budget strip, the three
// aims across the top, the procedure as a numbered colour-coded timeline, the
// problems and the room at the foot, the language analysis sheet unfolding
// below.
//
// Colour is load-bearing -- it is how a trainee reads the plan at a glance,
// and the handoff's colour map is deliberate:
//   teal      the teacher sets up / structure
//   gold-ink  language work, and warnings
//   ink-warm  reading / receptive work
//   garnet    learners produce, and risk
//   muted     feedback / close, and everything not yet written
// A stage with nothing written in it is drawn in faint: hollow dot, faint
// spine, faint bar segment, dashed chip. The colour arrives as the trainee
// writes, which is the point of it.
//
// NEUTRALS come from the CSS tokens, not from the handoff's literals, even
// though the two agree: --color-card IS oklch(96.4% 0.014 85), --color-border
// IS oklch(88% 0.016 82), and so on down the ladder. Going through the tokens
// keeps the candidate's own page palette alive (five papers, chosen from their
// avatar); hardcoding the linen values would freeze this one page on linen
// while every page around it shifted hue.
//
// The named HUES below are the exception -- the handoff says not to substitute
// or approximate them, and they carry meaning rather than depth.

const SHEET = "oklch(99.2% 0.005 90)";
const TEAL = "var(--color-primary)";
const GOLD_INK = "oklch(44% 0.095 68)";
const INK_WARM = "var(--color-ink-warm)";
const GARNET = "var(--color-garnet)";
const MUTED = "var(--color-muted)";
const FAINT = "var(--color-border-faint)";
const BORDER = "var(--color-border)";
const CARD = "var(--color-card)";
const INK = "var(--color-ink)";
const BAND_GOLD_EYEBROW = "oklch(79% 0.06 78)";
const BAND_TEXT = "oklch(98.5% 0.006 90)";

// §4a -- the sequence a CELTA lesson actually moves through: set up, clarify,
// read, read, produce, close, and round again.
const STAGE_HUES = [TEAL, GOLD_INK, INK_WARM, INK_WARM, GARNET, MUTED, TEAL];

const initialState: FormState = { error: null };

function emptyProcedureRow(): PlanProcedureRow {
  return { stage: "", aim: "", procedure: "", interaction: "", time: "" };
}

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
  lessonTitle = null,
  lessonWhen = null,
  level = null,
  learners = null,
}: {
  tpNumber: number;
  plan: TpPlan | null;
  languageAnalysis: TpLanguageAnalysis | null;
  /** Starred planning action point from the previous TP's feedback, if any. */
  previousPlanningActionPoint?: string | null;
  /** The brief's main aim -- the identity band's title. */
  lessonTitle?: string | null;
  /** "Monday 10:00", already formatted in the centre's zone. */
  lessonWhen?: string | null;
  /** The class level, e.g. "B1+". */
  level?: string | null;
  /**
   * How many learners are expected, and how many are on the register.
   * Ramy, 13 Sep 2026 -- it was on the page header only, and the moment it
   * matters is while you are writing the class profile and deciding how many
   * handouts to print.
   */
  learners?: { expected: number; total: number } | null;
}) {
  const locked = Boolean(plan?.submitted_at);
  const [draftState, draftAction, draftPending] = useActionState(saveLessonPlanDraft, initialState);
  const [submitState, submitActionFn, submitPending] = useActionState(submitLessonPlan, initialState);
  const autosize = useAutosize();

  const [procedure, setProcedure] = useState<PlanProcedureRow[]>(
    plan?.procedure && plan.procedure.length > 0
      ? plan.procedure
      : [{ ...emptyProcedureRow(), stage: "Lead-in" }, ...Array.from({ length: 4 }, emptyProcedureRow)]
  );
  const [frameworkName, setFrameworkName] = useState(normalizeFrameworkName(plan?.framework_used));
  // The chosen sequence's aim for each stage, shown as PLACEHOLDER text in the
  // empty aim box -- never written into the plan. Ramy, 12 Sep 2026: "choosing
  // the framework is kind of cheating a bit, because it tells them the stage
  // aims... they should at least write that part." The v3 handoff was drawn
  // from the form as it stood before that ruling, and still has applyFramework
  // filling the aims in. His ruling is the newer decision, so it stands.
  const [aimHints, setAimHints] = useState<string[]>([]);
  const [sequenceMenuOpen, setSequenceMenuOpen] = useState(false);
  // Hidden from TP7, but never hidden when a sequence is ALREADY chosen: the
  // stage hues in the timeline come from it, and a colour with no visible
  // cause is worse than the picker being there.
  const [showSequences, setShowSequences] = useState(
    offersLessonSequences(tpNumber) || Boolean(normalizeFrameworkName(plan?.framework_used))
  );
  const personalAimsRef = useRef<HTMLTextAreaElement | null>(null);

  const [problems, setProblems] = useState<ProblemSolutionPair[]>(() => {
    const existing = (plan?.anticipated_problems ?? []).filter((p) => p.problem || p.solution);
    return existing.length > 0 ? existing : [{ problem: "", solution: "" }, { problem: "", solution: "" }];
  });

  const [laOpen, setLaOpen] = useState(
    Boolean(
      languageAnalysis &&
        (languageAnalysis.context || languageAnalysis.blocks.length > 0 || languageAnalysis.vocab_rows.length > 0)
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

  // A stage takes its hue once it has a NAME -- whether the name came from a
  // sequence or the candidate typed it. Grey only while the stage is unnamed.
  //
  // The handoff greys everything until a sequence is chosen, which was right
  // when the picker was always there. It is not right now: Ramy set the
  // picker to TP1-6, so on TP7 and TP8 -- where the candidate names their own
  // stages, which is the whole point of the fade -- the timeline could never
  // take a colour at all. "It feels like the page completely lost all the
  // colours in it... it's all washed" (13 Sep 2026). Naming a stage IS
  // choosing a sequence; the candidate just wrote it themselves.
  const hueFor = (i: number) =>
    frameworkName || procedure[i]?.stage.trim() ? STAGE_HUES[i % STAGE_HUES.length] : BORDER;

  function applyFramework(name: string) {
    setFrameworkName(name);
    setSequenceMenuOpen(false);
    if (!name) {
      setProcedure(procedure.map((row) => ({ ...row, stage: "", aim: "" })));
      setAimHints([]);
      return;
    }
    const framework = LESSON_FRAMEWORKS.find((f) => f.name === name);
    if (!framework) return;
    // Stages past the end of the sequence are KEPT, with everything typed in them.
    const extra = procedure.slice(framework.stages.length);
    setProcedure([
      ...framework.stages.map((stage, i) => ({ ...(procedure[i] ?? emptyProcedureRow()), stage: stage.name })),
      ...extra,
    ]);
    setAimHints([...framework.stages.map((s) => s.aim), ...extra.map(() => "")]);
  }

  function updateRow(index: number, patch: Partial<PlanProcedureRow>) {
    setProcedure(procedure.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function useCarriedPersonalAim() {
    const textarea = personalAimsRef.current;
    if (!textarea || !previousPlanningActionPoint) return;
    const joined = textarea.value.trim()
      ? `${textarea.value.trim()}\n• ${previousPlanningActionPoint}`
      : `• ${previousPlanningActionPoint}`;
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
      <LockedPlan
        plan={plan!}
        procedure={procedure}
        totalMinutes={totalMinutes}
        overBy={overBy}
        languageAnalysis={languageAnalysis}
      />
    );
  }

  const learnerLine = learners
    ? learners.expected === learners.total
      ? `${learners.total} ${learners.total === 1 ? "learner" : "learners"}`
      : `${learners.expected} of ${learners.total} learners coming`
    : null;
  const eyebrow = [
    `Teaching Practice ${tpNumber}`,
    lessonWhen,
    level,
    learnerLine,
    `${TP_LESSON_LENGTH_MINUTES} minutes`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <DictationScope scopeId="plan">
      <form id="plan" action={draftAction} className="scroll-mt-20">
        <input type="hidden" name="tp_number" value={tpNumber} />
        <input type="hidden" name="framework_used" value={frameworkName} />
        <input type="hidden" name="procedure" value={JSON.stringify(procedure)} />
        {[0, 1, 2].map((i) => (
          <span key={i}>
            <input type="hidden" name={`problem_${i + 1}`} value={problems[i]?.problem ?? ""} />
            <input type="hidden" name={`solution_${i + 1}`} value={problems[i]?.solution ?? ""} />
          </span>
        ))}

        {/* The sheet sits on a ground one step darker than the app's, so it
            reads as paper on a desk. Derived from the palette rather than the
            handoff's literal oklch(88% 0.03 78), so a candidate who has chosen
            Sky or Sage still gets their own paper here. */}
        <div
          className="rounded-[14px] p-3 sm:p-5"
          style={{ background: "color-mix(in oklab, var(--color-background) 84%, var(--color-ink) 7%)" }}
        >
          <div
            className="mx-auto rounded-[14px]"
            style={{
              maxWidth: 1240,
              background: SHEET,
              boxShadow: "0 1px 2px oklch(23.5% 0.017 65 / 0.06), 0 18px 44px oklch(23.5% 0.017 65 / 0.12)",
            }}
          >
            {/* ---------- 1. Identity band ---------- */}
            <div
              className="flex flex-wrap items-end justify-between gap-6 rounded-t-[14px]"
              style={{ background: INK_WARM, padding: "18px 26px 16px" }}
            >
              <div className="flex min-w-0 flex-col gap-[3px]">
                <p
                  className="font-bold uppercase"
                  style={{ fontSize: 10.5, letterSpacing: "0.16em", color: BAND_GOLD_EYEBROW }}
                >
                  {eyebrow}
                </p>
                <h2 className="font-serif" style={{ fontSize: 29, fontWeight: 400, color: BAND_TEXT, lineHeight: 1.15 }}>
                  {lessonTitle || "Your lesson plan"}
                </h2>
              </div>
              <div className="flex items-center gap-2.5">
                <SaveStatus pending={draftPending || submitPending} savedAt={plan?.updated_at ?? null} />
                <DictateButton variant="header" />
              </div>
            </div>

            {/* ---------- 2. Lesson sequence + time budget ---------- */}
            <div
              className="flex flex-wrap items-center gap-[26px]"
              style={{ background: CARD, borderBottom: `1px solid ${FAINT}`, padding: "14px 26px" }}
            >
              {showSequences ? (
                <LessonSequencePicker value={frameworkName} open={sequenceMenuOpen} onOpenChange={setSequenceMenuOpen} onPick={applyFramework} />
              ) : (
                // TP7-8: the sequence is theirs to decide and to name. Ramy,
                // 13 Sep 2026 -- "only one to six". Still one click away,
                // because nothing the system decides is final.
                <div className="flex flex-col gap-1">
                  <p className="font-bold uppercase" style={{ fontSize: 10.5, letterSpacing: "0.12em", color: MUTED }}>
                    Lesson sequence
                  </p>
                  <button type="button" onClick={() => setShowSequences(true)} className="text-left" style={{ fontSize: 13, color: MUTED }}>
                    Yours to decide and to name —{" "}
                    <span style={{ color: TEAL, fontWeight: 600 }}>show the sequences anyway</span>
                  </button>
                </div>
              )}
              <TimeBudget procedure={procedure} total={totalMinutes} overBy={overBy} hueFor={hueFor} />
            </div>

            {/* ---------- 3. Aims ---------- */}
            <div className="grid grid-cols-1 md:grid-cols-3" style={{ borderBottom: `1px solid ${FAINT}` }}>
              <AimColumn
                label="Main aims"
                colour={TEAL}
                name="main_aims"
                defaultValue={plan?.main_aims ?? ""}
                placeholder="What the learners will be able to do by the end."
                autosize={autosize}
              />
              <AimColumn
                label="Subsidiary aims"
                colour={INK_WARM}
                name="subsidiary_aims"
                defaultValue={plan?.subsidiary_aims ?? ""}
                placeholder="What else the lesson develops along the way."
                autosize={autosize}
                bordered
              />
              <AimColumn
                label="Personal aims"
                colour={GOLD_INK}
                name="personal_aims"
                defaultValue={plan?.personal_aims ?? ""}
                placeholder="Take these from the action points in your last feedback."
                autosize={autosize}
                fieldRef={personalAimsRef}
                bordered
              >
                {previousPlanningActionPoint ? (
                  <button
                    type="button"
                    onClick={useCarriedPersonalAim}
                    className="mt-1 text-left"
                    style={{
                      borderRadius: 7,
                      borderLeft: "3px solid var(--color-gold)",
                      background: "oklch(94.5% 0.065 85)",
                      padding: "8px 10px",
                    }}
                  >
                    <span style={{ fontSize: 11, color: GOLD_INK }}>★ </span>
                    <span style={{ fontSize: 11.5, lineHeight: 1.5, color: INK }}>
                      {previousPlanningActionPoint} <span style={{ fontWeight: 700, color: TEAL }}>Tap to use it.</span>
                    </span>
                  </button>
                ) : null}
              </AimColumn>
            </div>

            {/* ---------- 4. Procedure ---------- */}
            <div style={{ padding: "20px 26px 22px" }}>
              <div className="flex flex-wrap items-baseline gap-3">
                <h3 className="font-serif" style={{ fontSize: 21, fontWeight: 600, color: INK_WARM }}>
                  Procedure
                </h3>
                <p className="italic" style={{ fontSize: 11.5, color: MUTED }}>
                  {frameworkName
                    ? "One action per line. Tap a stage name to rename it."
                    : "No sequence chosen — the stages are yours to name."}
                </p>
              </div>

              <div className="mt-2">
                {procedure.map((row, i) => (
                  <StageRow
                    key={i}
                    index={i}
                    row={row}
                    hue={hueFor(i)}
                    aimHint={aimHints[i] ?? ""}
                    isFirst={i === 0}
                    isLast={i === procedure.length - 1}
                    autosize={autosize}
                    onChange={(patch) => updateRow(i, patch)}
                    onRemove={() => {
                      setProcedure(procedure.filter((_, x) => x !== i));
                      setAimHints(aimHints.filter((_, x) => x !== i));
                    }}
                  />
                ))}
              </div>

              <div style={{ borderTop: `1px solid ${FAINT}`, paddingTop: 12 }}>
                <button
                  type="button"
                  onClick={() => {
                    setProcedure([...procedure, emptyProcedureRow()]);
                    setAimHints([...aimHints, ""]);
                  }}
                  className="rounded-full"
                  style={{ border: `1px dashed ${BORDER}`, padding: "7px 16px", fontSize: 13, color: MUTED }}
                >
                  + Add stage
                </button>
              </div>
            </div>

            {/* ---------- 5. Foot band ---------- */}
            <div
              className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]"
              style={{ borderTop: `1px solid ${FAINT}`, background: CARD }}
            >
              <div className="flex flex-col gap-3" style={{ padding: "18px 22px 22px 26px" }}>
                <MarkerLabel colour={GARNET} label="Anticipated problems & solutions" />
                <p className="italic" style={{ fontSize: 11.5, color: MUTED, marginLeft: 12 }}>
                  Tasks and materials, technology, classroom management, interaction patterns — not language.
                </p>
                <div className="flex flex-col">
                  {problems.map((p, i) => (
                    <div
                      key={i}
                      className="grid items-start gap-2"
                      style={{
                        gridTemplateColumns: "18px minmax(0,1fr) 18px minmax(0,1fr)",
                        borderTop: i > 0 ? `1px dashed ${FAINT}` : undefined,
                        paddingTop: i > 0 ? 10 : 0,
                        marginTop: i > 0 ? 10 : 0,
                      }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 700, color: GARNET, paddingTop: 4 }}>{i + 1}</span>
                      <textarea
                        ref={autosize}
                        rows={1}
                        value={p.problem}
                        data-dictate-label={`Problem ${i + 1}`}
                        placeholder="What could go wrong?"
                        onInput={autosizeOnInput}
                        onChange={(e) => setProblems(problems.map((x, n) => (n === i ? { ...x, problem: e.target.value } : x)))}
                        {...bulletListProps}
                        style={fieldStyle(13, INK)}
                      />
                      <span style={{ fontSize: 12, color: TEAL, paddingTop: 3 }}>→</span>
                      <textarea
                        ref={autosize}
                        rows={1}
                        value={p.solution}
                        data-dictate-label={`Solution ${i + 1}`}
                        placeholder="What you'll do about it"
                        onInput={autosizeOnInput}
                        onChange={(e) => setProblems(problems.map((x, n) => (n === i ? { ...x, solution: e.target.value } : x)))}
                        {...bulletListProps}
                        style={fieldStyle(13, INK_WARM)}
                      />
                    </div>
                  ))}
                </div>
                {problems.length < 3 ? (
                  <button
                    type="button"
                    onClick={() => setProblems([...problems, { problem: "", solution: "" }])}
                    className="self-start"
                    style={{ fontSize: 12.5, color: TEAL }}
                  >
                    + Add another
                  </button>
                ) : null}
              </div>

              <div className="flex flex-col gap-3.5" style={{ borderLeft: `1px solid ${FAINT}`, padding: "18px 26px 22px 22px" }}>
                <div className="flex flex-col gap-1.5">
                  <MarkerLabel colour={TEAL} label="Class profile" />
                  <textarea
                    ref={autosize}
                    name="class_profile"
                    rows={1}
                    defaultValue={plan?.class_profile ?? ""}
                    data-dictate-label="Class profile"
                    placeholder="Who you are teaching — two or three lines is enough."
                    onInput={autosizeOnInput}
                    {...bulletListProps}
                    style={{ ...fieldStyle(13, INK), marginLeft: 12, lineHeight: 1.55 }}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <MarkerLabel colour={TEAL} label="Materials" />
                  <textarea
                    ref={autosize}
                    name="materials_description"
                    rows={1}
                    defaultValue={plan?.materials_description ?? ""}
                    data-dictate-label="Materials"
                    placeholder="Everything you and the learners will need, and where it came from."
                    onInput={autosizeOnInput}
                    {...bulletListProps}
                    style={{ ...fieldStyle(13, INK), marginLeft: 12, lineHeight: 1.55 }}
                  />
                </div>

              </div>
            </div>

            {/* ---------- 6. Language analysis ---------- */}
            <input type="hidden" name="la_type" value={laType} />
            <input type="hidden" name="la_main_aim" value={laMainAim ? "Yes" : "No"} />
            <input type="hidden" name="la_context" value={laContext} />
            <input type="hidden" name="la_blocks" value={JSON.stringify(laBlocks)} />
            <input type="hidden" name="la_vocab_rows" value={JSON.stringify(laVocabRows)} />
            <input type="hidden" name="la_vocab_reference" value={laVocabReference} />
            <input type="hidden" name="la_has_content" value={laHasContent ? "1" : "0"} />
          </div>
        </div>

        {/* Ramy, 13 Sep 2026: "I also like our LA sheet. I wonder if we should
            keep our old LA sheet. Just change the rest." So it is untouched --
            its own card, its own "Optional -- click to add" header, below the
            plan rather than as a band inside it. The v3 handoff had it
            unfolding as the sheet's last band with the door in the foot band;
            that door is gone rather than doubled (one room, one door). */}
        <div id="analysis" className="mt-4 scroll-mt-20">
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

        {/* ---------- 7. Bottom bar ----------
            The handoff fixes this to the viewport. Sticky instead, and only
            that: the plan is one section of the TP page, not the whole page,
            so a viewport-fixed bar would sit over the materials and the
            self-evaluation below it for as long as the page was open. Sticky
            puts the same bar in the same place while the plan is on screen and
            releases it when the reader scrolls past. */}
        <div
          className="sticky bottom-40 z-20 mt-3 flex flex-wrap items-center justify-between gap-3 md:bottom-4"
          style={{
            border: "1px solid oklch(83% 0.028 78)",
            borderRadius: 10,
            background: "color-mix(in oklab, var(--color-card-inset) 94%, transparent)",
            backdropFilter: "blur(6px)",
            padding: "11px 24px",
          }}
        >
          <div className="flex items-center gap-2">
            <span className="size-[5px] shrink-0 rounded-full" style={{ background: GOLD_INK }} />
            <p style={{ fontSize: 11.5, color: GOLD_INK }}>
              Submitting locks this lesson plan — you won&apos;t be able to edit it afterwards.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
            <span className="mr-2 flex flex-wrap items-center gap-2">
              <DictateButton variant="bar" />
              {/* Candidates get it too, Ramy 13 Sep 2026. The limits that
                  bounded it tutor-side were about recording other people's
                  learners mid-lesson; a candidate writing their plan is
                  recording nobody. Same rules all the same: off by default,
                  armed from this screen, visibly red while open. */}
              <WakeWordToggle />
            </span>
            <button
              type="submit"
              disabled={draftPending || submitPending}
              style={{
                borderRadius: 8,
                border: "1px solid oklch(83% 0.028 78)",
                background: SHEET,
                padding: "8px 15px",
                fontSize: 13.5,
                color: INK,
              }}
            >
              {draftPending ? "Saving…" : "Save draft"}
            </button>
            <button
              type="submit"
              formAction={submitActionFn}
              disabled={draftPending || submitPending}
              style={{
                borderRadius: 8,
                background: TEAL,
                padding: "8px 17px",
                fontWeight: 600,
                fontSize: 13.5,
                color: BAND_TEXT,
              }}
            >
              {submitPending ? "Submitting…" : "Submit lesson plan"}
            </button>
          </div>
        </div>
      </form>
    </DictationScope>
  );
}

// ---------------------------------------------------------------- pieces

function fieldStyle(size: number, colour: string): React.CSSProperties {
  return {
    width: "100%",
    boxSizing: "border-box",
    border: "none",
    background: "transparent",
    padding: 0,
    fontSize: size,
    lineHeight: 1.5,
    color: colour,
    outline: "none",
    resize: "none",
    overflowY: "hidden",
    minHeight: "1.5em",
  };
}

function MarkerLabel({ colour, label }: { colour: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ width: 3, height: 12, borderRadius: 2, background: colour, display: "inline-block" }} />
      <span className="uppercase" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: colour }}>
        {label}
      </span>
    </div>
  );
}

function SaveStatus({ pending, savedAt }: { pending: boolean; savedAt: string | null }) {
  const [label, setLabel] = useState("Draft");
  useEffect(() => {
    if (!savedAt) return;
    const tick = () => {
      const seconds = Math.max(0, Math.round((Date.now() - new Date(savedAt).getTime()) / 1000));
      setLabel(
        seconds < 60
          ? "Draft · saved just now"
          : seconds < 3600
            ? `Draft · saved ${Math.round(seconds / 60)} min ago`
            : seconds < 86400
              ? `Draft · saved ${Math.round(seconds / 3600)} h ago`
              : `Draft · saved ${Math.round(seconds / 86400)} d ago`
      );
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [savedAt]);

  return (
    <span className="flex items-center gap-1.5" style={{ fontSize: 11.5, color: "oklch(82% 0.03 78)" }}>
      <span className="size-[5px] rounded-full" style={{ background: "oklch(75% 0.13 80)" }} />
      {pending ? "Saving…" : label}
    </span>
  );
}

function LessonSequencePicker({
  value,
  open,
  onOpenChange,
  onPick,
}: {
  value: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (name: string) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) onOpenChange(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onOpenChange(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  const chosen = Boolean(value);
  return (
    <div ref={wrap} className="relative flex flex-col gap-1">
      <p className="font-bold uppercase" style={{ fontSize: 10.5, letterSpacing: "0.12em", color: MUTED }}>
        Lesson sequence
      </p>
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="inline-flex items-center gap-2"
        style={{
          borderRadius: 8,
          padding: "7px 14px",
          fontWeight: 600,
          fontSize: 13.5,
          border: chosen ? `1px solid color-mix(in oklab, ${TEAL} 35%, transparent)` : `1px solid ${BORDER}`,
          background: chosen ? `color-mix(in oklab, ${TEAL} 9%, transparent)` : SHEET,
          color: chosen ? TEAL : MUTED,
        }}
      >
        {value || "Choose a lesson sequence"}
        <span style={{ fontSize: 9, opacity: 0.65 }}>▼</span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute"
          style={{
            zIndex: 50,
            top: "calc(100% + 8px)",
            left: 0,
            width: 356,
            borderRadius: 11,
            border: `1px solid ${MUTED}`,
            background: SHEET,
            boxShadow: "0 20px 50px oklch(23.5% 0.017 65 / 0.28)",
            padding: 7,
          }}
        >
          <SequenceItem label="No sequence chosen" meta="clears the names" selected={!value} onClick={() => onPick("")} />
          <div style={{ borderTop: `1px solid ${FAINT}`, margin: "3px 0" }} />
          {LESSON_FRAMEWORKS.map((f) => (
            <SequenceItem
              key={f.key}
              label={f.name}
              meta={`${f.stages.length} stages`}
              selected={value === f.name}
              onClick={() => onPick(f.name)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SequenceItem({
  label,
  meta,
  selected,
  onClick,
}: {
  label: string;
  meta: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-baseline justify-between gap-3 text-left transition-colors hover:bg-card-inset"
      style={{
        borderRadius: 8,
        padding: "9px 11px",
        fontSize: 13,
        fontWeight: selected ? 700 : 500,
        color: selected ? TEAL : INK,
        background: selected ? `color-mix(in oklab, ${TEAL} 10%, transparent)` : undefined,
      }}
    >
      <span>{label}</span>
      <span style={{ fontSize: 11, color: MUTED }}>{meta}</span>
    </button>
  );
}

function TimeBudget({
  procedure,
  total,
  overBy,
  hueFor,
}: {
  procedure: PlanProcedureRow[];
  total: number;
  overBy: number;
  hueFor: (i: number) => string;
}) {
  const spare = -overBy;
  return (
    <div className="flex flex-col gap-1.5" style={{ flex: 1, minWidth: 280 }}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-bold uppercase" style={{ fontSize: 10.5, letterSpacing: "0.12em", color: MUTED }}>
          Time budget
        </p>
        <p className="flex-none whitespace-nowrap" style={{ fontSize: 12, color: MUTED }}>
          <span className="font-serif tabular-nums" style={{ fontSize: 18, color: INK }}>
            {total}
          </span>{" "}
          of {TP_LESSON_LENGTH_MINUTES} min ·{" "}
          <span style={{ fontWeight: 600, color: overBy > 0 ? GOLD_INK : TEAL }}>
            {overBy > 0 ? `over by ${overBy} min` : overBy === 0 ? "fits exactly" : `${spare} min spare`}
          </span>
        </p>
      </div>
      <div className="flex gap-[2px]" style={{ height: 10 }}>
        {procedure.map((row, i) => {
          const minutes = timeValue(row.time);
          const written = Boolean(row.procedure.trim());
          return (
            <span
              key={i}
              title={`${row.stage || `Stage ${i + 1}`} · ${minutes} min`}
              style={{ flex: Math.max(1, minutes), borderRadius: 3, background: written ? hueFor(i) : FAINT }}
            />
          );
        })}
        {spare > 0 ? <span style={{ flex: spare, borderRadius: 3, background: FAINT }} /> : null}
      </div>
    </div>
  );
}

function AimColumn({
  label,
  colour,
  name,
  defaultValue,
  placeholder,
  autosize,
  fieldRef,
  bordered = false,
  children,
}: {
  label: string;
  colour: string;
  name: string;
  defaultValue: string;
  placeholder: string;
  autosize: (el: HTMLTextAreaElement | null) => void;
  fieldRef?: React.MutableRefObject<HTMLTextAreaElement | null>;
  bordered?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col gap-1.5"
      style={{ padding: "16px 22px 18px", borderLeft: bordered ? `1px solid ${FAINT}` : undefined }}
    >
      <MarkerLabel colour={colour} label={label} />
      <textarea
        ref={(el) => {
          autosize(el);
          if (fieldRef) fieldRef.current = el;
        }}
        name={name}
        rows={1}
        defaultValue={defaultValue}
        placeholder={placeholder}
        data-dictate-label={label}
        onInput={autosizeOnInput}
        {...bulletListProps}
        style={{ ...fieldStyle(13.5, INK), lineHeight: 1.55 }}
      />
      {children}
    </div>
  );
}

function StageRow({
  index,
  row,
  hue,
  aimHint,
  isFirst,
  isLast,
  autosize,
  onChange,
  onRemove,
}: {
  index: number;
  row: PlanProcedureRow;
  hue: string;
  aimHint: string;
  isFirst: boolean;
  isLast: boolean;
  autosize: (el: HTMLTextAreaElement | null) => void;
  onChange: (patch: Partial<PlanProcedureRow>) => void;
  onRemove: () => void;
}) {
  const written = Boolean(row.procedure.trim());
  const spine = written ? hue : FAINT;
  const minutes = timeValue(row.time);
  const [menuOpen, setMenuOpen] = useState(false);
  const selected = row.interaction
    ? row.interaction
        .split(/[,+]/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  function toggleInteraction(code: string) {
    const next = selected.includes(code) ? selected.filter((c) => c !== code) : [...selected, code];
    onChange({ interaction: next.join(", ") });
  }

  return (
    <div
      className="group relative grid"
      style={{ gridTemplateColumns: "44px minmax(0,232px) minmax(0,1fr)", borderTop: `1px solid ${FAINT}` }}
    >
      {/* gutter: spine + numbered dot */}
      <div className="relative flex justify-center" style={{ padding: "16px 0 18px" }}>
        <span
          aria-hidden
          className="absolute"
          style={{
            width: 2,
            left: "calc(50% - 1px)",
            top: isFirst ? 16 : 0,
            bottom: isLast ? "calc(100% - 40px)" : 0,
            background: spine,
          }}
        />
        <span
          className="relative flex size-6 items-center justify-center rounded-full"
          style={{
            border: `2px solid ${hue}`,
            background: written ? hue : SHEET,
            color: written ? SHEET : MUTED,
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {index + 1}
        </span>
      </div>

      {/* stage name / aim / chips */}
      <div className="relative flex flex-col gap-[7px]" style={{ padding: "14px 18px 18px 0" }}>
        <textarea
          ref={autosize}
          rows={1}
          value={row.stage}
          placeholder="Name this stage"
          data-dictate-label={`Stage ${index + 1} name`}
          onInput={autosizeOnInput}
          onChange={(e) => onChange({ stage: e.target.value })}
          className="font-serif"
          style={{ ...fieldStyle(16, row.stage ? INK : MUTED), fontWeight: 600, lineHeight: 1.25 }}
        />
        {/* Ramy, 13 Sep 2026: "for the stage aim there should be a bullet
            point, so they understand that they're supposed to write there as
            well." The stage NAME is a name and stays plain; the aim is
            something they write, so it behaves like every other list field on
            the plan -- clicking into it seeds a bullet, and Enter starts the
            next one. On TP7 and TP8 there is no sequence to prefill either box,
            so this is the only thing telling them the row has two jobs. */}
        <textarea
          ref={autosize}
          rows={1}
          value={row.aim}
          placeholder={aimHint || "• What this stage is for"}
          data-dictate-label={`Stage ${index + 1} aim`}
          onInput={autosizeOnInput}
          onChange={(e) => onChange({ aim: e.target.value })}
          {...bulletListProps}
          style={{ ...fieldStyle(12.5, MUTED), fontStyle: "italic" }}
        />

        <div className="flex flex-wrap items-center gap-[5px]">
          <span
            className="inline-flex items-center"
            style={{
              borderRadius: 6,
              padding: "2px 4px",
              background: written ? `color-mix(in oklab, ${hue} 13%, transparent)` : CARD,
              color: written ? hue : MUTED,
            }}
          >
            <button
              type="button"
              onClick={() => onChange({ time: String(Math.max(0, minutes - 1)) })}
              style={{ fontSize: 13, opacity: 0.55, padding: "0 3px" }}
              aria-label="One minute less"
            >
              −
            </button>
            <span className="text-center tabular-nums" style={{ fontSize: 12.5, fontWeight: 700, minWidth: 30 }}>
              {row.time ? `${minutes}′` : "—′"}
            </span>
            <button
              type="button"
              onClick={() => onChange({ time: String(Math.min(60, minutes + 1)) })}
              style={{ fontSize: 13, opacity: 0.55, padding: "0 3px" }}
              aria-label="One minute more"
            >
              ＋
            </button>
          </span>

          {selected.map((code) => (
            <span
              key={code}
              style={{
                borderRadius: 6,
                border: `1px solid ${BORDER}`,
                background: CARD,
                padding: "2px 8px",
                fontWeight: 600,
                fontSize: 11.5,
                color: INK_WARM,
              }}
            >
              {code}
            </span>
          ))}

          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              borderRadius: 6,
              border: `1px dashed ${BORDER}`,
              padding: "2px 8px",
              fontWeight: 600,
              fontSize: 11.5,
              color: MUTED,
            }}
          >
            {selected.length === 0 ? "add interaction" : "edit"}
          </button>

          <button
            type="button"
            onClick={onRemove}
            title="Delete this stage"
            className="opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
            style={{ fontSize: 12, color: "var(--color-destructive)", marginLeft: 2 }}
          >
            ✕
          </button>
        </div>

        {menuOpen ? (
          <InteractionMenu selected={selected} onToggle={toggleInteraction} onClose={() => setMenuOpen(false)} />
        ) : null}
      </div>

      {/* the bullets */}
      <div style={{ borderLeft: `1px solid ${FAINT}`, padding: "14px 0 18px 20px" }}>
        <textarea
          ref={autosize}
          rows={1}
          value={row.procedure}
          placeholder="• What you and the learners will do — Enter starts the next bullet"
          data-dictate-label={`Stage ${index + 1} procedure`}
          onInput={autosizeOnInput}
          onChange={(e) => onChange({ procedure: e.target.value })}
          {...bulletListProps}
          style={{ ...fieldStyle(14, INK), lineHeight: 1.6, textWrap: "pretty" }}
        />
      </div>
    </div>
  );
}

function InteractionMenu({
  selected,
  onToggle,
  onClose,
}: {
  selected: string[];
  onToggle: (code: string) => void;
  onClose: () => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={wrap}
      className="absolute"
      style={{
        zIndex: 40,
        top: "calc(100% - 8px)",
        left: 0,
        width: 268,
        borderRadius: 10,
        border: `1px solid ${MUTED}`,
        background: SHEET,
        boxShadow: "0 18px 44px oklch(23.5% 0.017 65 / 0.3)",
        padding: 7,
      }}
    >
      <p
        className="uppercase"
        style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: TEAL, padding: "2px 9px 5px" }}
      >
        Tap to add or remove
      </p>
      {INTERACTION_PATTERNS.map((p) => {
        const on = selected.includes(p.code);
        return (
          <button
            key={p.code}
            type="button"
            onClick={() => onToggle(p.code)}
            className="flex w-full items-center gap-1.5 text-left transition-colors hover:bg-card-inset"
            style={{
              borderRadius: 7,
              padding: "7px 9px",
              fontSize: 12.5,
              fontWeight: on ? 700 : 400,
              color: on ? INK : INK_WARM,
              background: on ? `color-mix(in oklab, ${TEAL} 12%, transparent)` : undefined,
            }}
          >
            <span style={{ width: 14, fontSize: 12, color: TEAL }}>{on ? "✓" : ""}</span>
            {p.label}
          </button>
        );
      })}
      <div style={{ borderTop: `1px solid ${FAINT}`, marginTop: 4, paddingTop: 4 }}>
        <button
          type="button"
          onClick={onClose}
          className="w-full text-left"
          style={{ fontSize: 12, color: MUTED, padding: "4px 9px" }}
        >
          Done
        </button>
      </div>
    </div>
  );
}

// The submitted record. Deliberately not restyled: the handoff covers the
// EDITOR, and a locked plan is a different object -- nothing to fill in, and
// the tutor's view, the portfolio and the PDF each render it their own way.
function LockedPlan({
  plan,
  procedure,
  totalMinutes,
  overBy,
  languageAnalysis,
}: {
  plan: TpPlan;
  procedure: PlanProcedureRow[];
  totalMinutes: number;
  overBy: number;
  languageAnalysis: TpLanguageAnalysis | null;
}) {
  return (
    <div className="card rounded-[9px] p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-lg text-ink">Your lesson plan</h2>
        <span className="status-pill status-pill-on-track">Submitted — locked</span>
      </div>
      <p className="mt-1 text-sm text-muted">
        Submitted {plan.submitted_at ? formatSubmittedAt(plan.submitted_at) : ""}. This is now your record of the
        lesson — ask your trainer if it needs reopening.
      </p>
      <div className="mt-4 flex flex-col gap-4">
        <ReadOnlyField label="Main Aims" value={plan.main_aims} />
        <ReadOnlyField label="Subsidiary Aims" value={plan.subsidiary_aims} />
        <ReadOnlyField label="Personal Aims" value={plan.personal_aims} />
        {(plan.anticipated_problems ?? []).some((p) => p.problem || p.solution) ? (
          <div>
            <p className="text-sm text-muted">Anticipated Problems &amp; Solutions</p>
            <ul className="mt-1 flex flex-col gap-1.5">
              {(plan.anticipated_problems ?? []).map((p, i) =>
                p.problem || p.solution ? (
                  <li key={i} className="text-sm text-ink">
                    <span className="whitespace-pre-line">{p.problem}</span>
                    {p.solution ? <span className="mt-0.5 block whitespace-pre-line text-muted">{p.solution}</span> : null}
                  </li>
                ) : null
              )}
            </ul>
          </div>
        ) : null}
        <ReadOnlyField label="Class Profile" value={plan.class_profile} />
        <ReadOnlyField label="Materials" value={plan.materials_description} />
        <div>
          <p className="text-sm text-muted">Procedure</p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <colgroup>
                <col className="w-[200px]" />
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
                      {row.aim ? <p className="mt-1 text-xs italic text-muted">{row.aim}</p> : null}
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
                    <b>{row.item}</b> — {row.definition}
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

function ReadOnlyField({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-sm text-muted">{label}</p>
      <p className="whitespace-pre-line text-ink">{value}</p>
    </div>
  );
}
