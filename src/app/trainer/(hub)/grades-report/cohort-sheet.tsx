"use client";

import { HUB_BUTTON } from "@/app/trainer/(hub)/page-head";

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
  /** The provisional grade as stored, for the settled count while no final
   *  grade exists yet; null when nobody has proposed one. */
  provisionalGrade: FinalGrade | null;
  recommendedGrade: FinalGrade | null;
  outstanding: string;
  wasSlashed: boolean;
  justified: boolean;
  stage3Status: Stage3Status;
  tpsRemaining: number;
  provisionalApproved: boolean;
  hasProvisional: boolean;
  withdrawn: boolean;
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
  provisionalDueDerived,
  provisionalDaysOut = null,
  appianUrl,
  isMct,
}: {
  courseId: string;
  courseName: string;
  rows: CohortSheetRow[];
  canRelease: boolean;
  provisionalDueAt: string | null;
  provisionalDueDerived?: boolean;
  /** Days until the provisional deadline in the centre's day; negative when past. */
  provisionalDaysOut?: number | null;
  /** The centre's Appian sign-in page. Null until someone sets it. */
  appianUrl?: string | null;
  isMct: boolean;
}) {
  const [state, action, pending] = useActionState(releaseAllFinalReports, initialState);
  // "Confirmed" counts grades among the candidates who need one -- the active
  // cohort -- not among everyone with something recorded. A withdrawal is a
  // settled outcome, not a grade the MCT proposes and confirms, so it belongs
  // in neither the numerator nor the denominator; counting it made the sheet
  // read "11 of 11 confirmed" while the assessor-pack header, which already
  // scopes to active candidates, read "10 of 11". Same definition now, so the
  // one still-unconfirmed candidate (ungraded) shows in both.
  const gradeCandidates = rows.filter((r) => !r.withdrawn);
  const approvedCount = gradeCandidates.filter((r) => r.provisionalApproved).length;

  const undecidedRows = rows.filter((r) => r.wasSlashed && !r.justified);
  const settledRows = rows.filter((r) => !(r.wasSlashed && !r.justified));
  // Which grade the box counts. The final recommended grade once anyone has
  // one (the end of the course); until then the provisional, so the box
  // agrees with the banner beside it instead of reading "Settled 10 / Not
  // yet graded 10" on day 15 (Ramy, 20 Sep 2026: "go with 1").
  const countingFinal = rows.some((r) => r.recommendedGrade);
  const settledGrade = (r: CohortSheetRow): FinalGrade | null =>
    countingFinal ? r.recommendedGrade : r.withdrawn ? "Withdrawn" : r.provisionalGrade;
  const settledCounts = SETTLED_BANDS.map((band) => ({
    band,
    count: settledRows.filter((r) => settledGrade(r) === band).length,
  }));
  const notYetGradedCount = settledRows.filter((r) => !settledGrade(r)).length;
  // settledRows is "everyone not undecided", which is not the same as everyone
  // settled: it carries the ungraded too, so the box read "Settled · 10
  // provisional grades" above a list whose own last line said "Not yet graded
  // 1" (walked 23 Sep 2026). Count the grades, so the heading is the sum of
  // the bands beneath it and the ungraded read as what is still outstanding.
  // Withdrawn stays in: it is a settled outcome, and Cambridge wants it filed.
  const settledGradedCount = settledRows.length - notYetGradedCount;

  return (
    <div className="sheet flex flex-col gap-4">
      <div className="flex items-end justify-between gap-5">
        <div>
          <p className="text-label font-bold tracking-[0.12em] text-muted uppercase">Cohort</p>
          <h2 className="font-serif text-h2 font-semibold text-ink-warm">
            {rows.length} candidate{rows.length === 1 ? "" : "s"}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Ramy: "leave it there exactly." Sits with the other two page
              actions rather than inventing a new place for it. Links to the
              sign-in page only -- no deep link, no data ever leaves Connect
              for Appian, same rule as the pack and Course Admin. */}
          {appianUrl ? (
            <a
              href={appianUrl}
              target="_blank"
              rel="noreferrer"
              className={HUB_BUTTON}
            >
              Open Appian
            </a>
          ) : null}
          <a
            href="/trainer/grades-report/export"
            className={HUB_BUTTON}
          >
            Export report
          </a>
          {canRelease ? (
            <form action={action}>
              <input type="hidden" name="course_id" value={courseId} />
              <button
                type="submit"
                disabled={pending}
                className="flex items-center gap-2 rounded-[6px] bg-primary px-4 py-2 text-body font-semibold text-primary-foreground disabled:opacity-60"
              >
                <span className="size-[5px] rounded-full bg-muted" />
                {pending ? "Releasing..." : "Release final reports"}
              </button>
            </form>
          ) : null}
        </div>
      </div>
      {canRelease && state.error ? <p className="text-body text-destructive">{state.error}</p> : null}

      <ProvisionalDeadlineBanner
        dueAt={provisionalDueAt}
        derived={provisionalDueDerived}
        daysOut={provisionalDaysOut}
        isMct={isMct}
        approvedCount={approvedCount}
        totalCount={gradeCandidates.length}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
        {/* Undecided -- needs justification */}
        <div className="rounded-[6px] border border-border">
          <p className="border-b border-border bg-status-warning-bg px-4 py-2 text-micro font-semibold uppercase tracking-[0.12em] text-status-warning-text">
            Undecided — needs justification · {undecidedRows.length}
          </p>
          {undecidedRows.length === 0 ? (
            <p className="px-4 py-3 text-body text-muted">No candidate is currently in doubt between two grades.</p>
          ) : (
            <div className="divide-y divide-border-faint">
              {undecidedRows.map((row) => (
                <Link
                  key={row.traineeId}
                  href={`#candidate-${row.traineeId}`}
                  className="lift flex flex-col gap-1.5 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-body text-ink">{row.name}</span>
                    <span className="text-body font-bold text-destructive">{row.provisionalLabel}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`pill ${STAGE3_PILL[row.stage3Status].cls}`}>{STAGE3_PILL[row.stage3Status].label}</span>
                    <span className="text-label text-muted">
                      {row.tpsRemaining} TP{row.tpsRemaining === 1 ? "" : "s"} left to teach
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
          {undecidedRows.length > 0 ? (
            <p className="border-t border-border-faint px-4 py-2.5 text-label leading-relaxed text-muted">
              {/* Cambridge's own strength, not a firmer one. Handbook 10.2:
                  "Potential Fail candidates SHOULD also be issued with a Fail
                  letter... This should be issued sufficiently in advance of the
                  end of the course, IDEALLY with at least two lessons left to
                  teach." This line said "must be issued with at least two
                  assessed lessons still to teach", which turns a recommendation
                  into a requirement and says "assessed lessons" where the
                  Handbook says "lessons" -- so on a course past that point it
                  read as a breached obligation rather than late guidance.
                  src/lib/letters/fail-risk.ts had the quote right all along
                  (walk, 23 Sep 2026). */}
              Admin Handbook 10.2: a potential Fail candidate should be issued with a fail-risk letter, ideally
              with at least two lessons left to teach -- issued from each candidate&apos;s own CELTA 5 page, not
              from here.
            </p>
          ) : null}
        </div>

        {/* Settled */}
        <div className="rounded-[6px] border border-border">
          <p className="border-b border-border px-4 py-2 text-micro font-semibold uppercase tracking-[0.12em] text-muted">
            Settled · {settledGradedCount}
            <span className="ml-2 normal-case tracking-normal text-muted">{countingFinal ? "final grades" : "provisional grades"}</span>
          </p>
          <div className="divide-y divide-border-faint">
            {settledCounts.map(({ band, count }) => (
              <div key={band} className="flex items-center justify-between px-4 py-2.5">
                <span className={`pill ${GRADE_PILL_CLASS[band]}`}>{band}</span>
                <span className="text-body tabular-nums text-ink">{count}</span>
              </div>
            ))}
            {notYetGradedCount > 0 ? (
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="pill pill-neutral">Not yet graded</span>
                <span className="text-body tabular-nums text-ink">{notYetGradedCount}</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-[6px] border border-border">
        <table className="w-full border-collapse text-body">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-2.5 text-left text-micro font-semibold uppercase tracking-[0.12em] text-muted">Candidate</th>
              {Array.from({ length: 8 }, (_, i) => (
                <th key={i} className="w-[34px] px-0.5 py-2.5 text-center text-micro font-semibold text-muted">
                  {i + 1}
                </th>
              ))}
              <th className="px-4 py-2.5 text-center text-micro font-semibold uppercase tracking-[0.12em] text-muted">Provisional</th>
              <th className="px-4 py-2.5 text-center text-micro font-semibold uppercase tracking-[0.12em] text-status-warning-text">Recommended</th>
              <th className="px-4 py-2.5 text-left text-micro font-semibold uppercase tracking-[0.12em] text-muted">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.traineeId} className="hover-ring border-b border-border-faint last:border-none">
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
                <td className="px-4 py-2.5 text-center text-label font-medium text-muted">{row.provisionalLabel}</td>
                <td className="px-4 py-2.5 text-center">
                  {row.recommendedGrade ? (
                    <span className={`pill ${GRADE_PILL_CLASS[row.recommendedGrade]}`}>{row.recommendedGrade}</span>
                  ) : (
                    <span className="pill pill-neutral">Not set</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-label text-muted">{row.outstanding || "--"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-5">
        <span className="text-micro font-semibold uppercase tracking-[0.12em] text-muted">TP rating</span>
        {LEGEND.map((l) => (
          <div key={l.code} className="flex items-center gap-2">
            <StandardRatingGlyph
              rating={l.code === "S+" ? "above_standard" : l.code === "S" ? "to_standard" : "not_to_standard"}
            />
            <span className="text-label text-muted">{l.label}</span>
          </div>
        ))}
        <span className="text-label text-muted">
          Grades remain provisional until confirmed by Cambridge English after verification by a Chief Assessor.
        </span>
      </div>
    </div>
  );
}
