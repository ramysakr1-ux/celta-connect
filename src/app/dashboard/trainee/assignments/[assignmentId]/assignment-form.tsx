"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  saveAssignmentDraft,
  submitAssignment,
  withdrawAssignmentSubmission,
  type FormState,
} from "@/app/dashboard/trainee/assignments/[assignmentId]/actions";
import { DictateButton, DictationScope, WakeWordToggle } from "@/components/dictate-anywhere";
import {
  BAND,
  BAR_BORDER,
  BORDER,
  CARD,
  FAINT,
  GARNET,
  GOLD_INK,
  IdentityBand,
  INK,
  INK_WARM,
  MUTED,
  MarkerLabel,
  NumberedDot,
  SHEET,
  SaveStatusPill,
  Strip,
  TEAL,
  TpSheet,
  Eyebrow,
  plainField,
} from "@/components/tp-sheet";
import { autosizeOnInput, useAutosize } from "@/lib/autosize";
import { bulletListProps } from "@/lib/bullet-list";
import type { TemplateSection } from "@/lib/assignment-templates/content";

// design_handoff_assignments (v1), 13 Sep 2026 — the candidate's assignment
// writer, rebuilt as a document in the same visual system as the v3 lesson
// plan: dark identity band, a strip carrying a live word-count budget, the
// sections on a numbered timeline spine, declaration and references at the
// foot, and one Dictate in the band and one in the bar.
//
// Content and logic are unchanged. The sections, their prompts, the criteria
// and the word range all come from the centre's own template and the
// assignment record, exactly as before; the same two server actions save and
// submit. This is layout, colour and the small interactions.
//
// Colour roles from the handoff:
//   warm ink   assignments 1-4 — the band, the section headings
//   garnet     the plagiarism reflection, so it is visibly NOT one of the four
//   teal       criteria, everywhere, because that is the colour tutor feedback
//              marks in
//   gold-ink   word-count warnings
//
// A section takes its hue once something is written in it, faint until then —
// the same "colour arrives as you write" rule the plan uses.

const initialState: FormState = { error: null };

const SECTION_HUES = [TEAL, GOLD_INK, INK_WARM, INK_WARM, GARNET, MUTED, TEAL];

function wordCount(text: string): number {
  // Bullets are punctuation, not words (handoff §2b).
  const cleaned = text.replace(/•/g, " ").trim();
  return cleaned.length === 0 ? 0 : cleaned.split(/\s+/).length;
}

interface SectionResponse {
  section_key: string;
  section_title: string;
  first_response: string | null;
  first_comments: string | null;
  resubmission_response: string | null;
  resubmission_comments: string | null;
}

export interface AssignmentCriterionView {
  key: string;
  text: string;
  /** The section this criterion is marked at, when the record ties it to one. */
  sectionKey?: string | null;
  /** Set once a round has been marked. */
  mark?: "met" | "not_met" | null;
}

