"use client";

import { useEffect, useRef, useState } from "react";
import { CRITERIA_LABELS } from "@/lib/celta-criteria";
import { matchCriteriaCodes } from "@/lib/criteria-glossary";
import { suggestedCodesForAnchor, type FeedbackPoint } from "@/lib/tp-plan-content";
import { autosizeOnInput, useAutosize } from "@/lib/autosize";
import {
  BORDER,
  CARD,
  DESTRUCTIVE,
  FAINT,
  GARNET,
  GOLD,
  GOLD_INK,
  INK,
  INK_WARM,
  MUTED,
  MarkerLabel,
  SHEET,
  TEAL,
  ZEBRA,
  plainField,
} from "@/components/tp-sheet";
import type { Database } from "@/lib/supabase/types";

type TpPlan = Database["public"]["Tables"]["tp_plans"]["Row"];
type TpLanguageAnalysis = Database["public"]["Tables"]["tp_language_analyses"]["Row"];

// design_handoff_tp_feedback_cycle §1P — step 1 of tutor feedback, and the one
// genuinely new screen in that handoff.
//
// The tutor reads the plan as the trainee submitted it and clicks Comment on
// any PART of it. Each note remembers which part (`anchor`), so it can print
// twice in the assembled document: once on the feedback cover under Planning,
// and again beside the part of the plan it refers to. These notes ARE the
// planning points -- the same two arrays step 2 edits, not a separate store.
//
// Colour keeps doing the work: a note's left rule is its KIND (teal strength,
// gold-ink action point) and its anchor label is the PART's hue, so a rail of
// twelve notes still reads at a glance.

const STAGE_HUES = [TEAL, GOLD_INK, INK_WARM, INK_WARM, GARNET, MUTED, TEAL];

type Kind = "strength" | "action";
type RailNote = { kind: Kind; index: number; point: FeedbackPoint };

