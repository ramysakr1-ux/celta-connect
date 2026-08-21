"use client";

import { useState } from "react";
import { getDensityTier, DENSITY_TIER_LABELS } from "@/lib/tp-density";
import { AIM_TYPE_LABELS, aimTypeSpread } from "@/lib/aim-type";
import { TpPointReviewForm, type ReviewFormState } from "@/components/tp-library/tp-point-review-form";
import type { Database } from "@/lib/supabase/types";

type TpPoint = Database["public"]["Tables"]["tp_points"]["Row"];

const TP_NUMBERS = [1, 2, 3, 4, 5, 6] as const;

// TP Points.dc.html 1a -- one TP number selected at a time, its 3-card
// grid below, plus a spread-check banner ("checked before publishing, not
// after") computed from that TP number's published points' aim_type.
export function TpNumberTabs({
  points,
  coursebookId,
  updateAction,
  setStatusAction,
}: {
  points: TpPoint[];
  coursebookId: string;
  updateAction: (prevState: ReviewFormState, formData: FormData) => Promise<ReviewFormState>;
  setStatusAction: (formData: FormData) => Promise<void>;
}) {
  const tpNumbersWithPoints = TP_NUMBERS.filter((n) => points.some((p) => p.tp_number === n));
  const [selected, setSelected] = useState<number>(tpNumbersWithPoints[0] ?? 1);

  if (tpNumbersWithPoints.length === 0) {
    return null;
  }

  const tpPoints = points
    .filter((p) => p.tp_number === selected)
    .sort((a, b) => a.sequence_index - b.sequence_index);
  const published = tpPoints.filter((p) => p.status === "published");
  const publishedCount = published.length;
  const classifiedCount = published.filter((p) => p.aim_type).length;
  const spread = aimTypeSpread(published.map((p) => p.aim_type));
  // Only a meaningful pass/fail once every published point actually has an
  // aim type -- legacy published points from before this migration read as
  // "not yet classified" rather than a false pass or false clash.
  const fullyClassified = publishedCount > 0 && classifiedCount === publishedCount;
  const spreadOk = fullyClassified && spread.distinct === publishedCount;

  const repeatedLabel = (() => {
    const counts = new Map<string, number>();
    for (const p of published) {
      if (!p.aim_type) continue;
      counts.set(p.aim_type, (counts.get(p.aim_type) ?? 0) + 1);
    }
    const repeated = [...counts.entries()].filter(([, c]) => c > 1).map(([t]) => AIM_TYPE_LABELS[t as keyof typeof AIM_TYPE_LABELS]);
    return repeated.join(", ");
  })();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {tpNumbersWithPoints.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setSelected(n)}
            className={`flex min-w-[92px] flex-col items-start gap-0.5 rounded-[6px] border px-3.5 py-2 text-left transition-colors ${
              n === selected ? "border-primary bg-card" : "border-border bg-transparent hover:bg-accent/40"
            }`}
          >
            <span className={`text-xs font-bold ${n === selected ? "text-primary" : "text-ink"}`}>TP{n}</span>
            <span className="text-[10px] text-muted">{DENSITY_TIER_LABELS[getDensityTier(n)].name}</span>
          </button>
        ))}
      </div>

      {publishedCount > 0 ? (
        <div
          className={`flex items-center justify-between gap-4 rounded-[6px] border p-3.5 text-sm ${
            !fullyClassified ? "border-border bg-card" : spreadOk ? "border-border bg-card" : "border-destructive/40 bg-destructive/5"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span
              className={`size-1.5 shrink-0 rounded-full ${
                !fullyClassified ? "bg-muted" : spreadOk ? "bg-ink" : "bg-destructive"
              }`}
            />
            <span className="text-ink">
              {!fullyClassified
                ? `${publishedCount - classifiedCount} published point${publishedCount - classifiedCount === 1 ? "" : "s"} for TP${selected} still need${publishedCount - classifiedCount === 1 ? "s" : ""} an aim type before this can be checked.`
                : spreadOk
                  ? `${spread.distinct} different aim types across the ${publishedCount} published point${publishedCount === 1 ? "" : "s"} for TP${selected}.`
                  : `${repeatedLabel || "One aim type"} repeats among TP${selected}'s published points — two candidates would teach the same kind of lesson this round.`}
            </span>
          </div>
          <span className="shrink-0 text-xs text-muted">Checked before publishing, not after</span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {tpPoints.map((point) => (
          <TpPointReviewForm
            key={point.id}
            point={point}
            coursebookId={coursebookId}
            updateAction={updateAction}
            setStatusAction={setStatusAction}
          />
        ))}
      </div>
    </div>
  );
}