export function AssignmentAuthoringForm({
  assignmentId,
  title,
  sections,
  responses,
  round,
  locked,
  deadlinePassed,
  canWithdraw = false,
  criteria = [],
  intro = null,
  scopeNote = null,
  appendixHint = null,
  wordMin = 750,
  wordMax = 1000,
  format = "prose",
  sanction = false,
  savedAt = null,
}: {
  assignmentId: string;
  /** The assignment's own title, for the band. */
  title?: string;
  sections: TemplateSection[];
  responses: SectionResponse[];
  round: "first" | "resubmission";
  locked: boolean;
  deadlinePassed: boolean;
  canWithdraw?: boolean;
  criteria?: AssignmentCriterionView[];
  intro?: string | null;
  /** The reflection's "what this does and does not affect" paragraph. */
  scopeNote?: string | null;
  appendixHint?: string | null;
  wordMin?: number;
  wordMax?: number;
  format?: "structured" | "prose";
  /** True for the plagiarism reflection: garnet throughout, not one of the four. */
  sanction?: boolean;
  savedAt?: string | null;
}) {
  const responseByKey = new Map(responses.map((r) => [r.section_key, r]));
  const isResubmission = round === "resubmission";
  const autosize = useAutosize();

  const [texts, setTexts] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const s of sections) {
      const existing = responseByKey.get(s.key);
      initial[s.key] = (isResubmission ? existing?.resubmission_response : existing?.first_response) ?? "";
    }
    return initial;
  });
  const [references, setReferences] = useState("");
  const [ownWorkConfirmed, setOwnWorkConfirmed] = useState(false);
  const [referencedConfirmed, setReferencedConfirmed] = useState(false);
  const [aiAnswered, setAiAnswered] = useState<boolean | null>(null);
  const [aiConversationUrl, setAiConversationUrl] = useState("");

  const [draftState, draftAction, draftPending] = useActionState(saveAssignmentDraft, initialState);
  const [submitState, submitActionFn, submitPending] = useActionState(submitAssignment, initialState);
  const state = submitPending ? submitState : draftState;

  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(savedAt ? new Date(savedAt) : null);
  const [, forceTick] = useState(0);
  const [isAutosaving, startAutosave] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextAutosave = useRef(true);

  useEffect(() => {
    if (locked) return;
    if (skipNextAutosave.current) {
      skipNextAutosave.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const fd = new FormData();
      fd.set("assignment_id", assignmentId);
      fd.set("round", round);
      fd.set("sections_payload", JSON.stringify(sections.map((s) => ({ key: s.key, title: s.title, text: texts[s.key] ?? "" }))));
      fd.set("ai_declared", aiAnswered ? "true" : "false");
      fd.set("ai_conversation_url", aiConversationUrl);
      fd.set("own_work_confirmed", ownWorkConfirmed && referencedConfirmed ? "true" : "false");
      startAutosave(async () => {
        const result = await saveAssignmentDraft(initialState, fd);
        if (!result.error) setLastSavedAt(new Date());
      });
    }, 2500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texts]);

  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const bandRole = sanction ? "garnet" : "ink-warm";
  const accent = sanction ? GARNET : TEAL;
  const hueFor = (i: number) => (sanction ? GARNET : SECTION_HUES[i % SECTION_HUES.length]);

  // §2b — references and appendices are deliberately not counted.
  const totalWords = useMemo(
    () => sections.reduce((sum, s) => sum + wordCount(texts[s.key] ?? ""), 0),
    [sections, texts]
  );
  const under = wordMin - totalWords;
  const over = totalWords - wordMax;
  const fitLabel = under > 0 ? `${under} words to go` : over > 0 ? `over by ${over}` : "within range";
  const fitColour = under > 0 || over > 0 ? GOLD_INK : TEAL;

  const declarationComplete = ownWorkConfirmed && referencedConfirmed && aiAnswered !== null;

  const wholeAssignmentCriteria = criteria.filter((c) => !c.sectionKey);
  const criteriaForSection = (key: string) => criteria.filter((c) => c.sectionKey === key);

  const savedLabel = isAutosaving
    ? "Saving…"
    : lastSavedAt
      ? `Draft · saved ${relativeMinutes(lastSavedAt)}`
      : "Draft";

  const eyebrow = sanction
    ? `Centre sanction · Not one of the four Cambridge assignments · ${wordMin}–${wordMax.toLocaleString()} words`
    : [`${wordMin}–${wordMax.toLocaleString()} words`, format === "structured" ? "Structured" : "Continuous prose"].join(" · ");

  return (
    <DictationScope scopeId="assignment">
      <form id="assignment" action={submitActionFn} className="scroll-mt-20">
        <input type="hidden" name="assignment_id" value={assignmentId} />
        <input type="hidden" name="round" value={round} />
        <input
          type="hidden"
          name="sections_payload"
          value={JSON.stringify(sections.map((s) => ({ key: s.key, title: s.title, text: texts[s.key] ?? "" })))}
        />
        <input type="hidden" name="ai_declared" value={aiAnswered ? "true" : "false"} />
        <input type="hidden" name="ai_conversation_url" value={aiConversationUrl} />
        <input type="hidden" name="own_work_confirmed" value={declarationComplete ? "true" : "false"} />

        <TpSheet maxWidth={1240}>
          <IdentityBand
            role={bandRole}
            eyebrow={eyebrow}
            title={title ?? "Your assignment"}
            status={<SaveStatusPill role={bandRole} label={locked ? "Submitted" : savedLabel} />}
            showDictate={!locked}
          />

          {/* ---------- §2 word-count budget ---------- */}
          <Strip>
            <div className="flex flex-1 flex-col gap-1.5" style={{ minWidth: 300 }}>
              <div className="flex items-baseline justify-between gap-3">
                <Eyebrow>Word count</Eyebrow>
                <p className="flex-none whitespace-nowrap" style={{ fontSize: 12, color: MUTED }}>
                  <span className="font-serif tabular-nums" style={{ fontSize: 18, color: INK }}>
                    {totalWords}
                  </span>{" "}
                  of {wordMin}–{wordMax.toLocaleString()} words ·{" "}
                  <span style={{ fontWeight: 600, color: fitColour }}>{fitLabel}</span>
                </p>
              </div>
              <div className="flex gap-[2px]" style={{ height: 10 }}>
                {sections.map((s, i) => {
                  const words = wordCount(texts[s.key] ?? "");
                  return (
                    <span
                      key={s.key}
                      title={`${s.title} · ${words} words`}
                      style={{ flex: Math.max(1, words), borderRadius: 3, background: words > 0 ? hueFor(i) : FAINT }}
                    />
                  );
                })}
                {under > 0 ? <span style={{ flex: under, borderRadius: 3, background: FAINT }} /> : null}
              </div>
            </div>
          </Strip>

          {/* ---------- §3 Before you start | Marked against ---------- */}
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]" style={{ borderBottom: `1px solid ${FAINT}` }}>
            <div className="flex flex-col gap-2" style={{ padding: "16px 22px 18px 26px" }}>
              <MarkerLabel colour={sanction ? GARNET : INK_WARM} label="Before you start" />
              {intro ? (
                <p style={{ fontSize: 13.5, lineHeight: 1.55, color: INK, textWrap: "pretty" }}>{intro}</p>
              ) : null}
              {scopeNote ? (
                <p style={{ fontSize: 12.5, lineHeight: 1.55, color: GARNET, textWrap: "pretty" }}>{scopeNote}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2" style={{ borderLeft: `1px solid ${FAINT}`, padding: "16px 26px 18px 22px" }}>
              <MarkerLabel colour={TEAL} label="Marked against" />
              {criteria.length === 0 ? (
                <p className="italic" style={{ fontSize: 12, color: MUTED }}>
                  Your centre has not set the criteria for this assignment yet.
                </p>
              ) : (
                <ol className="flex flex-col gap-2">
                  {criteria.map((c, i) => {
                    const tied = sections.find((s) => s.key === c.sectionKey);
                    return (
                      <li key={c.key} className="grid gap-2" style={{ gridTemplateColumns: "16px minmax(0,1fr)" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: TEAL, paddingTop: 2 }}>{i + 1}</span>
                        <span>
                          <span style={{ fontSize: 12.5, lineHeight: 1.5, color: INK }}>{c.text}</span>{" "}
                          <span className="italic" style={{ fontSize: 11, color: MUTED }}>
                            — {tied ? tied.title : "whole assignment"}
                          </span>
                          {c.mark ? (
                            <span
                              className="ml-1.5 inline-block rounded-[4px] px-1.5"
                              style={{
                                fontSize: 10.5,
                                fontWeight: 700,
                                background: c.mark === "met" ? `color-mix(in oklab, ${TEAL} 12%, transparent)` : `color-mix(in oklab, ${GOLD_INK} 14%, transparent)`,
                                color: c.mark === "met" ? TEAL : GOLD_INK,
                              }}
                            >
                              {c.mark === "met" ? "Met · round 1" : "Not met · round 1"}
                            </span>
                          ) : null}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
              <p className="italic" style={{ fontSize: 11.5, color: MUTED }}>
                Every criterion must be met to pass. One resubmission if any isn&apos;t.
              </p>
            </div>
          </div>

          {/* ---------- §4 the sections ---------- */}
          <div style={{ padding: "20px 26px 22px" }}>
            <div className="flex flex-wrap items-baseline gap-3">
              <h3 className="font-serif" style={{ fontSize: 21, fontWeight: 600, color: sanction ? GARNET : INK_WARM }}>
                {format === "structured" ? "The tasks" : "The essay"}
              </h3>
              <p className="italic" style={{ fontSize: 11.5, color: MUTED }}>
                {format === "structured"
                  ? "One point per line. Each step is marked where it says so."
                  : "Continuous prose. Sections are for reading, not for marks — the whole essay is judged together."}
              </p>
            </div>

            <div className="mt-2">
              {sections.map((s, i) => {
                const value = texts[s.key] ?? "";
                const words = wordCount(value);
                const written = words > 0;
                const hue = hueFor(i);
                const comment = isResubmission ? responseByKey.get(s.key)?.first_comments : null;
                return (
                  <div
                    key={s.key}
                    className="group relative grid"
                    style={{ gridTemplateColumns: "44px minmax(0,232px) minmax(0,1fr)", borderTop: `1px solid ${FAINT}` }}
                  >
                    <div className="relative flex justify-center" style={{ padding: "16px 0 18px" }}>
                      <span
                        aria-hidden
                        className="absolute"
                        style={{
                          width: 2,
                          left: "calc(50% - 1px)",
                          top: i === 0 ? 16 : 0,
                          bottom: i === sections.length - 1 ? "calc(100% - 40px)" : 0,
                          background: written ? hue : FAINT,
                        }}
                      />
                      <NumberedDot n={i + 1} hue={written ? hue : BORDER} done={written} />
                    </div>

                    <div className="flex flex-col gap-[7px]" style={{ padding: "14px 18px 18px 0" }}>
                      <p className="font-serif" style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.25, color: INK }}>
                        {s.title}
                      </p>
                      {s.instruction ? (
                        <p className="italic" style={{ fontSize: 12.5, lineHeight: 1.5, color: MUTED, textWrap: "pretty" }}>
                          {s.instruction}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-[5px]">
                        <span
                          className="tabular-nums"
                          style={{
                            borderRadius: 6,
                            padding: "3px 8px",
                            fontSize: 12.5,
                            fontWeight: 700,
                            background: written ? `color-mix(in oklab, ${hue} 13%, transparent)` : CARD,
                            color: written ? hue : MUTED,
                          }}
                        >
                          {words} words
                        </span>
                      </div>

                      {/* The on-page anchor for the tutor's later comment. */}
                      {criteriaForSection(s.key).map((c) => (
                        <div
                          key={c.key}
                          style={{
                            borderRadius: 7,
                            borderLeft: `3px solid ${TEAL}`,
                            background: `color-mix(in oklab, ${TEAL} 9%, transparent)`,
                            padding: "7px 10px",
                          }}
                        >
                          <p className="uppercase" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: TEAL }}>
                            Marked here
                          </p>
                          <p style={{ fontSize: 11.5, lineHeight: 1.45, color: INK }}>{c.text}</p>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col gap-3" style={{ borderLeft: `1px solid ${FAINT}`, padding: "14px 0 18px 20px" }}>
                      {comment ? (
                        <div
                          style={{
                            borderRadius: 7,
                            borderLeft: `3px solid ${TEAL}`,
                            background: `color-mix(in oklab, ${TEAL} 9%, transparent)`,
                            padding: "8px 11px",
                          }}
                        >
                          <p className="uppercase" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: TEAL }}>
                            Your tutor, on this section · round 1
                          </p>
                          <p style={{ fontSize: 13, lineHeight: 1.55, color: INK, whiteSpace: "pre-line" }}>{comment}</p>
                        </div>
                      ) : null}

                      {locked ? (
                        <p style={{ fontSize: 14, lineHeight: 1.6, color: INK, whiteSpace: "pre-line" }}>
                          {value || <span className="italic" style={{ color: MUTED }}>Nothing written.</span>}
                        </p>
                      ) : (
                        <textarea
                          ref={autosize}
                          rows={1}
                          value={value}
                          data-dictate-label={s.title}
                          placeholder={
                            format === "structured"
                              ? "• One point per line — Enter starts the next bullet"
                              : "Write in continuous prose."
                          }
                          onInput={autosizeOnInput}
                          onChange={(e) => setTexts({ ...texts, [s.key]: e.target.value })}
                          {...(format === "structured" ? bulletListProps : {})}
                          style={{ ...plainField(14, INK, 1.6), textWrap: "pretty" }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ---------- §5 declaration | references ---------- */}
          <div
            className="grid grid-cols-1 rounded-b-[14px] lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]"
            style={{ borderTop: `1px solid ${FAINT}`, background: CARD }}
          >
            <div className="flex flex-col gap-3" style={{ padding: "18px 22px 22px 26px" }}>
              <MarkerLabel colour={sanction ? GARNET : INK_WARM} label="Declaration" />
              <p className="italic" style={{ fontSize: 11.5, color: MUTED, marginLeft: 12 }}>
                Taken fresh on every submission, including a resubmission.
              </p>
              <div className="flex flex-col gap-2" style={{ marginLeft: 12 }}>
                <CheckRow
                  checked={ownWorkConfirmed}
                  disabled={locked}
                  onChange={setOwnWorkConfirmed}
                  label="This is my own work."
                />
                <CheckRow
                  checked={referencedConfirmed}
                  disabled={locked}
                  onChange={setReferencedConfirmed}
                  label="All sources are referenced, in the format (Author, Year, p. ##)."
                />
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <span style={{ fontSize: 12.5, color: INK }}>Did you use AI tools for any part of this?</span>
                  <RadioRow label="Yes" checked={aiAnswered === true} disabled={locked} onSelect={() => setAiAnswered(true)} />
                  <RadioRow label="No" checked={aiAnswered === false} disabled={locked} onSelect={() => setAiAnswered(false)} />
                </div>
                {aiAnswered === true ? (
                  <textarea
                    ref={autosize}
                    rows={2}
                    value={aiConversationUrl}
                    disabled={locked}
                    onInput={autosizeOnInput}
                    onChange={(e) => setAiConversationUrl(e.target.value)}
                    data-dictate-label="Which AI tools, and for what"
                    placeholder="Which tools, and for what — checking grammar, generating ideas, drafting text…"
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      borderRadius: 8,
                      border: `1px solid ${BORDER}`,
                      background: SHEET,
                      padding: "9px 12px",
                      fontSize: 13,
                      lineHeight: 1.5,
                      color: INK,
                      outline: "none",
                      resize: "none",
                      overflowY: "hidden",
                    }}
                  />
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-3.5" style={{ borderLeft: `1px solid ${FAINT}`, padding: "18px 26px 22px 22px" }}>
              <div className="flex flex-col gap-1.5">
                <MarkerLabel colour={TEAL} label="References" />
                <textarea
                  ref={autosize}
                  rows={1}
                  value={references}
                  disabled={locked}
                  onInput={autosizeOnInput}
                  onChange={(e) => setReferences(e.target.value)}
                  data-dictate-label="References"
                  placeholder="One source per line — (Author, Year, p. ##). Not counted in the word count."
                  {...bulletListProps}
                  style={{ ...plainField(13, INK, 1.55), marginLeft: 12 }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <MarkerLabel colour={TEAL} label="Appendices" />
                <p className="italic" style={{ fontSize: 11.5, color: MUTED, marginLeft: 12 }}>
                  {appendixHint ?? "Anything you attach sits here. Not counted in the word count."}
                </p>
              </div>
            </div>
          </div>
        </TpSheet>

        {/* ---------- §6 bottom bar ---------- */}
        <div
          className="sticky bottom-40 z-20 mt-3 flex flex-wrap items-center justify-between gap-3 md:bottom-4"
          style={{
            border: `1px solid ${BAR_BORDER}`,
            borderRadius: 10,
            background: "color-mix(in oklab, var(--color-card-inset) 94%, transparent)",
            backdropFilter: "blur(6px)",
            padding: "11px 24px",
          }}
        >
          <div className="flex items-center gap-2">
            <span className="size-[5px] shrink-0 rounded-full" style={{ background: GOLD_INK }} />
            <p style={{ fontSize: 11.5, color: GOLD_INK }}>
              {locked
                ? "With your tutor. You'll be told here when it's marked."
                : sanction
                  ? "Submitting locks this reflection — one chance, pass or fail, alongside the resubmission it accompanies."
                  : "Submitting locks this assignment — if a criterion isn't met you get one resubmission, targeted at that criterion."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
            {locked ? (
              canWithdraw ? (
                <WithdrawButton assignmentId={assignmentId} />
              ) : null
            ) : (
              <>
                <span className="mr-2 flex flex-wrap items-center gap-2">
                  <DictateButton variant="bar" hue={accent} />
                  <WakeWordToggle />
                </span>
                <button
                  type="submit"
                  disabled={draftPending || submitPending || !declarationComplete}
                  title={declarationComplete ? undefined : "Complete the declaration first"}
                  style={{
                    borderRadius: 8,
                    background: declarationComplete ? accent : BORDER,
                    padding: "8px 17px",
                    fontWeight: 600,
                    fontSize: 13.5,
                    color: declarationComplete ? "oklch(98.5% 0.006 90)" : MUTED,
                    cursor: declarationComplete ? undefined : "not-allowed",
                  }}
                >
                  {submitPending ? "Submitting…" : sanction ? "Submit reflection" : "Submit assignment"}
                </button>
              </>
            )}
          </div>
        </div>
        {deadlinePassed && !locked ? (
          <p className="mt-2 text-xs text-destructive">The deadline for this assignment has passed.</p>
        ) : null}
      </form>
    </DictationScope>
  );
}

function relativeMinutes(date: Date): string {
  const minutes = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 minute ago";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
}

function CheckRow({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex items-start gap-2.5 text-left"
      aria-pressed={checked}
    >
      <span
        className="mt-0.5 flex shrink-0 items-center justify-center"
        style={{
          width: 15,
          height: 15,
          borderRadius: 4,
          border: `1.5px solid ${checked ? TEAL : BORDER}`,
          background: checked ? TEAL : "transparent",
          color: SHEET,
          fontSize: 10,
        }}
      >
        {checked ? "✓" : ""}
      </span>
      <span style={{ fontSize: 12.5, lineHeight: 1.45, color: INK }}>{label}</span>
    </button>
  );
}

function RadioRow({
  label,
  checked,
  disabled,
  onSelect,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button type="button" disabled={disabled} onClick={onSelect} className="inline-flex items-center gap-1.5" aria-pressed={checked}>
      <span
        className="inline-flex items-center justify-center rounded-full"
        style={{ width: 13, height: 13, border: `1.5px solid ${checked ? TEAL : BORDER}` }}
      >
        {checked ? <span className="rounded-full" style={{ width: 6, height: 6, background: TEAL }} /> : null}
      </span>
      <span style={{ fontSize: 12.5, color: INK }}>{label}</span>
    </button>
  );
}

function WithdrawButton({ assignmentId }: { assignmentId: string }) {
  return (
    <form action={withdrawAssignmentSubmission}>
      <input type="hidden" name="assignment_id" value={assignmentId} />
      <button
        type="submit"
        style={{ borderRadius: 8, border: `1px solid ${BAR_BORDER}`, background: SHEET, padding: "8px 15px", fontSize: 13.5, color: INK }}
      >
        Withdraw
      </button>
    </form>
  );
}