export function PlanReview({
  tpNumber,
  plan,
  languageAnalysis,
  strengths,
  actionPoints,
  onStrengthsChange,
  onActionPointsChange,
  autoTagEnabled,
  glossary,
}: {
  tpNumber: number;
  plan: TpPlan | null;
  languageAnalysis: TpLanguageAnalysis | null;
  strengths: FeedbackPoint[];
  actionPoints: FeedbackPoint[];
  onStrengthsChange: (points: FeedbackPoint[]) => void;
  onActionPointsChange: (points: FeedbackPoint[]) => void;
  autoTagEnabled: boolean;
  /** The centre's own glossary, built-ins merged in. */
  glossary?: Record<string, string[]>;
}) {
  const autosize = useAutosize();
  const [focusAnchor, setFocusAnchor] = useState<string | null>(null);
  const [flashed, setFlashed] = useState<string | null>(null);

  if (!plan) {
    return (
      <div style={{ padding: "28px 26px" }}>
        <p style={{ fontSize: 13, color: MUTED }}>
          There is no lesson plan to review yet. Step 2 is still open — the lesson happened whether or not the plan was
          handed in.
        </p>
      </div>
    );
  }

  const procedure = plan.procedure ?? [];
  const problems = (plan.anticipated_problems ?? []).filter((p) => p.problem || p.solution);
  const vocabRows = languageAnalysis?.vocab_rows ?? [];
  const laBlocks = languageAnalysis?.blocks ?? [];
  const hueFor = (i: number) => (plan.framework_used ? STAGE_HUES[i % STAGE_HUES.length] : BORDER);

  // The rail, in the order the parts appear in the plan.
  const rail: RailNote[] = [
    ...strengths.map((point, index) => ({ kind: "strength" as Kind, index, point })),
    ...actionPoints.map((point, index) => ({ kind: "action" as Kind, index, point })),
  ].sort((a, b) => anchorRank(a.point.anchor) - anchorRank(b.point.anchor));

  const strengthCount = strengths.length;
  const actionCount = actionPoints.length;

  function notesOn(anchor: string) {
    return [
      ...strengths.filter((p) => p.anchor === anchor).map(() => "strength" as Kind),
      ...actionPoints.filter((p) => p.anchor === anchor).map(() => "action" as Kind),
    ];
  }

  function addNote(anchor: string) {
    const point: FeedbackPoint = {
      text: "",
      criteria_codes: suggestedCodesForAnchor(anchor),
      starred: false,
      anchor,
    };
    onStrengthsChange([...strengths, point]);
    setFocusAnchor(anchor);
  }

  function updateNote(note: RailNote, patch: Partial<FeedbackPoint>) {
    if (note.kind === "strength") {
      onStrengthsChange(strengths.map((p, i) => (i === note.index ? { ...p, ...patch } : p)));
    } else {
      onActionPointsChange(actionPoints.map((p, i) => (i === note.index ? { ...p, ...patch } : p)));
    }
  }

  function removeNote(note: RailNote) {
    if (note.kind === "strength") onStrengthsChange(strengths.filter((_, i) => i !== note.index));
    else onActionPointsChange(actionPoints.filter((_, i) => i !== note.index));
  }

  /** Strength ⇄ action point. Switching to Strength clears the star. */
  function setKind(note: RailNote, kind: Kind) {
    if (note.kind === kind) return;
    if (kind === "action") {
      onStrengthsChange(strengths.filter((_, i) => i !== note.index));
      onActionPointsChange([...actionPoints, note.point]);
    } else {
      onActionPointsChange(actionPoints.filter((_, i) => i !== note.index));
      onStrengthsChange([...strengths, { ...note.point, starred: false }]);
    }
  }

  function scrollToPart(anchor: string) {
    const el = document.getElementById(`plan-part-${anchor}`);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    setFlashed(anchor);
    setTimeout(() => setFlashed(null), 1200);
  }

  const partProps = (anchor: string) => ({
    id: `plan-part-${anchor}`,
    style: {
      position: "relative" as const,
      borderBottom: `1px solid ${FAINT}`,
      padding: "16px 26px 18px",
      background: flashed === anchor ? ZEBRA : undefined,
      transition: "background 400ms",
    },
  });

  return (
    <>
      {/* Instruction strip with live counts */}
      <div
        className="flex flex-wrap items-center justify-between gap-3"
        style={{ background: CARD, borderBottom: `1px solid ${FAINT}`, padding: "11px 26px" }}
      >
        <p style={{ fontSize: 12.5, color: INK_WARM }}>
          Read the plan as the trainee submitted it. Click <b>Comment</b> on any part to attach a note to it — every note
          becomes a Planning point in the feedback and prints beside that part of the plan.
        </p>
        <p className="whitespace-nowrap" style={{ fontSize: 12.5, color: MUTED }}>
          <span className="font-serif" style={{ fontSize: 17, color: INK }}>
            {strengthCount + actionCount}
          </span>{" "}
          {strengthCount + actionCount === 1 ? "note" : "notes"} ·{" "}
          <span style={{ fontWeight: 600, color: TEAL }}>
            {strengthCount} {strengthCount === 1 ? "strength" : "strengths"}
          </span>{" "}
          ·{" "}
          <span style={{ fontWeight: 600, color: GOLD_INK }}>
            {actionCount} {actionCount === 1 ? "action point" : "action points"}
          </span>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* ---------------- the plan, as parts ---------------- */}
        <div style={{ borderRight: `1px solid ${FAINT}` }}>
          <div {...partProps("aims")}>
            <PartHead
              label="Aims"
              colour={TEAL}
              notes={notesOn("aims")}
              onComment={() => addNote("aims")}
            />
            <div style={{ marginLeft: 12, marginTop: 6, fontSize: 13.5, lineHeight: 1.55, color: INK }}>
              <AimLine label="Main" value={plan.main_aims} />
              <AimLine label="Subsidiary" value={plan.subsidiary_aims} />
              <AimLine label="Personal" value={plan.personal_aims} />
            </div>
          </div>

          {procedure.map((row, i) => {
            const anchor = `stage-${i + 1}`;
            const hue = hueFor(i);
            return (
              <div key={anchor} {...partProps(anchor)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span
                      className="flex shrink-0 items-center justify-center rounded-full"
                      style={{ width: 22, height: 22, background: hue, color: SHEET, fontSize: 10.5, fontWeight: 700 }}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <h4 className="font-serif" style={{ fontSize: 16, fontWeight: 600, color: hue }}>
                        {row.stage || `Stage ${i + 1}`}
                      </h4>
                      <p className="italic" style={{ fontSize: 11.5, color: MUTED }}>
                        {[row.aim, row.time ? `${row.time}′` : null].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </div>
                  <CommentButton notes={notesOn(anchor)} onClick={() => addNote(anchor)} />
                </div>
                {row.procedure ? (
                  <p style={{ marginLeft: 31, marginTop: 6, fontSize: 13, lineHeight: 1.6, color: INK, whiteSpace: "pre-line" }}>
                    {row.procedure}
                  </p>
                ) : null}
                {row.interaction ? (
                  <div className="flex flex-wrap gap-1.5" style={{ marginLeft: 31, marginTop: 6 }}>
                    {row.interaction
                      .split(/[,+]/)
                      .map((c) => c.trim())
                      .filter(Boolean)
                      .map((code) => (
                        <span
                          key={code}
                          style={{ borderRadius: 6, border: `1px solid ${BORDER}`, background: CARD, padding: "1px 8px", fontSize: 11.5, fontWeight: 600, color: INK_WARM }}
                        >
                          {code}
                        </span>
                      ))}
                  </div>
                ) : null}
              </div>
            );
          })}

          {problems.length > 0 ? (
            <div {...partProps("problems")} style={{ ...partProps("problems").style, background: flashed === "problems" ? ZEBRA : CARD }}>
              <PartHead label="Anticipated problems & solutions" colour={GARNET} notes={notesOn("problems")} onComment={() => addNote("problems")} />
              <div style={{ marginLeft: 12, marginTop: 6 }}>
                {problems.map((p, i) => (
                  <p key={i} style={{ fontSize: 13, lineHeight: 1.6, color: INK }}>
                    <span style={{ fontWeight: 700, color: GARNET }}>{i + 1} </span>
                    {p.problem} <span style={{ color: TEAL }}>→</span>{" "}
                    <span style={{ color: INK_WARM }}>{p.solution}</span>
                  </p>
                ))}
              </div>
            </div>
          ) : null}

          <div {...partProps("room")} style={{ ...partProps("room").style, background: flashed === "room" ? ZEBRA : CARD }}>
            <PartHead label="Class profile & materials" colour={TEAL} notes={notesOn("room")} onComment={() => addNote("room")} />
            <div style={{ marginLeft: 12, marginTop: 6, fontSize: 13, lineHeight: 1.55, color: INK }}>
              {plan.class_profile ? <p style={{ whiteSpace: "pre-line" }}>{plan.class_profile}</p> : null}
              {plan.materials_description ? (
                <p style={{ marginTop: 6, whiteSpace: "pre-line", color: INK_WARM }}>{plan.materials_description}</p>
              ) : null}
              {!plan.class_profile && !plan.materials_description ? (
                <p className="italic" style={{ color: MUTED }}>
                  Nothing written here.
                </p>
              ) : null}
            </div>
          </div>

          {languageAnalysis ? (
            <>
              <div {...partProps("la")} style={{ ...partProps("la").style, background: flashed === "la" ? ZEBRA : CARD }}>
                <PartHead
                  label={`Language analysis · ${languageAnalysis.type === "vocab" ? "vocabulary" : languageAnalysis.type}`}
                  colour={GOLD_INK}
                  notes={notesOn("la")}
                  onComment={() => addNote("la")}
                />
                <p style={{ marginLeft: 12, marginTop: 4, fontSize: 11.5, color: MUTED }}>
                  {vocabRows.length > 0
                    ? `${vocabRows.length} items${languageAnalysis.vocab_reference ? ` · ${languageAnalysis.vocab_reference}` : ""}`
                    : `${laBlocks.length} ${laBlocks.length === 1 ? "structure" : "structures"}`}
                </p>
              </div>

              {vocabRows.length > 0 ? (
                <div style={{ padding: "0 26px 20px", overflowX: "auto" }}>
                  <table className="w-full border-collapse" style={{ minWidth: 760, fontSize: 12.5 }}>
                    <thead>
                      <tr>
                        {["Item", "Definition", "Convey", "Clarification", "Form", "Problems & solutions"].map((h) => (
                          <th
                            key={h}
                            className="text-left"
                            style={{ padding: "8px 8px", fontSize: 11, fontWeight: 700, color: INK_WARM, borderBottom: `1.5px solid ${GOLD_INK}` }}
                          >
                            {h}
                          </th>
                        ))}
                        <th style={{ width: 88, borderBottom: `1.5px solid ${GOLD_INK}` }} />
                      </tr>
                    </thead>
                    <tbody>
                      {vocabRows.map((row, i) => {
                        const anchor = `vocab-${i + 1}`;
                        return (
                          <tr key={anchor} id={`plan-part-${anchor}`} style={{ background: flashed === anchor ? ZEBRA : i % 2 ? ZEBRA : undefined }}>
                            {(["item", "definition", "convey", "clarification", "form", "problems"] as const).map((k, ci) => (
                              <td
                                key={k}
                                className="align-top"
                                style={{
                                  padding: "8px",
                                  lineHeight: 1.45,
                                  whiteSpace: "pre-line",
                                  color: ci === 0 ? INK : INK_WARM,
                                  fontWeight: ci === 0 ? 600 : 400,
                                  borderBottom: `1px solid ${FAINT}`,
                                }}
                              >
                                {row[k]}
                              </td>
                            ))}
                            <td className="align-top" style={{ padding: "8px", borderBottom: `1px solid ${FAINT}` }}>
                              <CommentButton notes={notesOn(anchor)} onClick={() => addNote(anchor)} compact />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {laBlocks.map((block, i) => {
                const anchor = `block-${i + 1}`;
                return (
                  <div key={anchor} {...partProps(anchor)}>
                    <PartHead
                      label={block.item ? `Structure ${i + 1} · ${block.item}` : `Structure ${i + 1}`}
                      colour={GOLD_INK}
                      notes={notesOn(anchor)}
                      onComment={() => addNote(anchor)}
                    />
                    {block.meaning ? (
                      <p style={{ marginLeft: 12, marginTop: 6, fontSize: 13, lineHeight: 1.55, color: INK_WARM, whiteSpace: "pre-line" }}>
                        {block.meaning}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </>
          ) : null}
        </div>

        {/* ---------------- the notes rail ---------------- */}
        <div style={{ background: CARD }}>
          <div
            className="flex flex-col gap-3"
            style={{ position: "sticky", top: 0, maxHeight: "calc(100vh - 100px)", overflowY: "auto", padding: "16px 18px 20px" }}
          >
            <div className="flex items-center justify-between gap-2">
              <MarkerLabel colour={INK_WARM} label="Your notes on the plan" />
              <span style={{ fontSize: 11, color: MUTED }}>Planning column</span>
            </div>

            {rail.length === 0 ? (
              <div
                className="text-center"
                style={{ borderRadius: 10, border: `1px dashed ${BORDER}`, padding: "18px 16px", fontSize: 12.5, color: MUTED }}
              >
                Nothing yet. Click Comment on an aim, a stage, the problems or a vocabulary item.
              </div>
            ) : (
              rail.map((note) => (
                <NoteCard
                  key={`${note.kind}-${note.index}`}
                  note={note}
                  tpNumber={tpNumber}
                  autosize={autosize}
                  autoFocus={focusAnchor === note.point.anchor && !note.point.text}
                  autoTagEnabled={autoTagEnabled}
                  glossary={glossary}
                  onChange={(patch) => updateNote(note, patch)}
                  onKind={(kind) => setKind(note, kind)}
                  onRemove={() => removeNote(note)}
                  onJump={() => note.point.anchor && scrollToPart(note.point.anchor)}
                  anchorLabel={anchorLabel(note.point.anchor, procedure.map((r) => r.stage), vocabRows.map((r) => r.item))}
                  anchorHue={anchorHue(note.point.anchor, hueFor)}
                />
              ))
            )}

            <p style={{ marginTop: "auto", borderTop: `1px solid ${BORDER}`, paddingTop: 12, fontSize: 11.5, lineHeight: 1.5, color: MUTED }}>
              These notes appear in three places: the <b>Planning</b> column of step 2, the feedback cover of the
              assembled document, and beside the part of the plan they refer to.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ pieces

function AimLine({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <p style={{ whiteSpace: "pre-line" }}>
      <span style={{ fontWeight: 600, color: MUTED }}>{label} — </span>
      {value}
    </p>
  );
}

function PartHead({
  label,
  colour,
  notes,
  onComment,
}: {
  label: string;
  colour: string;
  notes: Kind[];
  onComment: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <MarkerLabel colour={colour} label={label} />
      <CommentButton notes={notes} onClick={onComment} />
    </div>
  );
}

function CommentButton({ notes, onClick, compact = false }: { notes: Kind[]; onClick: () => void; compact?: boolean }) {
  const has = notes.length > 0;
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      {notes.map((kind, i) => (
        <span
          key={i}
          className="rounded-full"
          style={{ width: 8, height: 8, background: kind === "strength" ? TEAL : GOLD_INK, display: "inline-block" }}
        />
      ))}
      <button
        type="button"
        onClick={onClick}
        className="rounded-full"
        style={{
          border: `1px dashed ${has ? TEAL : BORDER}`,
          background: has ? `color-mix(in oklab, ${TEAL} 8%, transparent)` : "transparent",
          padding: compact ? "1px 8px" : "3px 11px",
          fontSize: compact ? 11 : 11.5,
          fontWeight: 700,
          color: has ? TEAL : MUTED,
        }}
      >
        {compact ? (has ? `· ${notes.length}` : "+") : has ? `Comment · ${notes.length}` : "Comment"}
      </button>
    </span>
  );
}

function NoteCard({
  note,
  tpNumber,
  autosize,
  autoFocus,
  autoTagEnabled,
  glossary,
  onChange,
  onKind,
  onRemove,
  onJump,
  anchorLabel,
  anchorHue,
}: {
  note: RailNote;
  tpNumber: number;
  autosize: (el: HTMLTextAreaElement | null) => void;
  autoFocus: boolean;
  autoTagEnabled: boolean;
  glossary?: Record<string, string[]>;
  onChange: (patch: Partial<FeedbackPoint>) => void;
  onKind: (kind: Kind) => void;
  onRemove: () => void;
  onJump: () => void;
  anchorLabel: string;
  anchorHue: string;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const [touched, setTouched] = useState(Boolean(note.point.text));
  const kindHue = note.kind === "strength" ? TEAL : GOLD_INK;
  const empty = !note.point.text.trim();

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  // The glossary still runs on the text, on top of the codes the part
  // suggested. Suggestions stop being called suggestions the moment the tutor
  // edits the note.
  useEffect(() => {
    if (!autoTagEnabled || !touched) return;
    const t = setTimeout(() => {
      const matched = matchCriteriaCodes(note.point.text, glossary).filter((c) => c.startsWith("4"));
      const added = matched.filter((c) => !note.point.criteria_codes.includes(c));
      if (added.length > 0) onChange({ criteria_codes: [...note.point.criteria_codes, ...added] });
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.point.text, touched, autoTagEnabled]);

  return (
    <div
      className="flex flex-col gap-2"
      style={{
        borderRadius: 10,
        border: `1px solid ${empty ? TEAL : FAINT}`,
        borderLeft: `4px solid ${kindHue}`,
        background: SHEET,
        padding: "11px 12px 12px",
        boxShadow: empty ? "0 6px 18px oklch(23.5% 0.017 65 / 0.12)" : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={onJump} className="flex min-w-0 items-center gap-1.5 text-left">
          <span className="rounded-full" style={{ width: 8, height: 8, background: anchorHue, display: "inline-block" }} />
          <span
            className="truncate uppercase"
            style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: anchorHue }}
          >
            {anchorLabel}
          </span>
        </button>
        <button
          type="button"
          onClick={onRemove}
          title="Remove"
          className="shrink-0 opacity-50 transition-opacity hover:opacity-100"
          style={{ color: DESTRUCTIVE, fontSize: 12 }}
        >
          ✕
        </button>
      </div>

      <div className="inline-flex w-fit rounded-full" style={{ border: `1px solid ${BORDER}`, padding: 2 }}>
        {(["strength", "action"] as Kind[]).map((kind) => {
          const on = note.kind === kind;
          return (
            <button
              key={kind}
              type="button"
              onClick={() => onKind(kind)}
              className="rounded-full"
              style={{
                padding: "3px 10px",
                fontSize: 11,
                fontWeight: 700,
                background: on ? (kind === "strength" ? TEAL : GOLD_INK) : "transparent",
                color: on ? SHEET : MUTED,
              }}
            >
              {kind === "strength" ? "Strength" : "Action point"}
            </button>
          );
        })}
      </div>

      <textarea
        ref={(el) => {
          ref.current = el;
          autosize(el);
        }}
        rows={1}
        value={note.point.text}
        onInput={autosizeOnInput}
        onChange={(e) => {
          setTouched(true);
          onChange({ text: e.target.value });
        }}
        placeholder={note.kind === "strength" ? "What works here — one point" : "What should change, and how — one point"}
        data-dictate-label={`note on ${anchorLabel.toLowerCase()}`}
        style={{ ...plainField(13, INK, 1.55), borderBottom: `1px solid ${BORDER}`, paddingBottom: 3 }}
      />

      <div className="flex items-end justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          {note.point.criteria_codes.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => onChange({ criteria_codes: note.point.criteria_codes.filter((c) => c !== code) })}
              title={`${CRITERIA_LABELS[code] ?? code} — click to remove`}
              style={{ borderRadius: 4, background: kindHue, padding: "1px 6px", fontSize: 10.5, fontWeight: 700, color: SHEET }}
            >
              {code}
            </button>
          ))}
          {!touched && note.point.criteria_codes.length > 0 ? (
            <span className="italic" style={{ fontSize: 10.5, color: MUTED }}>
              suggested for this part — edit in step 2
            </span>
          ) : null}
        </div>
        {note.kind === "action" ? (
          <button
            type="button"
            onClick={() => onChange({ starred: !note.point.starred })}
            title={`Prioritise this in TP${tpNumber + 1} — carries into their Personal Aims`}
            className="flex shrink-0 items-center justify-center rounded-full"
            style={{
              width: 24,
              height: 24,
              border: `1px solid ${note.point.starred ? GOLD_INK : FAINT}`,
              background: note.point.starred ? GOLD : "transparent",
              color: note.point.starred ? INK : MUTED,
              fontSize: 12,
            }}
          >
            ★
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ anchors

function anchorRank(anchor: string | undefined): number {
  if (!anchor) return 9000;
  if (anchor === "aims") return 0;
  if (anchor.startsWith("stage-")) return 10 + Number(anchor.slice(6));
  if (anchor === "problems") return 500;
  if (anchor === "room") return 510;
  if (anchor === "la") return 600;
  if (anchor.startsWith("vocab-")) return 610 + Number(anchor.slice(6));
  if (anchor.startsWith("block-")) return 700 + Number(anchor.slice(6));
  return 8000;
}

function anchorLabel(anchor: string | undefined, stageNames: string[], vocabItems: string[]): string {
  if (!anchor) return "Unanchored";
  if (anchor === "aims") return "Aims";
  if (anchor === "problems") return "Problems & solutions";
  if (anchor === "room") return "Class profile & materials";
  if (anchor === "la") return "Language analysis";
  if (anchor.startsWith("stage-")) {
    const n = Number(anchor.slice(6));
    const name = stageNames[n - 1];
    return name ? `Stage ${n} · ${name}` : `Stage ${n}`;
  }
  if (anchor.startsWith("vocab-")) {
    const n = Number(anchor.slice(6));
    const item = vocabItems[n - 1];
    return item ? `LA item · ${item}` : `LA item ${n}`;
  }
  if (anchor.startsWith("block-")) return `LA structure ${anchor.slice(6)}`;
  return anchor;
}

function anchorHue(anchor: string | undefined, hueFor: (i: number) => string): string {
  if (!anchor) return MUTED;
  if (anchor === "aims" || anchor === "room") return TEAL;
  if (anchor === "problems") return GARNET;
  if (anchor.startsWith("stage-")) return hueFor(Number(anchor.slice(6)) - 1);
  return GOLD_INK;
}
