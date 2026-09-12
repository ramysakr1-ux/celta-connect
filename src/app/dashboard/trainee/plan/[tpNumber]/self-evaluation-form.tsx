"use client";

import { useActionState, useState } from "react";
import {
  saveSelfEvaluationDraft,
  submitSelfEvaluation,
  type FormState,
} from "@/app/dashboard/trainee/plan/[tpNumber]/self-evaluation-actions";
import { MobileFormWizard, type WizardStep } from "@/components/mobile-form-wizard";
import { DictationScope } from "@/components/dictate-anywhere";
import {
  BORDER,
  BottomBar,
  CARD,
  Eyebrow,
  FAINT,
  GARNET,
  GOLD,
  GOLD_INK,
  GOLD_WASH,
  IdentityBand,
  INK,
  INK_WARM,
  MUTED,
  NumberedDot,
  SaveDraftButton,
  SaveStatusPill,
  Strip,
  SubmitButton,
  TEAL,
  TpSheet,
  plainField,
  ruledField,
} from "@/components/tp-sheet";
import { bulletListProps } from "@/lib/bullet-list";
import { autosizeOnInput, useAutosize } from "@/lib/autosize";
import type { SelfEvalActionPoint } from "@/lib/tp-plan-content";
import type { Database } from "@/lib/supabase/types";

type TpSelfEvaluation = Database["public"]["Tables"]["tp_self_evaluations"]["Row"];

const initialState: FormState = { error: null };

// design_handoff_tp_feedback_cycle §2, 13 Sep 2026.
//
// The self-evaluation is the trainee's OWN voice in the cycle, so it carries
// the garnet identity band -- the same hue that marks the Teaching column in
// the tutor's feedback and the tutor's comment on this sheet at the foot of
// the assembled document. Its eyebrow, sub-line, save status and Dictate fill
// are garnet's own tints; none of them are borrowed from the teal band.
//
// Each question keeps its own hue, and the progress strip fills a segment in
// that hue as the question is answered: what went to plan (teal, structure),
// what didn't (garnet, the room), evidence of learning (ink-warm), what you'd
// do differently (gold-ink, carry-forward), the carried action points
// (gold-ink), next TP focus (teal).

const QUESTIONS = [
  {
    name: "what_went_well" as const,
    label: "What went to plan?",
    hint: "Be specific — a stage, a moment, something a learner said or did.",
    hue: TEAL,
  },
  {
    name: "what_not_as_planned" as const,
    label: "What didn't go as planned, and why?",
    hint: "Which stage, and what caused it.",
    hue: GARNET,
  },
  {
    name: "evidence_of_learning" as const,
    label: "What evidence did you see that the learners had learnt?",
    hint: "",
    hue: INK_WARM,
  },
  {
    name: "what_differently" as const,
    label: "What would you do differently if you taught it again?",
    hint: "",
    hue: GOLD_INK,
  },
];

