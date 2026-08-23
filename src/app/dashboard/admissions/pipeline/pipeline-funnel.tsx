"use client";

import { useState } from "react";
import type { FunnelStage, FunnelStageKey, FunnelAlert } from "@/lib/admissions-pipeline";

export interface PipelinePerson {
  id: string;
  name: string;
  meta: string;
}

const ALERT_TONE_CLASS: Record<FunnelAlert["tone"], string> = {
  urgent: "border-l-destructive text-destructive",
  warning: "border-l-status-warning-text text-status-warning-text",
  info: "border-l-primary text-primary",
};

// Admissions Pipeline.dc.html 1a: each stage sized proportional to its own
// count, clickable, the selected one showing who's in it below. Client-side
// only -- every applicant for this course is already loaded server-side,
// so switching stages never needs a round trip.
export function PipelineFunnel({
  stages,
  peopleByStage,
  alerts,
}: {
  stages: FunnelStage[];
  peopleByStage: Record<FunnelStageKey, PipelinePerson[]>;
  alerts: FunnelAlert[];
}) {
  const [selected, setSelected] = useState<FunnelStageKey>("app");
  const current = stages.find((s) => s.key === selected) ?? stages[0];
  const people = peopleByStage[selected] ?? [];
  const maxCount = Math.max(...stages.map((s) => s.count), 1);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-stretch gap-2">
        {stages.map((s) => {
          const on = s.key === selected;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setSelected(s.key)}
              style={{ flex: 1 + s.count / Math.max(maxCount, 1) }}
              className={`flex min-w-0 flex-col gap-1.5 rounded-[6px] border-t-[3px] px-3.5 py-3 text-left transition-colors ${
                on
                  ? "border-t-primary bg-[color-mix(in_oklab,var(--color-primary)_16%,var(--color-card))] border border-primary/30"
                  : "border-t-border-faint border border-border bg-transparent hover:bg-[color-mix(in_oklab,var(--color-primary)_10%,var(--color-card))]"
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className={`font-serif text-2xl leading-none ${on ? "text-primary" : "text-ink"}`}>{s.count}</span>
                {s.dropPct !== null ? <span className="text-xs font-bold text-muted">{s.dropPct}%</span> : null}
              </div>
              <span className={`text-xs font-semibold ${on ? "text-primary" : "text-ink"}`}>{s.label}</span>
              <span className="text-[10.5px] leading-tight text-muted">{s.sub}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.35fr_1fr]">
        <div className="overflow-hidden rounded-[7px] border border-border">
          <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-muted/60 px-4 py-2.5">
            <span className="text-sm font-semibold text-ink">{current?.label}</span>
            <span className="text-xs text-muted">
              {people.length} of {current?.count ?? 0} shown
            </span>
          </div>
          {people.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted">Nobody in this stage.</p>
          ) : (
            <ul>
              {people.map((p) => (
                <li key={p.id} className="border-b border-border-faint px-4 py-2.5 last:border-none">
                  <p className="text-sm font-semibold text-ink">{p.name}</p>
                  <p className="text-xs text-muted">{p.meta}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-col gap-2.5">
          {alerts.length === 0 ? (
            <p className="sheet-interactive p-3 text-xs text-muted">Nothing needs attention right now.</p>
          ) : (
            alerts.map((a, i) => (
              <div key={i} className={`rounded-[6px] border border-border-faint border-l-[3px] bg-card p-3.5 ${ALERT_TONE_CLASS[a.tone]}`}>
                <p className="text-xs font-bold">{a.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-ink">{a.text}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
