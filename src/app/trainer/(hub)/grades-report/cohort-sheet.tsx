"use client";

import Link from "next/link";
import { useActionState } from "react";
import { releaseAllFinalReports, type FormState } from "@/app/dashboard/trainer/celta5-actions";
import { ProvisionalDeadlineBanner } from "@/app/trainer/(hub)/grades-report/provisional-deadline-banner";
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
  Deferred: "pill-neutral",
};

export type Stage3Status = "not_required" | "not_given" | "given";

export interface CohortSheetRow {
  traineeId: string;
  name: string;
  tpGlyphs: TpGlyphSlot[];
  provisionalLabel: string;
  recommendedGrade: FinalGrade | null;
  outstanding: string;
  wasSlashed: boolean;
  justified: boolean;
  stage3Status: Stage3Status;
  tpsRemaining: number;
  provisionalApproved: boolean;
  hasProvisional: boolean;
}

const STAGE3_PILL: Record<Stage3Status, { label: string; cls: string }> = {
  not_required: { label: "Stage 3 not required", cls: "pill-neutral" },
  not_given: { label: "Stage 3 tutorial not yet given", cls: "pill-danger" },
  given: { label: "Stage 3 tutorial given", cls: "pill-success" },
};

const SETTLED_BANDS: FinalGrade[] = ["Pass A", "Pass B", "Pass", "Fail", "Withdrawn"];

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
  canRelease,
  provisionalDueAt,
  isMct,
}: {
  courseId: string;
  courseName: string;
  rows: CohortSheetRow[];
  canRelease: boolean;
  provisionalDueAt: string | null;
  isMct: boolean;
}) {
  const [state, action, pending] = useActionState(releaseAllFinalReports, initialState);
  const withProvisional = rows.filter((r) => r.hasProvisional);
  const approvedCount = withProvisional.filter((r) => r.provisionalApproved).length;

  const undecidedRows = rows.filter((r) => r.wasSlashed && !r.justified);
  const settledRows = rows.filter((r) => !(r.wasSlashed && !r.justified));
  const settledCounts = SETTLED_BANDS.map((band) => ({
    band,
    count: settledRows.filter((r) => r.recommendedGrade === band).length,
  }));
  const notYetGradedCount = settledRows.filter((r) => !r.recommendedGrade).length;

  return (
    <div className="sheet flex flex-col gap-4">
      <div className="flex items-end justify-between gap-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">
            {courseName} · {rows.length} candidate{rows.length === 1 ? "" : "s"}
          </p>
          <h2 className="font-serif text-xl text-ink">Grades report</h2>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/trainer/grades-report/export"
            className="rounded-[6px] border border-border px-3.5 py-2 text-sm font-medium text-ink trainer-hover-fill"
          >
            Export report
          </a>
          {canRelease ? (
            <form action={action}>
              <input type="hidden" name="course_id" value={courseId} />
              <button
                type="submit"
                disabled={pending}
                className="flex items-center gap-2 rounded-[6px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                <span className="size-[5px] rounded-full bg-muted" />
                {pending ? "Releasing..." : "Release final reports"}
              </button>
            </form>
          ) : null}
        </div>
      </div>
      {canRelease && state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <ProvisionalDeadlineBanner
        dueAt={provisionalDueAt}
        isMct={isMct}
        approvedCount={approvedCount}
        totalCount={withProvisional.length}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
        {/* Undecided -- needs justification */}
        <div className="rounded-[6px] border border-border">
          <p className="border-b border-border bg-status-warning-bg px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-status-warning-text">
            Undecided — needs justification · {undecidedRows.length}
          </p>
          {undecidedRows.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted">No candidate is currently in doubt between two grades.</p>
          ) : (
            <div className="divide-y divide-border-faint">
              {undecidedRows.map((row) => (
                <Link
                  key={row.traineeId}
                  href={`#candidate-${row.traineeId}`}
                  className="flex flex-col gap-1.5 px-4 py-3 hover:bg-accent/40"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-ink">{row.name}</span>
                    <span className="text-sm font-bold text-destructive">{row.provisionalLabel}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`pill ${STAGE3_PILL[row.stage3Status].cls}`}>{STAGE3_PILL[row.stage3Status].label}</span>
                    <span className="text-xs text-muted">
                      {row.tpsRemaining} TP{row.tpsRemaining === 1 ? "" : "s"} left to teach
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
          {undecidedRows.length > 0 ? (
            <p className="border-t border-border-faint px-4 py-2.5 text-[11px] leading-relaxed text-muted">
              Admin Handbook 9.2: a fail-risk letter must be issued with at least two assessed lessons still to
              teach -- issued from each candidate&apos;s own CELTA 5 page, not from here.
            </p>
          ) : null}
        </div>

        {/* Settled */}
        <div className="rounded-[6px] border border-border">
          <p className="border-b border-border px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
            Settled · {settledRows.length}
          </p>
          <div className="divide-y divide-border-faint">
            {settledCounts.map(({ band, count }) => (
              <div key={band} className="flex items-center justify-between px-4 py-2.5">
                <span className={`pill ${GRADE_PILL_CLASS[band]}`}>{band}</span>
                <span className="text-sm tabular-nums text-ink">{count}</span>
              </div>
            ))}
            {notYetGradedCount > 0 ? (
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="pill pill-neutral">Not yet graded</span>
                <span className="text-sm tabular-nums text-ink">{notYetGradedCount}</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

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
              <th className="px-4 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-status-warning-text">Recommended</th>
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
