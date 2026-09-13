"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { CELTA_CRITERIA_SECTIONS, CRITERIA_LABELS } from "@/lib/celta-criteria";
import { matchCriteriaCodes } from "@/lib/criteria-glossary";
import { emptyFeedbackPoint, type FeedbackPoint } from "@/lib/tp-plan-content";
import { cleanupFeedbackToneForCourse } from "@/app/dashboard/trainer/tone-cleanup-actions";
import { autosizeOnInput, useAutosize } from "@/lib/autosize";
import { bulletListProps } from "@/lib/bullet-list";
import {
  BORDER,
  DESTRUCTIVE,
  FAINT,
  GOLD,
  GOLD_INK,
  INK,
  INK_WARM,
  MUTED,
  SHEET,
  TEAL,
  plainField,
} from "@/components/tp-sheet";
import type { FeedbackTone } from "@/lib/supabase/types";

// design_handoff_tp_feedback_cycle §1c.
//
// A point is a dot, the text, and its criteria tags. The dot takes the
// SECTION's hue -- teal for strengths, gold-ink for action points -- and stays
// faint until something is written, the same "colour arrives as you write"
// rule the lesson plan uses. The column around it is a different hue again
// (Planning ink-warm, Teaching garnet), so at a glance you can see which half
// of the assessment a point belongs to and whether it praises or asks.

const PLANNING_SECTIONS = ["4"];
const TEACHING_SECTIONS = ["1", "2", "3", "5"];

export function FeedbackPointEditor({
  label,
  guide,
  points,
  onChange,
  scope,
  starable,
  autoTagEnabled,
  toneAssistEnabled = false,
  sectionHue,
  tpNumber,
  glossary,
}: {
  label: string;
  guide: string;
  points: FeedbackPoint[];
  onChange: (points: FeedbackPoint[]) => void;
  scope: "planning" | "teaching";
  starable: boolean;
  autoTagEnabled: boolean;
  toneAssistEnabled?: boolean;
  /** Teal for strengths, gold-ink for action points. */
  sectionHue: string;
  tpNumber: number;
  /** The centre's own glossary, built-ins merged in. Edited from the
   *  Criteria glossary screen by any tutor or the Centre manager. */
  glossary?: Record<string, string[]>;
}) {
  const sections = CELTA_CRITERIA_SECTIONS.filter((s) =>
    (scope === "planning" ? PLANNING_SECTIONS : TEACHING_SECTIONS).includes(s.section)
  );

  return (
    <div className="flex flex-col gap-2.5" style={{ padding: "16px 26px 20px", borderBottom: `1px solid ${FAINT}` }}>
      <div className="flex items-center gap-2">
        <span style={{ width: 3, height: 12, borderRadius: 2, background: sectionHue, display: "inline-block" }} />
        <span className="uppercase" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: sectionHue }}>
          {label}
        </span>
      </div>
      <p className="italic" style={{ fontSize: 11.5, color: MUTED, marginLeft: 12 }}>
        {guide}
      </p>
      <div className="flex flex-col">
        {points.map((point, i) => (
          <PointRow
            key={i}
            point={point}
            sections={sections}
            sectionHue={sectionHue}
            starable={starable}
            autoTagEnabled={autoTagEnabled}
            toneAssistEnabled={toneAssistEnabled}
            tpNumber={tpNumber}
            glossary={glossary}
            onChange={(patch) => onChange(points.map((p, x) => (x === i ? { ...p, ...patch } : p)))}
            onRemove={() => onChange(points.filter((_, x) => x !== i))}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange([...points, emptyFeedbackPoint()])}
        className="self-start rounded-full"
        style={{ border: `1px dashed ${BORDER}`, padding: "5px 13px", fontSize: 12.5, color: MUTED }}
      >
        + Add point
      </button>
    </div>
  );
}

