"use client";

import { useActionState, useState } from "react";
import { saveFeedbackDraft, submitFeedback, type FormState } from "@/app/dashboard/trainer/trainees/[id]/tp/[tpNumber]/actions";
import { FeedbackPointEditor } from "@/app/dashboard/trainer/trainees/[id]/tp/[tpNumber]/feedback-point-editor";
import { PlanReview } from "@/app/dashboard/trainer/trainees/[id]/tp/[tpNumber]/plan-review";
import { deleteCaptureNote } from "@/app/trainer/(hub)/capture/actions";
import { TutorToneTextarea } from "@/components/tutor-tone-textarea";
import { DictationScope } from "@/components/dictate-anywhere";
import {
  BAND,
  BAR_BORDER,
  BORDER,
  BottomBar,
  CARD,
  DESTRUCTIVE,
  Eyebrow,
  FAINT,
  GARNET,
  GOLD_INK,
  IdentityBand,
  INK,
  INK_WARM,
  MUTED,
  SHEET,
  SaveDraftButton,
  SaveStatusPill,
  Strip,
  SubmitButton,
  TEAL,
  TpSheet,
  MarkerLabel,
  ZEBRA,
  ruledField,
} from "@/components/tp-sheet";
import { STANDARD_RATING_OPTIONS, CRITERIA_LABELS } from "@/lib/celta-criteria";
import { StandardRatingPill } from "@/lib/status-pill";
import type { AnalysisBlock, FeedbackPoint, PlanProcedureRow, ProblemSolutionPair, VocabRow } from "@/lib/tp-plan-content";
import type { Database } from "@/lib/supabase/types";

type TpFeedback = Database["public"]["Tables"]["tp_feedback"]["Row"];
type TpPlan = Database["public"]["Tables"]["tp_plans"]["Row"];
type TpLanguageAnalysis = Database["public"]["Tables"]["tp_language_analyses"]["Row"];
type SelfEvaluation = Database["public"]["Tables"]["tp_self_evaluations"]["Row"];
type CaptureNote = { id: string; text: string; criteria_codes: string[]; captured_at: string };

const initialState: FormState = { error: null };

const SELF_EVAL_QUOTE_FIELDS: { key: keyof SelfEvaluation; label: string }[] = [
  { key: "what_went_well", label: "What went to plan?" },
  { key: "what_not_as_planned", label: "What didn't go as planned" },
  { key: "next_tp_focus", label: "Focus for next TP" },
];

// design_handoff_tp_feedback_cycle §1, 13 Sep 2026.
//
// Tutor feedback in three steps under one form and one teal identity band --
// teal is the tutor's hue throughout the cycle, and its eyebrow, save status
// and Dictate fill are teal's own tints, not the plan's gold.
//
//   1 · Plan & LA   read the submitted plan, comment on any part of it;
//                   those notes ARE the planning points (plan-review.tsx)
//   2 · Lesson      captured notes, then Planning | Teaching
//   3 · Overall     grade, overall comment, comment on the self-evaluation
//
// Within a step the column hue says which half of the assessment you are in
// (Planning ink-warm, Teaching garnet) and the section hue says what kind of
// point it is (Strengths teal, Action points gold-ink). Save draft is on every
// step; Submit only on step 3, because submitting releases everything at once.

type Step = 1 | 2 | 3;

