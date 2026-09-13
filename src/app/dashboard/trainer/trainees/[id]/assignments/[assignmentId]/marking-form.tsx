"use client";

import { useActionState, useMemo, useState } from "react";
import {
  recordBlindSecondMark,
  returnAsFail,
  returnForResubmission,
  returnUnmarked,
  returnWithPass,
  saveMarkingDraft,
  sendToSecondMarker,
  settleAndInitial,
  type FormState,
} from "@/app/dashboard/trainer/trainees/[id]/assignments/[assignmentId]/actions";
import { DictateButton, DictationScope } from "@/components/dictate-anywhere";
import {
  BAR_BORDER,
  BORDER,
  CARD,
  FAINT,
  GARNET,
  GOLD_INK,
  INK,
  INK_WARM,
  MUTED,
  SHEET,
  TEAL,
} from "@/lib/sheet-tokens";
import { IdentityBand, MarkerLabel, NumberedDot, Strip, TpSheet, Eyebrow, plainField } from "@/components/tp-sheet";
import { autosizeOnInput, useAutosize } from "@/lib/autosize";
import type { TemplateSection } from "@/lib/assignment-templates/content";

// design_handoff_tutor_assignments §2 -- the candidate's document with the
// writing replaced by their submission and the feedback slots made editable.
// The tutor reads the work where the candidate wrote it and writes feedback
// into the exact slots the candidate will read it back from.
//
// The old marking form was a list of section boxes with a hidden criteria
// checklist in a sidebar. Two things were wrong with it beyond the look: the
// outcome was CHOSEN from three radio buttons while the criteria sat beside
// it saying something else, and there was no overall comment at all.
//
// Here the outcome is derived from the marks and nothing else, and the
// primary button carries it, so a tutor reads what they are about to do.

export type MarkingStage = "round1" | "second" | "agree" | "round2" | "closed";

const initialState: FormState = { error: null };
const SECTION_HUES = [TEAL, GOLD_INK, INK_WARM, INK_WARM, GARNET, MUTED, TEAL];

function wordCount(text: string): number {
  const cleaned = text.replace(/•/g, " ").trim();
  return cleaned.length === 0 ? 0 : cleaned.split(/\s+/).length;
}

export interface MarkingCriterion {
  key: string;
  text: string;
}

export interface MarkingSectionResponse {
  section_key: string;
  first_response: string | null;
  first_comments: string | null;
  resubmission_response: string | null;
  resubmission_comments: string | null;
}

