"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { TrajectoryBarInline } from "@/components/trajectory-gradient-bar";
import type { RosterRow } from "@/lib/roster";
import { AT_RISK_LABELS } from "@/lib/at-risk";
import { COURSE_STATUS_LABEL, isCourseStatusReadOnly } from "@/lib/course-status";
import { ordinal } from "@/lib/stage2-tutorials";
import { moveStage2Earlier, moveStage3Earlier, type FormState } from "@/app/dashboard/trainer/celta5-actions";
import { Avatar, toneForName } from "@/components/avatar";

const moveEarlierInitialState: FormState = { error: null };

// design_handoff_trainer_roster: one grid for the header row and every
// candidate row, so the columns line up without a <table>. Candidate ·
// six glance columns · At risk · Contact.
export const ROSTER_COLS = "grid gap-x-2 grid-cols-[300px_repeat(6,minmax(0,1fr))_96px_110px]";

const NUM = "text-center text-[14px] font-medium tabular-nums";

function MoveEarlierControl({
  traineeId,
  stage,
}: {
  traineeId: string;
  stage: "stage2" | "stage3";
}) {
  const [open, setOpen] = useState(false);
  const action = stage === "stage2" ? moveStage2Earlier : moveStage3Earlier;
  const [state, formAction, pending] = useActionState(action, moveEarlierInitialState);

  if (!open) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="text-[11px] text-primary hover:underline"
      >
        Move earlier
      </button>
    );
  }

  return (
    <form action={formAction} onClick={(e) => e.stopPropagation()} className="mt-1 flex flex-col gap-1">
      <input type="hidden" name="trainee_id" value={traineeId} />
      <input
        type="text"
        name="reason"
        required
        placeholder="Reason for moving earlier"
        className="h-7 w-40 rounded-[6px] border border-border bg-card px-2 text-[11px] text-ink outline-none focus:border-primary"
      />
      {state.error ? <p className="text-[11px] text-destructive">{state.error}</p> : null}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-[6px] bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground disabled:opacity-60"
        >
          {pending ? "Saving…" : "Confirm"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-[11px] text-muted hover:text-ink">
          Cancel
        </button>
      </div>
    </form>
  );
}

function formatSupervisedTime(totalSeconds: number): string {
  const m = Math.round(totalSeconds / 60);
  return m > 0 ? `${m} min` : "under a minute";
}

// Shortened so a strip cell never wraps (handoff: "Cand. signed").
const CELTA5_SIGNOFF_SHORT: Record<RosterRow["celta5SignoffStatus"], string> = {
  not_started: "Not started",
  candidate_signed: "Cand. signed",
  both_signed: "Both signed",
};
const CELTA5_SIGNOFF_LONG: Record<RosterRow["celta5SignoffStatus"], string> = {
  not_started: "CELTA 5 sign-off not started",
  candidate_signed: "CELTA 5 signed by the candidate, not yet by the tutor",
  both_signed: "CELTA 5 signed by both",
};