export function FeedbackForm({
  planId,
  traineeId,
  traineeName,
  tpNumber,
  feedback,
  plan = null,
  languageAnalysis = null,
  selfEvaluation,
  autoTagEnabled = true,
  toneAssistEnabled = false,
  captureNotes = [],
  lessonTitle = null,
  lessonWhen = null,
  level = null,
  glossary,
}: {
  planId: string;
  traineeId: string;
  traineeName?: string;
  tpNumber: number;
  feedback: TpFeedback | null;
  plan?: TpPlan | null;
  languageAnalysis?: TpLanguageAnalysis | null;
  selfEvaluation?: SelfEvaluation | null;
  autoTagEnabled?: boolean;
  toneAssistEnabled?: boolean;
  captureNotes?: CaptureNote[];
  lessonTitle?: string | null;
  lessonWhen?: string | null;
  level?: string | null;
  /** The centre's criteria glossary, edited from /centre/criteria-glossary. */
  glossary?: Record<string, string[]>;
}) {
  const locked = Boolean(feedback?.submitted_at);
  const [draftState, draftAction, draftPending] = useActionState(saveFeedbackDraft, initialState);
  const [submitState, submitActionFn, submitPending] = useActionState(submitFeedback, initialState);

  const [step, setStep] = useState<Step>(1);
  const [grade, setGrade] = useState(feedback?.grade ?? "");
  const [strengthsPlanning, setStrengthsPlanning] = useState<FeedbackPoint[]>(feedback?.strengths_planning ?? []);
  const [actionPointsPlanning, setActionPointsPlanning] = useState<FeedbackPoint[]>(feedback?.action_points_planning ?? []);
  const [strengthsTeaching, setStrengthsTeaching] = useState<FeedbackPoint[]>(feedback?.strengths_teaching ?? []);
  const [actionPointsTeaching, setActionPointsTeaching] = useState<FeedbackPoint[]>(feedback?.action_points_teaching ?? []);
  const [notes, setNotes] = useState<CaptureNote[]>(captureNotes);

  const state = submitPending ? submitState : draftState;

  function pullInNote(note: CaptureNote, target: (points: FeedbackPoint[]) => void, current: FeedbackPoint[]) {
    target([...current, { text: note.text, criteria_codes: note.criteria_codes, starred: false }]);
    setNotes((prev) => prev.filter((n) => n.id !== note.id));
    const fd = new FormData();
    fd.set("note_id", note.id);
    fd.set("trainee_id", traineeId);
    fd.set("tp_number", String(tpNumber));
    deleteCaptureNote(fd);
  }

  if (locked) {
    return (
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-serif" style={{ fontSize: 21, fontWeight: 600, color: TEAL }}>
            Tutor feedback
          </h2>
          <span className="status-pill status-pill-on-track">Submitted</span>
        </div>
        {feedback?.grade ? (
          <div className="mt-2">
            <StandardRatingPill rating={feedback.grade} />
          </div>
        ) : null}
      </div>
    );
  }

  const eyebrow = [`Teaching Practice ${tpNumber}`, lessonWhen, level, lessonTitle].filter(Boolean).join(" · ");

  return (
    <DictationScope scopeId="tutor-feedback">
      <form id="tutor-feedback" action={draftAction} className="scroll-mt-20">
        <input type="hidden" name="plan_id" value={planId} />
        <input type="hidden" name="trainee_id" value={traineeId} />
        <input type="hidden" name="tp_number" value={tpNumber} />
        <input type="hidden" name="grade" value={grade} />
        <input type="hidden" name="strengths_planning" value={JSON.stringify(strengthsPlanning)} />
        <input type="hidden" name="action_points_planning" value={JSON.stringify(actionPointsPlanning)} />
        <input type="hidden" name="strengths_teaching" value={JSON.stringify(strengthsTeaching)} />
        <input type="hidden" name="action_points_teaching" value={JSON.stringify(actionPointsTeaching)} />

        <TpSheet maxWidth={step === 1 ? 1360 : 1240}>
          <IdentityBand
            role="teal"
            eyebrow={eyebrow || `Teaching Practice ${tpNumber}`}
            title={
              step === 1 ? (
                <>
                  Tutor feedback <i style={{ color: BAND.teal.eyebrow }}>·</i> Plan review
                </>
              ) : (
                <>
                  Tutor feedback <i style={{ color: BAND.teal.eyebrow }}>for</i> {traineeName ?? "this candidate"}
                </>
              )
            }
            status={<SaveStatusPill role="teal" label={draftPending || submitPending ? "Saving…" : "Draft"} />}
            right={<StepSwitcher step={step} onChange={setStep} />}
          />

          {step === 1 ? (
            <PlanReview
              tpNumber={tpNumber}
              plan={plan}
              languageAnalysis={languageAnalysis}
              strengths={strengthsPlanning}
              actionPoints={actionPointsPlanning}
              onStrengthsChange={setStrengthsPlanning}
              onActionPointsChange={setActionPointsPlanning}
              autoTagEnabled={autoTagEnabled}
              glossary={glossary}
            />
          ) : null}

          {step === 2 ? (
            <>
              {notes.length > 0 ? (
                <div style={{ padding: "16px 26px 18px", borderBottom: `1px solid ${FAINT}` }}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <MarkerLabel colour={GOLD_INK} label="Captured during the lesson" />
                    <p className="italic" style={{ fontSize: 11.5, color: MUTED }}>
                      Pulling one in removes it from here and drops it, already tagged, into the section you choose.
                    </p>
                  </div>
                  <div
                    className="mt-2.5 grid gap-2.5"
                    style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}
                  >
                    {notes.map((note) => (
                      <div
                        key={note.id}
                        className="flex flex-col gap-1.5"
                        style={{ borderRadius: 9, border: `1px dashed ${BAR_BORDER}`, background: ZEBRA, padding: "11px 13px" }}
                      >
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="tabular-nums" style={{ fontSize: 11, color: MUTED }}>
                            {new Date(note.captured_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          {note.criteria_codes.map((code) => (
                            <span
                              key={code}
                              title={CRITERIA_LABELS[code] ?? ""}
                              style={{ borderRadius: 4, background: TEAL, padding: "1px 6px", fontSize: 10.5, fontWeight: 700, color: SHEET }}
                            >
                              {code}
                            </span>
                          ))}
                        </div>
                        <p style={{ fontSize: 13, lineHeight: 1.5, color: INK }}>{note.text}</p>
                        <div className="flex flex-wrap gap-1.5">
                          <PullButton colour={TEAL} label="+ Strength (teaching)" onClick={() => pullInNote(note, setStrengthsTeaching, strengthsTeaching)} />
                          <PullButton colour={GOLD_INK} label="+ Action point (teaching)" onClick={() => pullInNote(note, setActionPointsTeaching, actionPointsTeaching)} />
                          <PullButton colour={TEAL} label="+ Strength (planning)" onClick={() => pullInNote(note, setStrengthsPlanning, strengthsPlanning)} />
                          <PullButton colour={GOLD_INK} label="+ Action point (planning)" onClick={() => pullInNote(note, setActionPointsPlanning, actionPointsPlanning)} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-1 lg:grid-cols-2">
                <div style={{ borderRight: `1px solid ${FAINT}` }}>
                  <ColumnHead glyph="P" title="Planning" hue={INK_WARM} scopeNote="criteria 4a–4n" />
                  <FeedbackPointEditor
                    label="Strengths in planning"
                    guide="One point per line. Tag each with the planning criteria it shows."
                    points={strengthsPlanning}
                    onChange={setStrengthsPlanning}
                    scope="planning"
                    starable={false}
                    sectionHue={TEAL}
                    tpNumber={tpNumber}
                    autoTagEnabled={autoTagEnabled}
                    toneAssistEnabled={toneAssistEnabled}
                    glossary={glossary}
                  />
                  <FeedbackPointEditor
                    label="Action points in planning"
                    guide="Star the ones you want them to prioritise in the next TP — starred points carry into the Personal Aims of their next plan."
                    points={actionPointsPlanning}
                    onChange={setActionPointsPlanning}
                    scope="planning"
                    starable
                    sectionHue={GOLD_INK}
                    tpNumber={tpNumber}
                    autoTagEnabled={autoTagEnabled}
                    toneAssistEnabled={toneAssistEnabled}
                    glossary={glossary}
                  />
                </div>
                <div>
                  <ColumnHead glyph="T" title="Teaching" hue={GARNET} scopeNote="criteria 1–3, 5" />
                  <FeedbackPointEditor
                    label="Strengths in teaching"
                    guide="What happened in the room — rapport, clarity, management, language work."
                    points={strengthsTeaching}
                    onChange={setStrengthsTeaching}
                    scope="teaching"
                    starable={false}
                    sectionHue={TEAL}
                    tpNumber={tpNumber}
                    autoTagEnabled={autoTagEnabled}
                    toneAssistEnabled={toneAssistEnabled}
                    glossary={glossary}
                  />
                  <FeedbackPointEditor
                    label="Action points in teaching"
                    guide="Star the ones to prioritise next time."
                    points={actionPointsTeaching}
                    onChange={setActionPointsTeaching}
                    scope="teaching"
                    starable
                    sectionHue={GOLD_INK}
                    tpNumber={tpNumber}
                    autoTagEnabled={autoTagEnabled}
                    toneAssistEnabled={toneAssistEnabled}
                    glossary={glossary}
                  />
                </div>
              </div>
            </>
          ) : null}

          {step === 3 ? (
            <>
              {/* §1a grade strip */}
              <Strip className="flex-col !items-start gap-2">
                <Eyebrow>Lesson grade at this stage of the course</Eyebrow>
                <div className="flex flex-wrap gap-2">
                  {STANDARD_RATING_OPTIONS.map((opt) => {
                    const on = grade === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setGrade(opt.value)}
                        className="rounded-full"
                        style={{
                          border: `1.5px solid ${on ? TEAL : BORDER}`,
                          background: on ? TEAL : SHEET,
                          padding: "7px 15px",
                          fontWeight: 600,
                          fontSize: 13,
                          color: on ? SHEET : INK,
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </Strip>

              {/* §1d foot band */}
              <div
                className="grid grid-cols-1 rounded-b-[14px] lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]"
                style={{ background: CARD }}
              >
                <div className="flex flex-col gap-2" style={{ padding: "18px 26px 24px" }}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <MarkerLabel colour={INK_WARM} label="Overall comment" />
                  </div>
                  <TutorToneTextarea
                    enabled={toneAssistEnabled}
                    name="overall_comment"
                    rows={4}
                    defaultValue={feedback?.overall_comment ?? ""}
                    data-dictate-label="Overall comment"
                    style={{ ...ruledField(14, INK_WARM, 1.65), minHeight: 110 }}
                    placeholder="Free prose — how the lesson read as a whole, and where they are on the course."
                  />
                </div>

                <div className="flex flex-col gap-2" style={{ borderLeft: `1px solid ${FAINT}`, padding: "18px 26px 24px" }}>
                  <MarkerLabel colour={GARNET} label="Your comment on their self-evaluation" />
                  <p className="italic" style={{ fontSize: 11.5, color: MUTED }}>
                    Appears at the end of the assembled document. Leave empty if you have nothing to add.
                  </p>
                  {selfEvaluation ? (
                    <div
                      className="flex flex-col gap-2"
                      style={{ marginLeft: 12, borderRadius: 9, border: `1px solid ${FAINT}`, background: SHEET, padding: "12px 14px" }}
                    >
                      {SELF_EVAL_QUOTE_FIELDS.map((field) => {
                        const value = selfEvaluation[field.key] as string | null;
                        if (!value) return null;
                        return (
                          <div key={String(field.key)}>
                            <p
                              className="uppercase"
                              style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: MUTED }}
                            >
                              {field.label}
                            </p>
                            <p
                              className="font-serif italic"
                              style={{ fontSize: 13.5, lineHeight: 1.5, color: INK_WARM, whiteSpace: "pre-line" }}
                            >
                              {value}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                  <TutorToneTextarea
                    enabled={toneAssistEnabled}
                    name="self_eval_comment"
                    rows={3}
                    defaultValue={feedback?.self_eval_comment ?? ""}
                    data-dictate-label="Comment on their self-evaluation"
                    style={{ ...ruledField(13.5, BORDER, 1.55), minHeight: 60 }}
                    placeholder="• One response per line"
                  />
                </div>
              </div>
            </>
          ) : null}
        </TpSheet>

        <BottomBar
          role="teal"
          warning={
            step === 3
              ? "Submitting releases this feedback to the trainee — you won't be able to edit it afterwards."
              : step === 1
                ? "Step 1 of 3 · Notes save as you type. Nothing is released until you submit in step 3."
                : "Step 2 of 3 · Nothing is released until you submit in step 3."
          }
        >
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <SaveDraftButton pending={draftPending} disabled={draftPending || submitPending} />
          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((step + 1) as Step)}
              style={{
                borderRadius: 8,
                background: TEAL,
                padding: "8px 17px",
                fontWeight: 600,
                fontSize: 13.5,
                color: "oklch(98.5% 0.006 90)",
              }}
            >
              {step === 1 ? "Next · The lesson" : "Next · Overall"}
            </button>
          ) : (
            <SubmitButton
              role="teal"
              label="Submit feedback"
              pending={submitPending}
              disabled={draftPending || submitPending}
              formAction={submitActionFn}
            />
          )}
        </BottomBar>
      </form>
    </DictationScope>
  );
}

function StepSwitcher({ step, onChange }: { step: Step; onChange: (s: Step) => void }) {
  const labels: [Step, string][] = [
    [1, "1 · Plan & LA"],
    [2, "2 · Lesson"],
    [3, "3 · Overall"],
  ];
  return (
    <div className="inline-flex rounded-full" style={{ border: "1px solid oklch(55% 0.06 195)", padding: 3 }}>
      {labels.map(([value, label]) => {
        const on = step === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            className="rounded-full"
            style={{
              padding: "5px 14px",
              fontSize: 12.5,
              fontWeight: on ? 700 : 600,
              background: on ? "oklch(98.5% 0.006 90)" : "transparent",
              color: on ? TEAL : "oklch(86% 0.04 195)",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function ColumnHead({ glyph, title, hue, scopeNote }: { glyph: string; title: string; hue: string; scopeNote: string }) {
  return (
    <div className="flex items-center gap-2.5" style={{ padding: "16px 26px 0" }}>
      <span
        className="flex shrink-0 items-center justify-center rounded-full"
        style={{ width: 24, height: 24, background: hue, color: SHEET, fontSize: 11, fontWeight: 700 }}
      >
        {glyph}
      </span>
      <h3 className="font-serif" style={{ fontSize: 21, fontWeight: 600, color: hue }}>
        {title}
      </h3>
      <span style={{ fontSize: 11.5, color: MUTED }}>{scopeNote}</span>
    </div>
  );
}

function PullButton({ colour, label, onClick }: { colour: string; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full transition-colors hover:bg-card-inset"
      style={{ border: `1px solid ${BORDER}`, padding: "2px 9px", fontWeight: 600, fontSize: 11, color: colour }}
    >
      {label}
    </button>
  );
}

export type { AnalysisBlock, PlanProcedureRow, ProblemSolutionPair, VocabRow };