export function SelfEvaluationForm({
  planId,
  tpNumber,
  selfEvaluation,
  previousActionPoints,
  lessonTitle = null,
  lessonWhen = null,
}: {
  planId: string;
  tpNumber: number;
  selfEvaluation: TpSelfEvaluation | null;
  previousActionPoints: string[];
  lessonTitle?: string | null;
  lessonWhen?: string | null;
}) {
  const [draftState, draftAction, draftPending] = useActionState(saveSelfEvaluationDraft, initialState);
  const [submitState, submitActionFn, submitPending] = useActionState(submitSelfEvaluation, initialState);
  const autosize = useAutosize();

  const [answers, setAnswers] = useState<Record<string, string>>(() => ({
    what_went_well: selfEvaluation?.what_went_well ?? "",
    what_not_as_planned: selfEvaluation?.what_not_as_planned ?? "",
    evidence_of_learning: selfEvaluation?.evidence_of_learning ?? "",
    what_differently: selfEvaluation?.what_differently ?? "",
    next_tp_focus: selfEvaluation?.next_tp_focus ?? "",
  }));

  const [actionPoints, setActionPoints] = useState<SelfEvalActionPoint[]>(() => {
    if (selfEvaluation && selfEvaluation.action_points.length > 0) return selfEvaluation.action_points;
    if (previousActionPoints.length > 0) {
      return previousActionPoints.map((p) => ({ previous_point: p, what_i_did: "", carried: true }));
    }
    return [{ previous_point: "", what_i_did: "" }];
  });

  const state = submitPending ? submitState : draftState;

  // §2a -- six segments, filled in the question's own hue once answered.
  const answered = [
    ...QUESTIONS.map((q) => Boolean(answers[q.name].trim())),
    actionPoints.some((p) => p.what_i_did.trim()),
    Boolean(answers.next_tp_focus.trim()),
  ];
  const answeredCount = answered.filter(Boolean).length;
  const segmentHues = [...QUESTIONS.map((q) => q.hue), GOLD_INK, TEAL];

  const eyebrow = [`Teaching Practice ${tpNumber}`, lessonWhen, lessonTitle].filter(Boolean).join(" · ");

  const steps: WizardStep[] = [
    ...QUESTIONS.map((q, i) => ({
      key: q.name,
      content: (
        <Question
          n={i + 1}
          label={q.label}
          hint={q.hint}
          hue={q.hue}
          name={q.name}
          value={answers[q.name]}
          onChange={(v) => setAnswers({ ...answers, [q.name]: v })}
          autosize={autosize}
          bordered={i % 2 === 1}
        />
      ),
    })),
    {
      key: "action_points_table",
      className: "md:col-span-2",
      content: (
        <div style={{ padding: "20px 26px 22px", borderBottom: `1px solid ${FAINT}` }}>
          <div className="flex items-start gap-3">
            <NumberedDot n={5} hue={GOLD_INK} done={answered[4]} />
            <div className="min-w-0">
              <h3 className="font-serif" style={{ fontSize: 17, fontWeight: 600, color: GOLD_INK }}>
                Action points from the last TP
              </h3>
              <p className="italic" style={{ fontSize: 12, color: MUTED }}>
                Brought in automatically from your tutor&apos;s starred points — say what you actually did about each
                one.
              </p>
            </div>
          </div>

          <div style={{ marginLeft: 36, marginTop: 12 }}>
            <div
              className="grid gap-[18px]"
              style={{ gridTemplateColumns: "1fr 1.2fr", borderBottom: `1px solid ${BORDER}`, paddingBottom: 6 }}
            >
              <Eyebrow>Action point set last time</Eyebrow>
              <Eyebrow>What I did about it</Eyebrow>
            </div>
            {actionPoints.map((point, i) => (
              <div
                key={i}
                className="grid gap-[18px]"
                style={{
                  gridTemplateColumns: "1fr 1.2fr",
                  padding: "12px 0",
                  borderBottom: `1px dashed ${FAINT}`,
                }}
              >
                {point.carried ? (
                  <div
                    style={{
                      borderRadius: 7,
                      borderLeft: `3px solid ${GOLD}`,
                      background: GOLD_WASH,
                      padding: "9px 11px",
                    }}
                  >
                    <span style={{ fontSize: 11, color: GOLD_INK }}>★ </span>
                    <span style={{ fontSize: 13, lineHeight: 1.5, color: INK }}>{point.previous_point}</span>
                  </div>
                ) : (
                  <input
                    type="text"
                    value={point.previous_point}
                    onChange={(e) =>
                      setActionPoints(actionPoints.map((p, x) => (x === i ? { ...p, previous_point: e.target.value } : p)))
                    }
                    placeholder="Your own point"
                    data-dictate-label="your own action point"
                    style={{ ...plainField(13), borderBottom: `1px solid ${BORDER}`, minHeight: undefined }}
                  />
                )}
                <textarea
                  ref={autosize}
                  rows={1}
                  value={point.what_i_did}
                  onInput={autosizeOnInput}
                  onChange={(e) =>
                    setActionPoints(actionPoints.map((p, x) => (x === i ? { ...p, what_i_did: e.target.value } : p)))
                  }
                  placeholder="What I did about it"
                  data-dictate-label={
                    point.previous_point ? `what you did about "${point.previous_point.slice(0, 40)}"` : "what I did about it"
                  }
                  {...bulletListProps}
                  style={{ ...ruledField(13.5, BORDER, 1.55), minHeight: 44 }}
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() => setActionPoints([...actionPoints, { previous_point: "", what_i_did: "" }])}
              className="mt-2"
              style={{ fontSize: 12.5, color: TEAL }}
            >
              + Add another
            </button>
          </div>
        </div>
      ),
    },
    {
      key: "next_tp_focus",
      className: "md:col-span-2",
      content: (
        <div className="rounded-b-[14px]" style={{ background: CARD, padding: "20px 26px 24px" }}>
          <div className="flex items-start gap-3">
            <NumberedDot n={6} hue={TEAL} done={answered[5]} />
            <div className="min-w-0">
              <h3 className="font-serif" style={{ fontSize: 17, fontWeight: 600, color: TEAL }}>
                What do you want to work on in the next TP?
              </h3>
              <p className="italic" style={{ fontSize: 12, color: MUTED }}>
                Your own priorities, before you read your tutor&apos;s.
              </p>
            </div>
          </div>
          <textarea
            ref={autosize}
            name="next_tp_focus"
            rows={1}
            value={answers.next_tp_focus}
            onInput={autosizeOnInput}
            onChange={(e) => setAnswers({ ...answers, next_tp_focus: e.target.value })}
            placeholder="• One priority per line"
            data-dictate-label="What to work on next TP"
            {...bulletListProps}
            style={{
              ...ruledField(14, answers.next_tp_focus.trim() ? TEAL : BORDER),
              marginLeft: 36,
              width: "calc(100% - 36px)",
              minHeight: 60,
            }}
          />
        </div>
      ),
    },
  ];

  return (
    <DictationScope scopeId="self-evaluation">
      <form id="self-evaluation" action={draftAction} className="scroll-mt-20">
        <input type="hidden" name="plan_id" value={planId} />
        <input type="hidden" name="tp_number" value={tpNumber} />
        <input type="hidden" name="action_points" value={JSON.stringify(actionPoints)} />
        {QUESTIONS.map((q) => (
          <input key={q.name} type="hidden" name={q.name} value={answers[q.name]} />
        ))}

        <TpSheet maxWidth={1040}>
          <IdentityBand
            role="garnet"
            eyebrow={eyebrow || `Teaching Practice ${tpNumber}`}
            title="Self-evaluation"
            subLine="Write this before you read your tutor's feedback — that's the point of it."
            status={
              <SaveStatusPill
                role="garnet"
                label={draftPending || submitPending ? "Saving…" : selfEvaluation ? "Draft" : "Not started"}
              />
            }
          />

          {/* §2a progress strip */}
          <Strip>
            <Eyebrow>Progress</Eyebrow>
            <div className="flex flex-1 items-center gap-4" style={{ minWidth: 260 }}>
              <div className="flex flex-1 gap-[3px]" style={{ height: 8 }}>
                {answered.map((done, i) => (
                  <span
                    key={i}
                    style={{ flex: 1, borderRadius: 2, background: done ? segmentHues[i] : FAINT }}
                  />
                ))}
              </div>
              <p className="flex-none whitespace-nowrap" style={{ fontSize: 12, color: MUTED }}>
                <span className="font-serif" style={{ fontSize: 17, color: INK }}>
                  {answeredCount}
                </span>{" "}
                of 6 answered
              </p>
            </div>
          </Strip>

          {/* §2b questions 1-4 as a 2x2 grid on desktop, one per screen on mobile */}
          <div className="md:grid md:grid-cols-2">
            <MobileFormWizard steps={steps} />
          </div>
        </TpSheet>

        <BottomBar role="garnet" warning="Submitting locks your self-evaluation — you won't be able to edit it afterwards.">
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <SaveDraftButton pending={draftPending} disabled={draftPending || submitPending} />
          <SubmitButton
            role="garnet"
            label="Submit self-evaluation"
            pending={submitPending}
            disabled={draftPending || submitPending}
            formAction={submitActionFn}
          />
        </BottomBar>
      </form>
    </DictationScope>
  );
}

function Question({
  n,
  label,
  hint,
  hue,
  name,
  value,
  onChange,
  autosize,
  bordered,
}: {
  n: number;
  label: string;
  hint: string;
  hue: string;
  name?: string;
  value: string;
  onChange: (v: string) => void;
  autosize: (el: HTMLTextAreaElement | null) => void;
  bordered: boolean;
}) {
  const answered = Boolean(value.trim());
  return (
    <div
      style={{
        padding: "20px 26px 22px",
        borderBottom: `1px solid ${FAINT}`,
        borderRight: bordered ? undefined : `1px solid ${FAINT}`,
      }}
    >
      <div className="flex items-start gap-3">
        <NumberedDot n={n} hue={hue} done={answered} />
        <div className="min-w-0">
          <h3 className="font-serif" style={{ fontSize: 17, fontWeight: 600, color: hue }}>
            {label}
          </h3>
          {hint ? (
            <p className="italic" style={{ fontSize: 12, color: MUTED }}>
              {hint}
            </p>
          ) : null}
        </div>
      </div>
      <textarea
        ref={autosize}
        rows={1}
        value={value}
        onInput={autosizeOnInput}
        onChange={(e) => onChange(e.target.value)}
        placeholder="• One point per line"
        data-dictate-label={label}
        {...bulletListProps}
        style={{
          ...ruledField(14, answered ? hue : BORDER),
          marginLeft: 36,
          width: "calc(100% - 36px)",
          minHeight: 72,
        }}
      />
    </div>
  );
}