export function AssignmentMarkingForm({
  assignmentId,
  candidateName,
  title,
  sections,
  responses,
  criteria,
  round,
  stage,
  sanction = false,
  format = "prose",
  wordMin = 750,
  wordMax = 1000,
  intro = null,
  marks: savedMarks,
  secondMarks,
  overallComment,
  secondOverallComment,
  priorOverallComment = null,
  firstMarkerName,
  secondMarkerName,
  viewerIsFirstMarker,
  viewerIsSecondMarker,
  firstInitialledAt,
  secondInitialledAt,
  inSample,
  secondMarkerOptions,
  submittedLabel,
  candidateHref,
}: {
  assignmentId: string;
  candidateName: string;
  title: string;
  sections: TemplateSection[];
  responses: MarkingSectionResponse[];
  criteria: MarkingCriterion[];
  round: "first" | "resubmission";
  stage: MarkingStage;
  sanction?: boolean;
  format?: "structured" | "prose";
  wordMin?: number;
  wordMax?: number;
  intro?: string | null;
  marks: Record<string, boolean>;
  secondMarks: Record<string, boolean>;
  overallComment: string | null;
  secondOverallComment: string | null;
  /** Round 1's overall comment, pinned read-only in round 2 and when closed. */
  priorOverallComment?: string | null;
  firstMarkerName: string | null;
  secondMarkerName: string | null;
  viewerIsFirstMarker: boolean;
  viewerIsSecondMarker: boolean;
  firstInitialledAt: string | null;
  secondInitialledAt: string | null;
  inSample: boolean;
  secondMarkerOptions: { id: string; full_name: string }[];
  submittedLabel: string;
  candidateHref: string;
}) {
  const autosize = useAutosize();
  const responseByKey = new Map(responses.map((r) => [r.section_key, r]));
  const isResub = round === "resubmission";
  const closed = stage === "closed";
  // The blind second marker marks from the script: the first marker's marks
  // and comments are not on this page at all, so they cannot be read off it.
  const blind = stage === "second";
  const settling = stage === "agree";

  const [marks, setMarks] = useState<Record<string, boolean>>(() => (blind ? secondMarks : savedMarks));
  const [overall, setOverall] = useState(() => (blind ? (secondOverallComment ?? "") : (overallComment ?? "")));
  const [comments, setComments] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const s of sections) {
      const r = responseByKey.get(s.key);
      initial[s.key] = (isResub ? r?.resubmission_comments : r?.first_comments) ?? "";
    }
    return initial;
  });
  const [secondMarkerId, setSecondMarkerId] = useState("");
  const [returning, setReturning] = useState(false);
  const [reason, setReason] = useState("");

  const [draftState, draftAction, draftPending] = useActionState(saveMarkingDraft, initialState);
  const [sendState, sendAction, sendPending] = useActionState(sendToSecondMarker, initialState);
  const [secondState, secondAction, secondPending] = useActionState(recordBlindSecondMark, initialState);
  const [settleState, settleAction, settlePending] = useActionState(settleAndInitial, initialState);
  const [passState, passAction, passPending] = useActionState(returnWithPass, initialState);
  const [resubState, resubAction, resubPending] = useActionState(returnForResubmission, initialState);
  const [failState, failAction, failPending] = useActionState(returnAsFail, initialState);
  const [returnState, returnAction, returnPending] = useActionState(returnUnmarked, initialState);
  const pending =
    draftPending || sendPending || secondPending || settlePending || passPending || resubPending || failPending || returnPending;
  const error =
    draftState.error ??
    sendState.error ??
    secondState.error ??
    settleState.error ??
    passState.error ??
    resubState.error ??
    failState.error ??
    returnState.error;

  const allMarked = criteria.length > 0 && criteria.every((c) => marks[c.key] !== undefined);
  const allMet = allMarked && criteria.every((c) => marks[c.key] === true);
  const outcome = !allMarked
    ? null
    : sanction
      ? allMet
        ? "Accepted"
        : "Not accepted"
      : isResub
        ? allMet
          ? "Pass on resubmission"
          : "Fail on resubmission"
        : allMet
          ? "Pass"
          : "Resubmission needed";
  const failType = allMarked && !allMet;
  const needsSecond = failType || inSample;
  const secondRecorded = stage === "agree" || stage === "closed";
  const bothInitialled = Boolean(firstInitialledAt && secondInitialledAt);

  // Handbook 9.2.2 -- a candidate told to rewrite has to be told where. With
  // no criterion-to-section tie in the record yet, the rule the screen can
  // honestly enforce is: a fail-type outcome needs at least one section
  // comment, so there is somewhere to rewrite from.
  const anySectionComment = sections.some((s) => (comments[s.key] ?? "").trim().length > 0);
  const blockers: string[] = [];
  if (!allMarked) blockers.push("Mark every criterion");
  if (!overall.trim()) blockers.push("Write the overall comment");
  if (failType && !anySectionComment) blockers.push("Comment on the section they rewrite from");
  if (needsSecond && !secondRecorded) blockers.push("Send it for a blind second mark");
  if (needsSecond && secondRecorded && !bothInitialled) blockers.push("Both markers initial it");

  const submission = (key: string) => {
    const r = responseByKey.get(key);
    return ((isResub ? r?.resubmission_response : r?.first_response) ?? "").trim();
  };
  const totalWords = useMemo(() => sections.reduce((n, s) => n + wordCount(submission(s.key)), 0), [sections, responses]); // eslint-disable-line react-hooks/exhaustive-deps
  const under = wordMin - totalWords;
  const over = totalWords - wordMax;
  const fitLabel = under > 0 ? `${under} under` : over > 0 ? `over by ${over}` : "within range";

  const bandRole = sanction ? "garnet" : "teal";
  const accent = sanction ? GARNET : TEAL;
  const hueFor = (i: number) => (sanction ? GARNET : SECTION_HUES[i % SECTION_HUES.length]);

  const stagePill =
    stage === "second"
      ? `Blind second mark · ${firstMarkerName ?? "another tutor"} marked it`
      : stage === "agree"
        ? "Both marked · settle and initial"
        : stage === "round2"
          ? "Resubmission · their one and only"
          : stage === "closed"
            ? "Closed"
            : submittedLabel;

  const hidden = (
    <>
      <input type="hidden" name="assignment_id" value={assignmentId} />
      <input type="hidden" name="round" value={round} />
      <input type="hidden" name="criteria_marks" value={JSON.stringify(marks)} />
      <input type="hidden" name="overall_comment" value={overall} />
      <input type="hidden" name="section_keys" value={JSON.stringify(sections.map((s) => ({ key: s.key, title: s.title })))} />
      {sections.map((s) => (
        <input key={s.key} type="hidden" name={`comment_${s.key}`} value={comments[s.key] ?? ""} />
      ))}
      <input type="hidden" name="second_marker_id" value={secondMarkerId} />
    </>
  );

  const primaryAction = blind
    ? secondAction
    : needsSecond && !secondRecorded
      ? sendAction
      : outcome === "Pass" || outcome === "Pass on resubmission" || outcome === "Accepted"
        ? passAction
        : isResub || sanction
          ? failAction
          : resubAction;

  const primaryLabel = blind
    ? `Record second mark${outcome ? ` · ${outcome}` : ""}`
    : needsSecond && !secondRecorded
      ? `Send to second marker${outcome ? ` · ${outcome}` : ""}`
      : `Release to candidate${outcome ? ` · ${outcome}` : ""}`;

  return (
    <DictationScope scopeId="marking">
      <TpSheet maxWidth={1320}>
        <IdentityBand
          role={bandRole}
          eyebrow={`Tutor marking · round ${isResub ? 2 : 1} · ${blind ? "second marker" : settling ? "settle and initial" : closed ? "closed" : "first marker"}`}
          title={
            <>
              {title} <i style={{ opacity: 0.75 }}>for</i> {candidateName}
            </>
          }
          status={
            <span className="flex items-center gap-2.5">
              <a
                href={candidateHref}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 11.5, color: "oklch(86% 0.04 195)", textDecoration: "underline" }}
              >
                Candidate&apos;s view
              </a>
              <span style={{ fontSize: 11.5, color: "oklch(86% 0.04 195)" }}>{stagePill}</span>
            </span>
          }
          showDictate={!closed}
        />

        {/* ---------- §2b strip ---------- */}
        <Strip>
          <div className="flex flex-col gap-0.5" style={{ minWidth: 240 }}>
            <Eyebrow>Word count</Eyebrow>
            <p style={{ fontSize: 12, color: MUTED }}>
              <span className="font-serif tabular-nums" style={{ fontSize: 18, color: INK }}>
                {totalWords}
              </span>{" "}
              of {wordMin}–{wordMax.toLocaleString()} ·{" "}
              <span style={{ fontWeight: 600, color: under > 0 || over > 0 ? GOLD_INK : TEAL }}>{fitLabel}</span>
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <Eyebrow>Markers</Eyebrow>
            <div className="flex flex-wrap items-center gap-1.5">
              <MarkerChip label="1st" name={firstMarkerName} />
              <MarkerChip
                label="2nd"
                name={secondMarkerName}
                dashed={!secondMarkerName}
                placeholder={needsSecond ? "to be assigned" : "—"}
              />
              {inSample ? (
                <span style={{ fontSize: 11, fontWeight: 600, color: TEAL, border: `1px solid ${TEAL}`, borderRadius: 999, padding: "2px 8px" }}>
                  In the sample
                </span>
              ) : null}
            </div>
          </div>
        </Strip>

        {/* ---------- §2c banners ---------- */}
        {blind ? (
          <Banner hue={TEAL}>
            <b>Blind second mark.</b> {firstMarkerName ?? "The first marker"}&apos;s marks and comments are not on this page.
            Mark from the script; recording yours reveals both sets so you can settle them together (Handbook 9.2.3).
          </Banner>
        ) : null}
        {settling ? (
          <Banner hue={disagreementCount(savedMarks, secondMarks, criteria) > 0 ? GARNET : TEAL}>
            {disagreementCount(savedMarks, secondMarks, criteria) > 0 ? (
              <>
                <b>Markers disagree on {disagreementCount(savedMarks, secondMarks, criteria)} criterion.</b> Settle each one
                — the mark you leave is the one the candidate receives.
              </>
            ) : (
              <>
                <b>Markers agree.</b> Initial it and release.
              </>
            )}
          </Banner>
        ) : null}
        {stage === "round2" ? (
          <Banner hue={GOLD_INK}>
            <b>Round 2.</b> This is the candidate&apos;s one resubmission. Whether they pass on the first or second round does
            not appear on their certificate.
          </Banner>
        ) : null}

        {/* ---------- §2d overall | marked against ---------- */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]" style={{ borderBottom: `1px solid ${FAINT}` }}>
          <div className="flex flex-col gap-2.5" style={{ padding: "16px 22px 18px 26px" }}>
            {intro ? (
              <details>
                <summary className="cursor-pointer italic" style={{ fontSize: 11.5, color: MUTED }}>
                  The brief the candidate read · show
                </summary>
                <p style={{ fontSize: 13, lineHeight: 1.55, color: INK, marginTop: 6 }}>{intro}</p>
              </details>
            ) : null}

            {priorOverallComment ? (
              <div style={{ borderRadius: 7, borderLeft: `3px solid ${TEAL}`, background: `color-mix(in oklab, ${TEAL} 9%, transparent)`, padding: "8px 11px" }}>
                <p className="uppercase" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: TEAL }}>
                  Overall comment, round 1 · the candidate saw this
                </p>
                <p style={{ fontSize: 13, lineHeight: 1.55, color: INK, whiteSpace: "pre-line" }}>{priorOverallComment}</p>
              </div>
            ) : null}

            <MarkerLabel colour={TEAL} label={blind ? "Your overall comment · for the record" : "Your overall comment"} />
            <p className="italic" style={{ fontSize: 11.5, color: MUTED, marginLeft: 12 }}>
              {blind
                ? "Yours is part of the double-marking record; the candidate reads the first marker's."
                : "Appears under “Before you start” on the candidate's page."}
            </p>
            {closed ? (
              <p style={{ fontSize: 14, lineHeight: 1.6, color: INK, whiteSpace: "pre-line", marginLeft: 12 }}>
                {overall || <span className="italic" style={{ color: MUTED }}>Nothing written.</span>}
              </p>
            ) : (
              <textarea
                ref={autosize}
                rows={3}
                value={overall}
                onInput={autosizeOnInput}
                onChange={(e) => setOverall(e.target.value)}
                data-dictate-label="Overall comment"
                placeholder="How the work reads as a whole, and what it does or does not yet do."
                style={{
                  ...plainField(14, INK, 1.6),
                  marginLeft: 12,
                  borderLeft: `2px solid ${overall.trim() ? TEAL : GOLD_INK}`,
                  paddingLeft: 10,
                  minHeight: 70,
                }}
              />
            )}
          </div>

          <div className="flex flex-col gap-2" style={{ borderLeft: `1px solid ${FAINT}`, padding: "16px 26px 18px 22px" }}>
            <MarkerLabel colour={TEAL} label="Marked against" />
            {criteria.length === 0 ? (
              <p className="italic" style={{ fontSize: 12, color: MUTED }}>
                Your centre has not set the criteria for this assignment yet.
              </p>
            ) : (
              <ol className="flex flex-col gap-2.5">
                {criteria.map((c, i) => {
                  const mark = marks[c.key];
                  const firstMark = savedMarks[c.key];
                  const secondMark = secondMarks[c.key];
                  const disputed = settling && firstMark !== undefined && secondMark !== undefined && firstMark !== secondMark;
                  return (
                    <li key={c.key} style={{ borderTop: i === 0 ? undefined : `1px dashed ${FAINT}`, paddingTop: i === 0 ? 0 : 8 }}>
                      <div className="grid gap-2" style={{ gridTemplateColumns: "16px minmax(0,1fr)" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: TEAL, paddingTop: 2 }}>{i + 1}</span>
                        <span style={{ fontSize: 12.5, lineHeight: 1.5, color: INK }}>
                          {c.text} <span className="italic" style={{ fontSize: 11, color: MUTED }}>— whole assignment</span>
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2" style={{ marginLeft: 22 }}>
                        {closed ? (
                          <Chip on={mark === true}>{mark === true ? "Met" : "Not met"}</Chip>
                        ) : (
                          <Segmented
                            value={mark}
                            onChange={(v) => setMarks({ ...marks, [c.key]: v })}
                            disabled={pending}
                          />
                        )}
                        {settling ? (
                          <>
                            <Chip on={firstMark === true} small>
                              1st · {firstMark === true ? "Met" : firstMark === false ? "Not met" : "—"}
                            </Chip>
                            <Chip on={secondMark === true} small>
                              2nd · {secondMark === true ? "Met" : secondMark === false ? "Not met" : "—"}
                            </Chip>
                          </>
                        ) : null}
                      </div>
                      {disputed ? (
                        <p style={{ fontSize: 11, color: GARNET, marginLeft: 22, marginTop: 3 }}>
                          Markers disagree — the mark above is the one that goes to the candidate.
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            )}

            {/* the outcome, derived */}
            <div
              style={{
                borderRadius: 8,
                background: !outcome ? CARD : failType ? `color-mix(in oklab, ${GOLD_INK} 12%, transparent)` : `color-mix(in oklab, ${TEAL} 10%, transparent)`,
                padding: "9px 12px",
                marginTop: 4,
              }}
            >
              <Eyebrow colour={MUTED}>{closed ? "Outcome" : settling ? "Agreed outcome" : "Outcome if released now"}</Eyebrow>
              <p className="font-serif" style={{ fontSize: 18, fontWeight: 600, color: !outcome ? MUTED : failType ? GOLD_INK : TEAL }}>
                {outcome ?? "Mark every criterion"}
              </p>
              <p style={{ fontSize: 11.5, lineHeight: 1.5, color: MUTED, marginTop: 2 }}>{outcomeNote(outcome, sanction, needsSecond && !secondRecorded)}</p>
            </div>
          </div>
        </div>

        {/* ---------- §2e the sections ---------- */}
        <div style={{ padding: "20px 26px 22px" }}>
          <div className="flex flex-wrap items-baseline gap-3">
            <h3 className="font-serif" style={{ fontSize: 21, fontWeight: 600, color: sanction ? GARNET : TEAL }}>
              {format === "structured" ? "The tasks" : "The essay"}
            </h3>
            <p className="italic" style={{ fontSize: 11.5, color: MUTED }}>
              {format === "structured"
                ? "Comment beside the step the point belongs to."
                : "The whole essay is judged together — the comment they rewrite from is the overall one."}
            </p>
          </div>

          <div className="mt-2">
            {sections.map((s, i) => {
              const text = submission(s.key);
              const words = wordCount(text);
              const hue = hueFor(i);
              const prior = isResub ? responseByKey.get(s.key)?.first_comments : null;
              const commentValue = comments[s.key] ?? "";
              const wantComment = failType && !anySectionComment;
              return (
                <div
                  key={s.key}
                  className="grid"
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
                        background: words > 0 ? hue : FAINT,
                      }}
                    />
                    <NumberedDot n={i + 1} hue={words > 0 ? hue : BORDER} done={words > 0} />
                  </div>

                  <div className="flex flex-col gap-[7px]" style={{ padding: "14px 18px 18px 0" }}>
                    <p className="font-serif" style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.25, color: INK }}>
                      {s.title}
                    </p>
                    {s.instruction ? (
                      <p className="italic" style={{ fontSize: 12.5, lineHeight: 1.5, color: MUTED }}>
                        {s.instruction}
                      </p>
                    ) : null}
                    <span
                      className="tabular-nums self-start"
                      style={{
                        borderRadius: 6,
                        padding: "3px 8px",
                        fontSize: 12.5,
                        fontWeight: 700,
                        background: words > 0 ? `color-mix(in oklab, ${hue} 13%, transparent)` : CARD,
                        color: words > 0 ? hue : MUTED,
                      }}
                    >
                      {words} words
                    </span>
                  </div>

                  <div className="flex flex-col gap-3" style={{ borderLeft: `1px solid ${FAINT}`, padding: "14px 0 18px 20px" }}>
                    {prior ? (
                      <div style={{ borderRadius: 7, borderLeft: `3px solid ${TEAL}`, background: `color-mix(in oklab, ${TEAL} 9%, transparent)`, padding: "8px 11px" }}>
                        <p className="uppercase" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: TEAL }}>
                          Your comment, round 1 · the candidate saw this
                        </p>
                        <p style={{ fontSize: 13, lineHeight: 1.55, color: INK, whiteSpace: "pre-line" }}>{prior}</p>
                      </div>
                    ) : null}

                    <p style={{ fontSize: 14, lineHeight: 1.6, color: INK, whiteSpace: "pre-line" }}>
                      {text || <span className="italic" style={{ color: MUTED }}>Nothing written.</span>}
                    </p>

                    {closed ? (
                      commentValue ? (
                        <div style={{ borderRadius: 7, borderLeft: `3px solid ${TEAL}`, background: `color-mix(in oklab, ${TEAL} 9%, transparent)`, padding: "8px 11px" }}>
                          <p style={{ fontSize: 13, lineHeight: 1.55, color: INK, whiteSpace: "pre-line" }}>{commentValue}</p>
                        </div>
                      ) : null
                    ) : (
                      <div
                        style={{
                          borderRadius: 7,
                          border: `1px solid ${wantComment && !commentValue.trim() ? GOLD_INK : FAINT}`,
                          borderLeft: `3px solid ${TEAL}`,
                          background: `color-mix(in oklab, ${TEAL} 5%, transparent)`,
                          padding: "8px 11px",
                        }}
                      >
                        <p className="uppercase" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: TEAL }}>
                          Your comment on this section{isResub ? " · round 2" : ""}
                        </p>
                        <p className="italic" style={{ fontSize: 11, color: wantComment && !commentValue.trim() ? GOLD_INK : MUTED, marginBottom: 4 }}>
                          {wantComment && !commentValue.trim()
                            ? "Required when something is Not met — this is what they rewrite from."
                            : "Shown at the top of this section on their page."}
                        </p>
                        <textarea
                          ref={autosize}
                          rows={2}
                          value={commentValue}
                          onInput={autosizeOnInput}
                          onChange={(e) => setComments({ ...comments, [s.key]: e.target.value })}
                          data-dictate-label={`Comment on ${s.title}`}
                          style={{ ...plainField(13, INK, 1.55) }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ---------- §2f foot ---------- */}
        <div className="grid grid-cols-1 rounded-b-[14px] lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]" style={{ borderTop: `1px solid ${FAINT}`, background: CARD }}>
          <div className="flex flex-col gap-3" style={{ padding: "18px 22px 22px 26px" }}>
            <MarkerLabel colour={sanction ? GARNET : TEAL} label="Double-marking record" />
            <p className="italic" style={{ fontSize: 11.5, color: MUTED, marginLeft: 12 }}>
              Handbook 9.2.3 — both tutors initial what they have checked, and the centre keeps the record.
            </p>
            <div className="flex flex-col gap-1.5" style={{ marginLeft: 12 }}>
              <InitialRow name={firstMarkerName} role="first marker" at={firstInitialledAt} />
              <InitialRow name={secondMarkerName} role="second marker" at={secondInitialledAt} />
            </div>
            {settling && !closed ? (
              <form action={settleAction} style={{ marginLeft: 12 }}>
                {hidden}
                <button
                  type="submit"
                  disabled={pending}
                  style={{ borderRadius: 8, background: accent, padding: "7px 15px", fontSize: 13, fontWeight: 600, color: SHEET }}
                >
                  {viewerIsSecondMarker ? "Settle and initial as second marker" : "Settle and initial as first marker"}
                </button>
              </form>
            ) : null}
            {needsSecond && !secondRecorded && !closed && !blind ? (
              <div className="flex flex-col gap-1.5" style={{ marginLeft: 12 }}>
                <label style={{ fontSize: 12, color: MUTED }}>Send for a blind second mark</label>
                <select
                  value={secondMarkerId}
                  onChange={(e) => setSecondMarkerId(e.target.value)}
                  style={{ borderRadius: 8, border: `1px solid ${BORDER}`, background: SHEET, padding: "7px 10px", fontSize: 13, color: INK }}
                >
                  <option value="">— choose a tutor —</option>
                  {secondMarkerOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.full_name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-3" style={{ borderLeft: `1px solid ${FAINT}`, padding: "18px 26px 22px 22px" }}>
            <MarkerLabel colour={GARNET} label="Return unmarked" />
            {returning ? (
              <form action={returnAction} className="flex flex-col gap-2" style={{ marginLeft: 12 }}>
                <input type="hidden" name="assignment_id" value={assignmentId} />
                <input type="hidden" name="round" value={round} />
                <p style={{ fontSize: 11.5, lineHeight: 1.5, color: MUTED }}>
                  For a wrong file, a missing appendix, or a declaration problem — not for the quality of the work. It goes
                  back with your reason on it and does not spend the resubmission. Nothing you have marked here is sent.
                </p>
                <textarea
                  ref={autosize}
                  rows={2}
                  name="reason"
                  value={reason}
                  onInput={autosizeOnInput}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="What they need to fix before handing it in again."
                  style={{ ...plainField(13, INK, 1.5) }}
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={pending || !reason.trim()}
                    style={{ borderRadius: 8, background: reason.trim() ? GARNET : BORDER, padding: "7px 14px", fontSize: 13, fontWeight: 600, color: reason.trim() ? SHEET : MUTED }}
                  >
                    Return to candidate unmarked
                  </button>
                  <button type="button" onClick={() => setReturning(false)} style={{ fontSize: 13, color: MUTED }}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <p className="italic" style={{ fontSize: 11.5, color: MUTED, marginLeft: 12 }}>
                {closed ? "Closed." : "A wrong file or a missing appendix goes back without a decision, and without spending the resubmission."}
              </p>
            )}
          </div>
        </div>
      </TpSheet>

      {/* ---------- §2g bottom bar ---------- */}
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
          <span className="size-[5px] shrink-0 rounded-full" style={{ background: blockers.length ? GOLD_INK : TEAL }} />
          <p style={{ fontSize: 11.5, color: blockers.length ? GOLD_INK : TEAL }}>
            {closed
              ? "Closed. Both rounds and both sets of comments are on the record."
              : blockers.length
                ? blockers[0]
                : needsSecond && !secondRecorded
                  ? "Nothing reaches the candidate yet — this goes for a blind second mark first."
                  : "This releases your marks and comments to the candidate."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {closed ? null : (
            <>
              <DictateButton variant="bar" hue={accent} />
              {!blind ? (
                <button type="button" onClick={() => setReturning((v) => !v)} style={{ fontSize: 13, color: GARNET }}>
                  Return unmarked…
                </button>
              ) : null}
              <form action={draftAction}>
                {hidden}
                <button
                  type="submit"
                  disabled={pending}
                  style={{ borderRadius: 8, border: `1px solid ${BAR_BORDER}`, background: SHEET, padding: "8px 15px", fontSize: 13.5, color: INK }}
                >
                  Save draft
                </button>
              </form>
              <form action={primaryAction}>
                {hidden}
                <button
                  type="submit"
                  disabled={pending || blockers.length > 0 || (needsSecond && !secondRecorded && !blind && !secondMarkerId)}
                  title={blockers[0] ?? undefined}
                  style={{
                    borderRadius: 8,
                    background: blockers.length ? "oklch(88% 0.016 82)" : accent,
                    padding: "8px 17px",
                    fontWeight: 600,
                    fontSize: 13.5,
                    color: blockers.length ? MUTED : SHEET,
                    cursor: blockers.length ? "not-allowed" : undefined,
                  }}
                >
                  {blockers.length ? blockers[0] : primaryLabel}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </DictationScope>
  );
}

function disagreementCount(first: Record<string, boolean>, second: Record<string, boolean>, criteria: MarkingCriterion[]): number {
  return criteria.filter((c) => first[c.key] !== undefined && second[c.key] !== undefined && first[c.key] !== second[c.key]).length;
}

function outcomeNote(outcome: string | null, sanction: boolean, needsSending: boolean): string {
  const tail = needsSending ? " A second marker is required before release." : "";
  if (!outcome) return "The outcome follows from the marks — it is not chosen." + tail;
  if (sanction) {
    return outcome === "Accepted"
      ? "The reflection is accepted and stays with the case." + tail
      : "One chance — there is no resubmission for a centre sanction." + tail;
  }
  if (outcome === "Pass") return "Released as a pass. Nothing further is needed." + tail;
  if (outcome === "Resubmission needed")
    return "The candidate gets their one resubmission, targeted at what is Not met. Passing then does not affect the certificate grade." + tail;
  if (outcome === "Pass on resubmission") return "Recorded as Pass (on resubmission), which does not appear on the certificate." + tail;
  // Handbook 11.6, not the "3 of 4" the handoff's note says: one failed
  // assignment MAY still allow a Pass with documented evidence, and rules out
  // Pass A; more than one rules out a Pass.
  return "Final. One failed assignment may still allow a Pass with documented evidence, and rules out Pass A; more than one rules out a Pass (Handbook 11.6)." + tail;
}

function Banner({ hue, children }: { hue: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2" style={{ background: `color-mix(in oklab, ${hue} 9%, transparent)`, padding: "12px 26px", borderBottom: `1px solid ${FAINT}` }}>
      <span className="mt-1.5 size-[6px] shrink-0 rounded-full" style={{ background: hue }} />
      <p style={{ fontSize: 12.5, lineHeight: 1.5, color: INK }}>{children}</p>
    </div>
  );
}

function MarkerChip({ label, name, dashed, placeholder }: { label: string; name: string | null; dashed?: boolean; placeholder?: string }) {
  return (
    <span
      style={{
        borderRadius: 999,
        border: `1px ${dashed ? "dashed" : "solid"} ${dashed ? GOLD_INK : BORDER}`,
        padding: "2px 9px",
        fontSize: 11,
        fontWeight: 600,
        color: dashed ? GOLD_INK : INK,
      }}
    >
      <span style={{ color: MUTED, marginRight: 4 }}>{label}</span>
      {name ?? placeholder ?? "—"}
    </span>
  );
}

function Segmented({ value, onChange, disabled }: { value: boolean | undefined; onChange: (v: boolean) => void; disabled: boolean }) {
  return (
    <span className="inline-flex" style={{ border: `1px solid ${BORDER}`, borderRadius: 999, padding: 2 }}>
      {[true, false].map((v) => {
        const on = value === v;
        return (
          <button
            key={String(v)}
            type="button"
            disabled={disabled}
            onClick={() => onChange(v)}
            style={{
              borderRadius: 999,
              padding: "4px 12px",
              fontSize: 11.5,
              fontWeight: 700,
              background: on ? (v ? TEAL : GOLD_INK) : "transparent",
              color: on ? SHEET : MUTED,
            }}
          >
            {v ? "Met" : "Not met"}
          </button>
        );
      })}
    </span>
  );
}

function Chip({ on, small, children }: { on: boolean; small?: boolean; children: React.ReactNode }) {
  return (
    <span
      style={{
        borderRadius: 6,
        padding: small ? "2px 7px" : "3px 9px",
        fontSize: small ? 10.5 : 11,
        fontWeight: 700,
        background: on ? `color-mix(in oklab, ${TEAL} 12%, transparent)` : `color-mix(in oklab, ${GOLD_INK} 14%, transparent)`,
        color: on ? TEAL : GOLD_INK,
      }}
    >
      {children}
    </span>
  );
}

function InitialRow({ name, role, at }: { name: string | null; role: string; at: string | null }) {
  const initials = (name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <p style={{ fontSize: 12.5, color: at ? INK : MUTED }}>
      <span
        className="mr-2 inline-flex items-center justify-center"
        style={{ width: 15, height: 15, borderRadius: 4, border: `1.5px solid ${at ? TEAL : BORDER}`, background: at ? TEAL : "transparent", color: SHEET, fontSize: 10 }}
      >
        {at ? "✓" : ""}
      </span>
      {initials || "—"} · {name ?? "not assigned"}, {role}
      {at ? ` · ${new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}
    </p>
  );
}
