"use client";

import { useEffect, useState, useTransition } from "react";
import { CELTA_CRITERIA_SECTIONS, CRITERIA_LABELS } from "@/lib/celta-criteria";
import { matchCriteriaCodes } from "@/lib/criteria-glossary";
import { emptyFeedbackPoint, type FeedbackPoint } from "@/lib/tp-plan-content";
import { cleanupFeedbackToneForCourse } from "@/app/dashboard/trainer/tone-cleanup-actions";
import type { FeedbackTone } from "@/lib/supabase/types";

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
}: {
  label: string;
  guide: string;
  points: FeedbackPoint[];
  onChange: (points: FeedbackPoint[]) => void;
  scope: "planning" | "teaching";
  starable: boolean;
  autoTagEnabled: boolean;
  toneAssistEnabled?: boolean;
}) {
  const sections = CELTA_CRITERIA_SECTIONS.filter((s) =>
    (scope === "planning" ? PLANNING_SECTIONS : TEACHING_SECTIONS).includes(s.section)
  );

  return (
    <div className="rounded-[6px] border border-border-faint p-4">
      <h3 className="font-serif text-ink">{label}</h3>
      <p className="text-xs italic text-muted">{guide}</p>
      <div className="mt-3 flex flex-col gap-3">
        {points.map((point, i) => (
          <PointRow
            key={i}
            point={point}
            sections={sections}
            starable={starable}
            autoTagEnabled={autoTagEnabled}
            toneAssistEnabled={toneAssistEnabled}
            onChange={(patch) => onChange(points.map((p, x) => (x === i ? { ...p, ...patch } : p)))}
            onRemove={() => onChange(points.filter((_, x) => x !== i))}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange([...points, emptyFeedbackPoint()])}
        className="mt-3 rounded-[6px] border border-border px-3 py-1.5 text-sm text-ink hover:border-primary"
      >
        + Add point
      </button>
    </div>
  );
}

function PointRow({
  point,
  sections,
  starable,
  autoTagEnabled,
  toneAssistEnabled,
  onChange,
  onRemove,
}: {
  point: FeedbackPoint;
  sections: typeof CELTA_CRITERIA_SECTIONS extends readonly (infer T)[] ? T[] : never;
  starable: boolean;
  autoTagEnabled: boolean;
  toneAssistEnabled: boolean;
  onChange: (patch: Partial<FeedbackPoint>) => void;
  onRemove: () => void;
}) {
  const [panelOpen, setPanelOpen] = useState(false);
  // Feedback Assist (design_handoff_feedback_assist) -- local only, never
  // saved with the point. null means "not yet rewritten", so the pill shows
  // a neutral label rather than falsely claiming the trainer's own freeform
  // text already matches one tone.
  const [tone, setTone] = useState<FeedbackTone | null>(null);
  const [isRewriting, startRewrite] = useTransition();
  const [toneError, setToneError] = useState<string | null>(null);

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

  // project_grading_feedback_trainer_awareness.md §2 -- "as the trainer
  // types a bullet, the matching criterion code silently appends... no
  // popup/click/confirm, behaves like autocorrect". Debounced so it fires
  // on a pause rather than every keystroke; self-limiting (only adds codes
  // not already present), so re-running on every keystroke after that is
  // harmless -- it just finds nothing new to add.
  useEffect(() => {
    if (!autoTagEnabled) return;
    const timeout = setTimeout(() => {
      const matched = matchCriteriaCodes(point.text);
      const newCodes = matched.filter((c) => !point.criteria_codes.includes(c));
      if (newCodes.length > 0) {
        onChange({ criteria_codes: [...point.criteria_codes, ...newCodes] });
      }
    }, 600);
    return () => clearTimeout(timeout);
  }, [point.text, point.criteria_codes, autoTagEnabled, onChange]);

  function toggleCriteria(code: string) {
    const has = point.criteria_codes.includes(code);
    onChange({
      criteria_codes: has ? point.criteria_codes.filter((c) => c !== code) : [...point.criteria_codes, code],
    });
  }

  return (
    <div className="border-b border-dashed border-border-faint pb-3 last:border-none">
      <div className="flex items-start gap-2">
        <textarea
          rows={2}
          value={point.text}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="Write one point -- then tag it"
          className="flex-1 rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
        />
        {toneAssistEnabled ? (
          <button
            type="button"
            title="Rewrite tone"
            disabled={isRewriting}
            onClick={toggleTone}
            className="flex h-7 shrink-0 items-center gap-1.5 rounded-[6px] border border-border px-2.5 text-[11.5px] font-semibold disabled:opacity-60"
            style={
              tone === "supportive"
                ? { background: "color-mix(in srgb, oklch(58% 0.1 145) 12%, white)", color: "oklch(58% 0.1 145)" }
                : tone === "direct"
                  ? { background: "color-mix(in srgb, var(--color-primary) 12%, white)", color: "var(--color-primary)" }
                  : undefined
            }
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 2v20M2 12h20" />
            </svg>
            {isRewriting ? "Rewriting…" : tone === "supportive" ? "Encouraging" : tone === "direct" ? "Direct" : "Tone"}
          </button>
        ) : null}
        {starable ? (
          <button
            type="button"
            onClick={() => onChange({ starred: !point.starred })}
            title="Prioritise this in the next TP"
            className={`shrink-0 rounded-full border px-2 py-1 text-sm ${
              point.starred ? "border-status-warning-text bg-status-warning-text text-ink" : "border-border-faint text-muted"
            }`}
          >
            ★
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setPanelOpen(!panelOpen)}
          className="shrink-0 rounded-full border border-primary px-2 py-1 text-xs font-medium text-primary"
        >
          + criteria
        </button>
        <button type="button" onClick={onRemove} className="shrink-0 text-destructive" title="Remove">
          ✕
        </button>
      </div>
      {toneError ? <p className="mt-1 text-xs text-destructive">{toneError}</p> : null}

      {point.criteria_codes.length > 0 ? (
        <p className="mt-1 flex flex-wrap gap-1">
          {point.criteria_codes.map((code) => (
            <span key={code} className="badge-solid" title={CRITERIA_LABELS[code] ?? ""}>
              {code}
            </span>
          ))}
        </p>
      ) : null}

      {panelOpen ? (
        <div className="mt-2 max-h-56 overflow-y-auto rounded-[6px] border border-border-faint bg-card p-3">
          {sections.map((section) => (
            <div key={section.section} className="mb-2 last:mb-0">
              <p className="text-xs font-medium uppercase tracking-wide text-primary">{section.title}</p>
              {section.codes.map((code) => (
                <label key={code} className="flex items-start gap-2 py-0.5 text-sm">
                  <input
                    type="checkbox"
                    checked={point.criteria_codes.includes(code)}
                    onChange={() => toggleCriteria(code)}
                    className="mt-1"
                  />
                  <span>
                    <b className="text-primary">{code}</b> {CRITERIA_LABELS[code]}
                  </span>
                </label>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
