"use client";

import { useState } from "react";
import { CRITERIA_LABELS, CELTA_CRITERIA_CODES, type GradesReportList } from "@/lib/celta-criteria";
import { setGradesReportListOverride } from "@/app/dashboard/trainer/celta5-actions";

// The Grades Report's building blocks, following Ramy's own design file
// (design-sources/Grades Report (standalone).html) rather than a design of
// mine. He had to say so twice: "why don't you use the HTML that I sent you?"
// Panels, spacing, the bordered chip box, the 28px grade pills and the inset
// proposed-by row are all his values.

export interface Line {
  code: string;
  label: string;
}

/** Copies one Appian field. Same text as the screen -- Ramy: "why are we
 *  changing it for Appian?" We aren't. */
export function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  if (!value.trim()) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
      className="trainer-hover-fill shrink-0 rounded-full border border-border px-2 py-[1px] text-[10px] font-bold tracking-[0.04em] text-muted uppercase"
      aria-label={`Copy ${label}`}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

const LIST_IS_PLANNING: Record<GradesReportList, boolean> = {
  planningStrengths: true,
  planningActionPoints: true,
  teachingStrengths: false,
  teachingActionPoints: false,
};

/**
 * One of the four criteria lists.
 *
 * Add is a picker, never free text: the override stores codes, so the wording
 * always comes back out of CRITERIA_LABELS and no variant phrasing can get
 * in. Each option shows the criterion's current rating, because the case this
 * exists for is Ramy's -- "or the weak S's" -- and a tutor hunting a
 * borderline S should not have to scan 41 unlabelled criteria to find it.
 */
export function CriteriaList({
  traineeId,
  list,
  label,
  labelClass,
  source,
  items,
  ratings,
  editable,
}: {
  traineeId: string;
  list: GradesReportList;
  label: string;
  labelClass: string;
  source: string;
  items: Line[];
  ratings: Record<string, string | null | undefined>;
  editable: boolean;
}) {
  const [picking, setPicking] = useState(false);
  const shown = new Set(items.map((i) => i.code));
  const planning = LIST_IS_PLANNING[list];
  const options = CELTA_CRITERIA_CODES.filter(
    (code) => code.startsWith("4") === planning && !shown.has(code)
  );

  return (
    <div className="flex flex-col gap-[7px]">
      <div className="flex items-baseline justify-between gap-2.5">
        <span className={`text-[12px] font-semibold ${labelClass}`}>{label}</span>
        <span className="flex items-center gap-2">
          <span className="text-[10px] text-muted">{source}</span>
          <CopyField value={items.map((i) => i.label).join("\n")} label={label} />
        </span>
      </div>

      <div className="flex min-h-[34px] flex-col gap-[5px] rounded-[6px] border border-border bg-card-inset px-2.5 py-[9px]">
        {items.length === 0 ? <span className="px-0.5 py-[3px] text-[11px] text-muted">None</span> : null}
        {items.map((item) => (
          <div
            key={item.code}
            className="flex items-start gap-2 rounded-[6px] border border-border bg-card px-2.5 py-1 text-[11.5px] leading-[1.5] text-ink"
          >
            <span className="flex-1">{item.label}</span>
            {editable ? (
              <form action={setGradesReportListOverride}>
                <input type="hidden" name="trainee_id" value={traineeId} />
                <input type="hidden" name="list" value={list} />
                <input type="hidden" name="code" value={item.code} />
                <input type="hidden" name="op" value="remove" />
                <button type="submit" className="shrink-0 text-[10px] text-muted opacity-50 hover:opacity-100" aria-label="Remove">
                  ✕
                </button>
              </form>
            ) : null}
          </div>
        ))}

        {editable ? (
          <div className="mt-0.5">
            <button
              type="button"
              onClick={() => setPicking((v) => !v)}
              className="text-[11px] font-medium text-primary hover:underline"
            >
              {picking ? "Cancel" : "+ add a criterion"}
            </button>
            {picking ? (
              <div className="mt-1.5 flex max-h-56 flex-col gap-0.5 overflow-y-auto rounded-[6px] border border-border bg-card p-1">
                {options.map((code) => (
                  <form key={code} action={setGradesReportListOverride}>
                    <input type="hidden" name="trainee_id" value={traineeId} />
                    <input type="hidden" name="list" value={list} />
                    <input type="hidden" name="code" value={code} />
                    <input type="hidden" name="op" value="add" />
                    <button
                      type="submit"
                      className="trainer-hover flex w-full items-start gap-2 rounded-[5px] px-2 py-1 text-left text-[11px] leading-[1.45] text-ink"
                    >
                      <span className="w-7 shrink-0 font-bold tabular-nums text-muted">{code}</span>
                      <span className="w-8 shrink-0 font-semibold text-muted">{ratings[code] ?? "—"}</span>
                      <span className="flex-1">{CRITERIA_LABELS[code] ?? code}</span>
                    </button>
                  </form>
                ))}
                {options.length === 0 ? (
                  <p className="px-2 py-1 text-[11px] text-muted">Every criterion for this half is already listed.</p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