function PointRow({
  point,
  sections,
  sectionHue,
  starable,
  autoTagEnabled,
  toneAssistEnabled,
  tpNumber,
  glossary,
  onChange,
  onRemove,
}: {
  point: FeedbackPoint;
  sections: typeof CELTA_CRITERIA_SECTIONS extends readonly (infer T)[] ? T[] : never;
  sectionHue: string;
  starable: boolean;
  autoTagEnabled: boolean;
  toneAssistEnabled: boolean;
  tpNumber: number;
  glossary?: Record<string, string[]>;
  onChange: (patch: Partial<FeedbackPoint>) => void;
  onRemove: () => void;
}) {
  const autosize = useAutosize();
  const [panelOpen, setPanelOpen] = useState(false);
  const [tone, setTone] = useState<FeedbackTone | null>(null);
  const [isRewriting, startRewrite] = useTransition();
  const [toneError, setToneError] = useState<string | null>(null);
  const [autoTagged, setAutoTagged] = useState(false);

  // The criteria auto-tagger. It is meant to behave like autocorrect -- and
  // the point of autocorrect is that you can undo it. Unchecking a code used
  // to put it straight back 600ms later, because the effect listed
  // criteria_codes among its own dependencies and so re-ran on its own output.
  // Criteria codes are the assessment evidence the assessor and Cambridge
  // read, so a tutor has to be able to refuse one (Ramy, 12 Sep 2026).
  //
  //  - `rejected` remembers what the tutor took off; never re-added.
  //  - matches are filtered to the codes THIS point's panel offers, so a
  //    planning point can no longer pick up a teaching code it has no
  //    checkbox for.
  //  - codes the tagger added itself come off when the text stops matching;
  //    anything ticked by hand stays.
  const allowedCodes = useMemo(() => new Set<string>(sections.flatMap((s) => s.codes)), [sections]);
  const autoAdded = useRef<Set<string>>(new Set());
  const rejected = useRef<Set<string>>(new Set());
  const pointRef = useRef(point);
  pointRef.current = point;

  useEffect(() => {
    if (!autoTagEnabled) return;
    const timeout = setTimeout(() => {
      const current = pointRef.current;
      const matched = matchCriteriaCodes(current.text, glossary).filter((c) => allowedCodes.has(c));
      const kept = current.criteria_codes.filter((c) => !autoAdded.current.has(c) || matched.includes(c));
      for (const code of current.criteria_codes) {
        if (autoAdded.current.has(code) && !matched.includes(code)) autoAdded.current.delete(code);
      }
      const added = matched.filter((c) => !kept.includes(c) && !rejected.current.has(c));
      for (const code of added) autoAdded.current.add(code);
      const next = [...kept, ...added];
      if (next.length !== current.criteria_codes.length || next.some((c, i) => c !== current.criteria_codes[i])) {
        onChange({ criteria_codes: next });
        if (added.length > 0) setAutoTagged(true);
      }
    }, 600);
    return () => clearTimeout(timeout);
  }, [point.text, autoTagEnabled, allowedCodes, glossary, onChange]);

  function toggleCriteria(code: string) {
    const has = point.criteria_codes.includes(code);
    if (has) {
      rejected.current.add(code);
      autoAdded.current.delete(code);
    } else {
      rejected.current.delete(code);
      autoAdded.current.delete(code);
    }
    setAutoTagged(false);
    onChange({
      criteria_codes: has ? point.criteria_codes.filter((c) => c !== code) : [...point.criteria_codes, code],
    });
  }

  function toggleTone() {
    const nextTone: FeedbackTone = tone === "direct" ? "supportive" : "direct";
    const text = point.text.trim();
    if (!text) {
      setToneError("Write a point first.");
      return;
    }
    setToneError(null);
    startRewrite(async () => {
      const result = await cleanupFeedbackToneForCourse(text, nextTone);
      if (result.error) {
        setToneError(result.error);
        return;
      }
      setTone(nextTone);
      if (result.text) onChange({ text: result.text });
    });
  }

  const written = Boolean(point.text.trim());

  return (
    <div
      className="relative grid items-start gap-2.5"
      style={{ gridTemplateColumns: "12px minmax(0,1fr) auto", borderTop: `1px dashed ${FAINT}`, paddingTop: 10, paddingBottom: 6 }}
    >
      <span
        className="rounded-full"
        style={{ width: 6, height: 6, marginTop: 7, background: written ? sectionHue : FAINT, display: "inline-block" }}
      />

      <div className="flex min-w-0 flex-col gap-1.5">
        <textarea
          ref={autosize}
          rows={1}
          value={point.text}
          onInput={autosizeOnInput}
          onChange={(e) => {
            setAutoTagged(false);
            onChange({ text: e.target.value });
          }}
          placeholder="Write one point — then tag it"
          data-dictate-label="a feedback point"
          {...bulletListProps}
          style={plainField(13.5)}
        />
        {toneError ? <p style={{ fontSize: 11, color: DESTRUCTIVE }}>{toneError}</p> : null}

        <div className="flex flex-wrap items-center gap-1">
          {point.criteria_codes.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => toggleCriteria(code)}
              title={`${CRITERIA_LABELS[code] ?? code} — click to remove`}
              style={{
                borderRadius: 4,
                background: sectionHue,
                padding: "1px 7px",
                fontSize: 10.5,
                fontWeight: 700,
                color: SHEET,
              }}
            >
              {code}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPanelOpen(!panelOpen)}
            style={{
              borderRadius: 4,
              border: `1px dashed ${BORDER}`,
              padding: "1px 7px",
              fontSize: 10.5,
              fontWeight: 700,
              color: MUTED,
            }}
          >
            {point.criteria_codes.length === 0 ? "+ tag criteria" : "+ criteria"}
          </button>
          {autoTagged ? (
            <span className="italic" style={{ fontSize: 10.5, color: MUTED }}>
              auto-tagged
            </span>
          ) : null}
          {toneAssistEnabled ? (
            <button
              type="button"
              onClick={toggleTone}
              disabled={isRewriting}
              style={{ fontSize: 10.5, color: MUTED, marginLeft: 4 }}
            >
              {isRewriting ? "Rewriting…" : tone === "supportive" ? "Encouraging" : tone === "direct" ? "Direct" : "Tone"}
            </button>
          ) : null}
        </div>

        {panelOpen ? (
          <div
            className="absolute left-0 right-0"
            style={{
              top: "calc(100% - 4px)",
              zIndex: 40,
              maxHeight: 300,
              overflowY: "auto",
              borderRadius: 10,
              border: `1px solid ${MUTED}`,
              background: SHEET,
              boxShadow: "0 18px 44px oklch(23.5% 0.017 65 / 0.3)",
              padding: 8,
            }}
          >
            {sections.map((section) => (
              <div key={section.section} className="mb-1.5 last:mb-0">
                <p
                  className="uppercase"
                  style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: TEAL, padding: "2px 8px 4px" }}
                >
                  {section.title}
                </p>
                {section.codes.map((code) => {
                  const on = point.criteria_codes.includes(code);
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => toggleCriteria(code)}
                      className="grid w-full items-start gap-1.5 text-left transition-colors hover:bg-card-inset"
                      style={{
                        gridTemplateColumns: "14px 26px 1fr",
                        borderRadius: 6,
                        padding: "5px 8px",
                        fontSize: 12,
                        lineHeight: 1.4,
                        color: on ? INK : INK_WARM,
                        background: on ? `color-mix(in oklab, ${TEAL} 12%, transparent)` : undefined,
                      }}
                    >
                      <span style={{ fontSize: 11, color: TEAL }}>{on ? "✓" : ""}</span>
                      <span style={{ fontWeight: 700, color: TEAL }}>{code}</span>
                      <span>{CRITERIA_LABELS[code]}</span>
                    </button>
                  );
                })}
              </div>
            ))}
            <div style={{ borderTop: `1px solid ${FAINT}`, marginTop: 4, paddingTop: 4 }}>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="w-full text-left"
                style={{ fontSize: 12, color: MUTED, padding: "4px 8px" }}
              >
                Done
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-1">
        {starable ? (
          <button
            type="button"
            onClick={() => onChange({ starred: !point.starred })}
            title={`Prioritise this in TP${tpNumber + 1} — starred points carry into the Personal Aims of their next plan`}
            className="flex items-center justify-center rounded-full"
            style={{
              width: 26,
              height: 26,
              border: `1px solid ${point.starred ? GOLD_INK : FAINT}`,
              background: point.starred ? GOLD : "transparent",
              color: point.starred ? INK : MUTED,
              fontSize: 13,
            }}
          >
            ★
          </button>
        ) : null}
        <button
          type="button"
          onClick={onRemove}
          title="Remove"
          className="flex items-center justify-center opacity-50 transition-opacity hover:opacity-100"
          style={{ width: 26, height: 26, color: DESTRUCTIVE, fontSize: 13 }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