/** One cell of the progress strip: tiny uppercase label over a bold value. */
function Cell({
  label,
  warn = false,
  first = false,
  children,
}: {
  label: string;
  warn?: boolean;
  first?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex min-h-10 min-w-0 flex-col items-center justify-center gap-1 px-1.5 ${first ? "" : "border-l border-black/[0.08]"}`}
    >
      <span className="text-[9.5px] font-bold tracking-[0.08em] whitespace-nowrap text-muted uppercase">{label}</span>
      <span className={`text-[12.5px] font-semibold tabular-nums whitespace-nowrap ${warn ? "text-status-warning-text" : "text-ink"}`}>
        {children}
      </span>
    </div>
  );
}

function stop(e: React.MouseEvent) {
  e.stopPropagation();
}

const CELL_LINK = "hover:underline";

// The eleven fields the flat table used to carry as columns, now a strip
// inside the row (handoff, "Progress detail strip"): margin 0 20px 12px
// 68px so its left edge sits under the name, past the avatar. Same row
// element as the glance columns, so the hover ring wraps both.
function DetailStrip({ row, isMct }: { row: RosterRow; isMct: boolean }) {
  const s3 = !row.stage3Required
    ? { short: "n/a", long: "Stage 3 not required for this candidate" }
    : row.stage3Done
      ? { short: "done", long: "Stage 3 done" }
      : row.stage3TutorialConfirmed === null
        ? { short: "pend.", long: "Stage 3 pending" }
        : row.stage3TutorialConfirmed
          ? { short: "conf.", long: "Stage 3 tutorial confirmed" }
          : { short: "invited", long: "Stage 3 tutorial invited" };
  const s2 = row.stage2BookedPosition
    ? { short: ordinal(row.stage2BookedPosition), long: `Stage 2 tutorial booked, ${ordinal(row.stage2BookedPosition)} slot` }
    : { short: "--", long: "Stage 2 tutorial not booked" };
  const moved = [
    row.stage2MovedEarlierReason ? `Stage 2 moved earlier: ${row.stage2MovedEarlierReason}` : null,
    row.stage3MovedEarlierReason ? `Stage 3 moved earlier: ${row.stage3MovedEarlierReason}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const stageWarn = !row.stage2BookedPosition || (row.stage3Required && !row.stage3Done);

  return (
    <div className="mr-5 mb-3 ml-[68px] grid grid-cols-[repeat(11,minmax(0,1fr))] items-start rounded-[8px] bg-black/[0.035] px-1 py-2">
      <Cell label="TP stages" first warn={row.tpStagesBehind > 0}>
        {row.tpStagesTaught > 0 ? (
          <Link
            href={`/portfolio/${row.id}/tp`}
            onClick={stop}
            title="Taught TPs with plan + self-evaluation + feedback all submitted"
            className={CELL_LINK}
          >
            {row.tpStagesTaught - row.tpStagesBehind}/{row.tpStagesTaught}
          </Link>
        ) : (
          <span className="text-muted">--</span>
        )}
      </Cell>
      <Cell label="Supervised" warn={row.supervisedTotal > 0 && row.supervisedDone < row.supervisedTotal}>
        {row.supervisedTotal > 0 ? (
          <Link
            href={`/portfolio/${row.id}/timetable`}
            onClick={stop}
            title={`${formatSupervisedTime(row.supervisedSecondsSpent)} spent -- click to see per-session status on their timetable`}
            className={CELL_LINK}
          >
            {row.supervisedDone}/{row.supervisedTotal}
          </Link>
        ) : (
          <span className="text-muted">--</span>
        )}
      </Cell>
      <Cell label="Obs. hrs" warn={row.observationHoursShort}>
        <Link href={`/portfolio/${row.id}/celta5`} onClick={stop} className={CELL_LINK}>
          {row.observationHoursCounted.toFixed(1)}/6
        </Link>
      </Cell>
      <Cell label="Stage 1" warn={!row.stage1Filed}>
        <Link
          href={`/portfolio/${row.id}/celta5`}
          onClick={stop}
          title={
            row.stage1Filed
              ? "Stage 1 record filed"
              : row.stage1TutorialConfirmed === null
                ? "Stage 1 record not filed"
                : row.stage1TutorialConfirmed
                  ? "Not filed -- tutorial confirmed"
                  : "Not filed -- tutorial invited"
          }
          className={CELL_LINK}
        >
          {row.stage1Filed ? "Filed" : "Not yet"}
        </Link>
      </Cell>
      <Cell label="Stage 2/3" warn={stageWarn}>
        <Link
          href={`/portfolio/${row.id}/celta5`}
          onClick={stop}
          title={[s2.long, s3.long, moved].filter(Boolean).join(" · ")}
          className={CELL_LINK}
        >
          {s2.short} · {s3.short}
          {moved ? (
            <span className="ml-1" aria-label="moved earlier">
              *
            </span>
          ) : null}
        </Link>
        {isMct && (row.stage2CanMoveEarlier || row.stage3CanMoveEarlier) ? (
          <span className="mt-1 flex flex-col items-center gap-1">
            {row.stage2CanMoveEarlier && !row.stage2MovedEarlierReason ? <MoveEarlierControl traineeId={row.id} stage="stage2" /> : null}
            {row.stage3CanMoveEarlier && !row.stage3MovedEarlierReason ? <MoveEarlierControl traineeId={row.id} stage="stage3" /> : null}
          </span>
        ) : null}
      </Cell>
      <Cell label="CELTA 5" warn={row.celta5SignoffStatus !== "both_signed"}>
        <Link href={`/portfolio/${row.id}/celta5`} onClick={stop} title={CELTA5_SIGNOFF_LONG[row.celta5SignoffStatus]} className={CELL_LINK}>
          {CELTA5_SIGNOFF_SHORT[row.celta5SignoffStatus]}
        </Link>
      </Cell>
      <Cell label="FOL" warn={row.folEntriesLow}>
        <span title={row.folEntriesLow ? "Below half the cohort's average -- may be under-logging" : "FOL entries logged this course"}>
          {row.folEntriesLogged}
        </span>
      </Cell>
      <Cell label="Standing">
        <TrajectoryBarInline value={row.trajectory} />
      </Cell>
      <Cell label="Obs. tasks" warn={row.obsTasksTotal > 0 && row.obsTasksDone < row.obsTasksTotal}>
        {row.obsTasksTotal > 0 ? (
          <Link href={`/portfolio/${row.id}/celta5`} onClick={stop} className={CELL_LINK}>
            {row.obsTasksDone}/{row.obsTasksTotal}
          </Link>
        ) : (
          <span className="text-muted">--</span>
        )}
      </Cell>
      <Cell label="Pre-course" warn={row.preCourseTaskTotal > 0 && row.preCourseTaskAnswered < row.preCourseTaskTotal}>
        {row.preCourseTaskTotal > 0 ? (
          <Link href={`/portfolio/${row.id}/pre-course-task`} onClick={stop} className={CELL_LINK}>
            {row.preCourseTaskAnswered}/{row.preCourseTaskTotal}
          </Link>
        ) : (
          <span className="text-muted">--</span>
        )}
      </Cell>
      <Cell label="Filmed obs" warn={row.filmedObsTotal > 0 && row.filmedObsDone < row.filmedObsTotal}>
        {row.filmedObsTotal > 0 ? (
          <Link href={`/portfolio/${row.id}/resources`} onClick={stop} className={CELL_LINK}>
            {row.filmedObsDone}/{row.filmedObsTotal}
          </Link>
        ) : (
          <span className="text-muted">--</span>
        )}
      </Cell>
    </div>
  );
}

// build-spec.md §18 -- "Visibility follows the chat rule: tutors registered
// on that course, nobody else. No admin exception." A real trainer viewer
// only, never role==='admin' even when scoped to the same course.
function ContactCell({ row, courseCode, show }: { row: RosterRow; courseCode: string; show: boolean }) {
  if (!show) return <div />;
  return (
    <div className="flex justify-end gap-2.5 text-[12.5px] font-medium" onClick={stop}>
      <a href={`mailto:${row.email}?subject=${encodeURIComponent(courseCode)}`} className="text-primary hover:underline">
        Email
      </a>
      {row.phone ? (
        <a href={`tel:${row.phone}`} className="text-primary hover:underline">
          Call
        </a>
      ) : null}
    </div>
  );
}

// build-spec.md §8 bug 3 -- rows carried cursor-pointer but only the name
// cell actually navigated. Whole row pushes to the portfolio; the name
// keeps its own <Link> too, for keyboard nav and hover colour.
export function RosterRowView({
  row,
  isMct,
  showContact,
  courseCode,
  showDetail,
  frozenSub,
}: {
  row: RosterRow;
  isMct: boolean;
  showContact: boolean;
  courseCode: string;
  showDetail: boolean;
  /** "Left week N · record kept" for a withdrawn/deferred candidate, when the date is known. */
  frozenSub?: string;
}) {
  const router = useRouter();

  // §3 -- a withdrawn/deferred/etc. candidate is "present in the roster"
  // but their working columns stop meaning anything once frozen, so this
  // row collapses to name + status rather than showing stale numbers next
  // to the others' live ones.
  const frozen = isCourseStatusReadOnly(row.courseStatus);
  const sub = frozen
    ? (frozenSub ?? "Record kept")
    : `${row.stage1Filed ? "Stage 1 filed" : "Stage 1 not filed"} · ${row.folEntriesLogged} FOL ${row.folEntriesLogged === 1 ? "entry" : "entries"}`;

  return (
    <div
      className={`roster-row cursor-pointer border-b border-[oklch(90%_0.012_82)] last:border-b-0 ${frozen ? "opacity-60" : ""}`}
      // The colour that follows the person (avatar.tsx) runs across their
      // whole row, faintly -- Ramy, 5 Sep 2026: "avatar will run through
      // the whole line", neighbouring rows naturally different shades.
      style={{ background: `color-mix(in oklab, ${toneForName(row.name)} 9%, var(--color-card))` }}
      onClick={() => router.push(`/portfolio/${row.id}`)}
    >
      <div className={`${ROSTER_COLS} min-h-[58px] items-center px-5 py-2.5`}>
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={row.name} size="sm" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <Link
                href={`/portfolio/${row.id}`}
                onClick={stop}
                className="text-[14px] font-semibold whitespace-nowrap text-ink hover:text-[var(--hub-accent-deep)]"
              >
                {row.name}
              </Link>
              {row.courseStatus === "extension" ? (
                <span
                  className="rounded-full px-2 py-px text-[10.5px] font-bold whitespace-nowrap"
                  style={{ background: "oklch(93.5% 0.033 235)", color: "oklch(42% 0.09 250)" }}
                >
                  Extension
                </span>
              ) : null}
            </div>
            <p className="truncate text-[12px] text-muted">{sub}</p>
          </div>
        </div>

        {frozen ? (
          <div className="col-span-7 text-center">
            <span
              className="rounded-full px-2.5 py-[3px] text-[11px] font-semibold"
              style={{ background: "oklch(93.5% 0.008 85)", color: "oklch(44% 0.014 70)" }}
            >
              {COURSE_STATUS_LABEL[row.courseStatus]}
            </span>
          </div>
        ) : (
          <>
            {/* Warn threshold is the roster's own (< 6 of the 6 assessed
                hours), not the handoff's illustrative "< 4". */}
            <div className={`${NUM} ${row.assessedHrs < 6 ? "text-status-warning-text" : "text-ink"}`}>{row.assessedHrs.toFixed(2)}</div>
            <div className={`${NUM} text-ink`}>
              {row.tpsPassed}
              <span className="font-normal text-muted">/8</span>
            </div>
            <div className={`${NUM} text-ink`}>
              {row.assignmentsTotal > 0 ? (
                <Link
                  href={`/portfolio/${row.id}/assignments`}
                  onClick={stop}
                  title={row.assignmentsResubmitted ? "Includes a resubmission" : "No resubmissions used"}
                  className="hover:underline"
                >
                  {row.assignmentsPassed}/{row.assignmentsTotal}
                  {row.assignmentsResubmitted ? <sup className="ml-0.5 text-[9px] text-status-warning-text">R</sup> : null}
                </Link>
              ) : (
                <span className="text-muted">--</span>
              )}
            </div>
            <div className={`${NUM} text-ink`}>{row.criteriaPct}%</div>
            <div className={`${NUM} ${row.attendancePct < 80 ? "font-bold text-destructive" : "text-ink"}`}>{row.attendancePct}%</div>
            <div className={`text-center text-[13px] ${row.provisionalSlashed ? "font-bold text-destructive" : "font-medium text-ink"}`}>
              {row.provisionalLabel ?? <span className="font-normal text-muted">Not set</span>}
            </div>
            <div className="text-center">
              {row.atRiskReasons.length > 0 ? (
                <span
                  title={row.atRiskReasons.map((r) => AT_RISK_LABELS[r]).join(" · ")}
                  onClick={stop}
                  className="inline-flex items-center gap-1.5 rounded-full px-[9px] py-[3px] text-[11px] font-semibold whitespace-nowrap"
                  style={{ background: "oklch(94% 0.043 25)", color: "oklch(45% 0.15 27)" }}
                >
                  <span className="block size-1.5 rounded-full bg-current" />
                  At risk
                </span>
              ) : null}
            </div>
          </>
        )}
        <ContactCell row={row} courseCode={courseCode} show={showContact} />
      </div>
      {showDetail && !frozen ? <DetailStrip row={row} isMct={isMct} /> : null}
    </div>
  );
}
