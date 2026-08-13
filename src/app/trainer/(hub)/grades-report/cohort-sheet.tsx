"use client";

import Link from "next/link";
import { useActionState } from "react";
import { releaseAllFinalReports, type FormState } from "@/app/dashboard/trainer/celta5-actions";
import { StandardRatingGlyph } from "@/lib/status-pill";
import type { TpGlyphSlot } from "@/lib/tp-grades";
import type { FinalGrade } from "@/lib/supabase/types";

const initialState: FormState = { error: null };

const GRADE_PILL_CLASS: Record<FinalGrade, string> = {
  "Pass A": "pill-gold",
  "Pass B": "pill-neutral",
  Pass: "pill-success",
  Fail: "pill-danger",
  Withdrawn: "pill-neutral",
  Extension: "pill-info",
};

export interface CohortSheetRow {
  traineeId: string;
  name: string;
  tpGlyphs: TpGlyphSlot[];
  provisionalLabel: string;
  recommendedGrade: FinalGrade | null;
  outstanding: string;
}

const LEGEND: { code: string; label: string }[] = [
  { code: "S+", label: "Above the standard" },
  { code: "S", label: "Meets the standard" },
  { code: "N", label: "Not to standard" },
];

// 1a -- "the grade review meeting view." One dense row per candidate so a
// tutor can see the whole cohort's TP trajectory, provisional and
// recommended grades, and what's still blocking finalisation, in one
// screen -- the per-candidate detail below stays the place to actually
// change any of it.
export function CohortSheet({
  courseId,
  courseName,
  rows,
}: {
  courseId: string;
  courseName: string;
  rows: CohortSheetRow[];
}) {
  const [state, action, pending] = useActionState(releaseAllFinalReports, initialState);

  return (
    <div className="sheet flex flex-col gap-4">
      <div className="flex items-end justify-between gap-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">
            {courseName} · {rows.length} candidate{rows.length === 1 ? "" : "s"}
          </p>
          <h2 className="font-serif text-xl text-ink">Grades report</h2>
        </div>
        <form action={action}>
          <input type="hidden" name="course_id" value={courseId} />
          <button
            type="submit"
            disabled={pending}
            className="flex items-center gap-2 rounded-[6px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            <span className="size-[5px] rounded-full bg-gold" />
            {pending ? "Releasing..." : "Release final reports"}
          </button>
        </form>
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <div className="overflow-x-auto rounded-[6px] border border-border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Candidate</th>
              {Array.from({ length: 8 }, (_, i) => (
                <th key={i} className="w-[34px] px-0.5 py-2.5 text-center text-[10px] font-semibold text-muted">
                  {i + 1}
                </th>
              ))}
              <th className="px-4 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Provisional</th>
              <th className="px-4 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-gold">Recommended</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.traineeId} className="border-b border-border-faint last:border-none hover:bg-accent/40">
                <td className="px-4 py-2.5">
                  <Link href={`#candidate-${row.traineeId}`} className="text-ink hover:text-primary">
                    {row.name}
                  </Link>
                </td>
                {row.tpGlyphs.map((slot) => (
                  <td key={slot.tpNumber} className="px-0.5 py-2.5 text-center">
                    <StandardRatingGlyph rating={slot.grade} title={`TP${slot.tpNumber}`} />
                  </td>
                ))}
                <td className="px-4 py-2.5 text-center text-xs font-medium text-muted">{row.provisionalLabel}</td>
                <td className="px-4 py-2.5 text-center">
                  {row.recommendedGrade ? (
                    <span className={`pill ${GRADE_PILL_CLASS[row.recommendedGrade]}`}>{row.recommendedGrade}</span>
                  ) : (
                    <span className="pill pill-neutral">Not set</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-xs text-muted">{row.outstanding || "--"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">TP rating</span>
        {LEGEND.map((l) => (
          <div key={l.code} className="flex items-center gap-2">
            <StandardRatingGlyph
              rating={l.code === "S+" ? "above_standard" : l.code === "S" ? "to_standard" : "not_to_standard"}
            />
            <span className="text-xs text-muted">{l.label}</span>
          </div>
        ))}
        <span className="text-xs text-muted">
          Grades remain provisional until confirmed by Cambridge English after verification by a Chief Assessor.
        </span>
      </div>
    </div>
  );
}
