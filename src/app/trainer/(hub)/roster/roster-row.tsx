"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { TrajectoryBarCompact } from "@/components/trajectory-gradient-bar";
import type { RosterRow } from "@/lib/roster";
import { CORE_COLUMN_COUNT, DETAIL_COLUMN_COUNT } from "@/app/trainer/(hub)/roster/roster-table";
import { AT_RISK_LABELS } from "@/lib/at-risk";
import { COURSE_STATUS_LABEL, isCourseStatusReadOnly } from "@/lib/course-status";
import { ordinal } from "@/lib/stage2-tutorials";
import { moveStage2Earlier, moveStage3Earlier, type FormState } from "@/app/dashboard/trainer/celta5-actions";
import { Avatar, toneForName } from "@/components/avatar";

const moveEarlierInitialState: FormState = { error: null };

// Grade Pipeline handoff: "a 'Move earlier' link appears next to a
// not-yet-given Stage 2/3 badge; confirming with a reason shows 'Moved
// earlier -- [reason]' under the badge." Inline in the cell rather than an
// absolute-positioned popover -- this table already scrolls horizontally
// inside its own container, and a popover would clip against that.
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
    <form
      action={formAction}
      onClick={(e) => e.stopPropagation()}
      className="mt-1 flex flex-col gap-1"
    >
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

const CELTA5_SIGNOFF_LABEL: Record<RosterRow["celta5SignoffStatus"], string> = {
  not_started: "Not started",
  candidate_signed: "Candidate signed",
  both_signed: "Both signed",
};

// build-spec.md §18 -- "Visibility follows the chat rule: tutors registered
// on that course, nobody else. No admin exception." A real trainer viewer
// only, never role==='admin' even when scoped to the same course.
function ContactCell({ row, courseCode }: { row: RosterRow; courseCode: string }) {
  return (
    <td className="text-center text-xs" onClick={(e) => e.stopPropagation()}>
      <div className="flex justify-end gap-2">
        <a href={`mailto:${row.email}?subject=${encodeURIComponent(courseCode)}`} className="text-primary hover:underline">
          Email
        </a>
        {row.phone ? (
          <a href={`tel:${row.phone}`} className="text-primary hover:underline">
            Call
          </a>
        ) : null}
      </div>
    </td>
  );
}

// build-spec.md §8 bug 3 -- rows carried cursor-pointer but only the name
// cell actually navigated. Whole row now pushes to the portfolio; the
// name keeps its own <Link> too, for keyboard nav and hover color.
export function RosterRowView({
  row,
  isMct,
  showContact,
  courseCode,
  showDetail,
}: {
  row: RosterRow;
  isMct: boolean;
  showContact: boolean;
  courseCode: string;
  showDetail: boolean;
}) {
  const router = useRouter();

  // §3 -- a withdrawn/deferred/etc. candidate is "present in the roster"
  // but their working columns (hrs, TPs, etc.) stop meaning anything once
  // frozen, so this row collapses to name + status rather than showing
  // stale numbers next to the others' live ones.
  if (isCourseStatusReadOnly(row.courseStatus)) {
    return (
      <tr className="trainer-hover cursor-pointer opacity-70"
      // The colour that follows the person (avatar.tsx) runs across their
      // whole row, faintly -- Ramy, 5 Sep 2026: "avatar will run through
      // the whole line", neighbouring rows naturally different shades.
      style={{ background: `color-mix(in oklab, ${toneForName(row.name)} 9%, var(--color-card))` }}
      onClick={() => router.push(`/portfolio/${row.id}`)}>
        <td>
          <Link href={`/portfolio/${row.id}`} className="flex items-center gap-2.5 text-ink hover:text-[var(--hub-accent-deep)]">
            <Avatar name={row.name} size="sm" />
            {row.name}
          </Link>
        </td>
        {showContact ? <ContactCell row={row} courseCode={courseCode} /> : <td />}
        {/* Derived, not hardcoded: this was 16 against a table of 9 core
            + 10 detail columns, so the status pill already under-spanned by
            one before "Filmed obs" was added. The name and contact cells
            are rendered separately above, hence the -1 for the name; the
            contact cell is inside CORE's own count of what follows it. */}
        <td colSpan={CORE_COLUMN_COUNT + 1 + (showDetail ? DETAIL_COLUMN_COUNT : 0)} className="text-center">
          <span className="pill pill-neutral">{COURSE_STATUS_LABEL[row.courseStatus]}</span>
        </td>
      </tr>
    );
  }

  return (
    <tr className="trainer-hover cursor-pointer"
      // The colour that follows the person (avatar.tsx) runs across their
      // whole row, faintly -- Ramy, 5 Sep 2026: "avatar will run through
      // the whole line", neighbouring rows naturally different shades.
      style={{ background: `color-mix(in oklab, ${toneForName(row.name)} 9%, var(--color-card))` }}
      onClick={() => router.push(`/portfolio/${row.id}`)}>
      <td>
        {/* The mark sits inside the link so the whole name cell stays one
            target -- Ramy, 4 Sep 2026. */}
        <Link href={`/portfolio/${row.id}`} className="flex items-center gap-2.5 text-ink hover:text-[var(--hub-accent-deep)]">
          <Avatar name={row.name} size="sm" />
          {row.name}
          {row.courseStatus === "extension" ? <span className="pill pill-info">Extension</span> : null}
        </Link>
      </td>
      {showContact ? <ContactCell row={row} courseCode={courseCode} /> : <td />}
      <td className={`text-center tabular-nums ${row.assessedHrs < 6 ? "text-status-warning-text" : "text-ink"}`}>
        {row.assessedHrs.toFixed(2)}
      </td>
      <td className="text-center tabular-nums text-ink">{row.tpsPassed}/8</td>
      <td className="text-center tabular-nums text-ink">
        {row.assignmentsTotal > 0 ? (
          <Link
            href={`/portfolio/${row.id}/assignments`}
            onClick={(e) => e.stopPropagation()}
            title={row.assignmentsResubmitted ? "Includes a resubmission" : "No resubmissions used"}
            className="hover:underline"
          >
            {row.assignmentsPassed}/{row.assignmentsTotal}
            {row.assignmentsResubmitted ? <sup className="ml-0.5 text-status-warning-text">R</sup> : null}
          </Link>
        ) : (
          <span className="text-muted">--</span>
        )}
      </td>
      <td className="text-center tabular-nums text-ink">{row.criteriaPct}%</td>
      <td className={`text-center tabular-nums ${row.attendancePct < 80 ? "font-semibold text-destructive" : "text-ink"}`}>
        {row.attendancePct}%
      </td>
      <td className={`text-center ${row.provisionalSlashed ? "font-bold text-destructive" : "text-ink"}`}>
        {row.provisionalLabel ?? <span className="text-muted">Not set</span>}
      </td>
      <td className="text-center">
        {row.atRiskReasons.length > 0 ? (
          <span title={row.atRiskReasons.map((r) => AT_RISK_LABELS[r]).join(" · ")} className="pill pill-danger">
            At risk
          </span>
        ) : null}
      </td>
      {showDetail ? (
        <>
          <td className="text-center tabular-nums">
            {row.tpStagesTaught > 0 ? (
              <Link
                href={`/portfolio/${row.id}/tp`}
                onClick={(e) => e.stopPropagation()}
                title="Taught TPs with plan + self-evaluation + feedback all submitted"
                className={`hover:underline ${row.tpStagesBehind > 0 ? "text-status-warning-text" : "text-ink"}`}
              >
                {row.tpStagesTaught - row.tpStagesBehind}/{row.tpStagesTaught}
              </Link>
            ) : (
              <span className="text-muted">--</span>
            )}
          </td>
          <td className="text-center tabular-nums">
            {row.supervisedTotal > 0 ? (
              <Link
                href={`/portfolio/${row.id}/timetable`}
                onClick={(e) => e.stopPropagation()}
                title={`${formatSupervisedTime(row.supervisedSecondsSpent)} spent -- click to see per-session status on their timetable`}
                className={`hover:underline ${row.supervisedDone < row.supervisedTotal ? "text-status-warning-text" : "text-ink"}`}
              >
                {row.supervisedDone}/{row.supervisedTotal}
              </Link>
            ) : (
              <span className="text-muted">--</span>
            )}
          </td>
          <td className="text-center tabular-nums">
            <Link
              href={`/portfolio/${row.id}/celta5`}
              onClick={(e) => e.stopPropagation()}
              className={`hover:underline ${row.observationHoursShort ? "text-status-warning-text" : "text-ink"}`}
            >
              {row.observationHoursCounted.toFixed(1)}/6
            </Link>
          </td>
          <td className="text-center">
            <Link
              href={`/portfolio/${row.id}/celta5`}
              onClick={(e) => e.stopPropagation()}
              title={row.stage1Filed ? "Stage 1 record filed" : row.stage1TutorialConfirmed === null ? "Stage 1 record not filed" : row.stage1TutorialConfirmed ? "Not filed -- tutorial confirmed" : "Not filed -- tutorial invited"}
              className={`hover:underline ${row.stage1Filed ? "text-ink" : "text-status-warning-text"}`}
            >
              {row.stage1Filed ? "Filed" : "Not yet"}
            </Link>
          </td>
          <td className="text-center">
            {/* Two short tokens -- "3rd · done" -- with the full state in the
                tooltip. It used to spell out "Not booked · Stage 3 N/A" and
                the moved-earlier reasons in full, which made the detail
                view a wall (Ramy, 5 Sep 2026). */}
            {(() => {
              const s3 = !row.stage3Required
                ? { short: "n/a", long: "Stage 3 not required for this candidate" }
                : row.stage3Done
                  ? { short: "done", long: "Stage 3 done" }
                  : row.stage3TutorialConfirmed === null
                    ? { short: "pending", long: "Stage 3 pending" }
                    : row.stage3TutorialConfirmed
                      ? { short: "confirmed", long: "Stage 3 tutorial confirmed" }
                      : { short: "invited", long: "Stage 3 tutorial invited" };
              const s2 = row.stage2BookedPosition ? { short: ordinal(row.stage2BookedPosition), long: `Stage 2 tutorial booked, ${ordinal(row.stage2BookedPosition)} slot` } : { short: "--", long: "Stage 2 tutorial not booked" };
              const moved = [row.stage2MovedEarlierReason ? `Stage 2 moved earlier: ${row.stage2MovedEarlierReason}` : null, row.stage3MovedEarlierReason ? `Stage 3 moved earlier: ${row.stage3MovedEarlierReason}` : null].filter(Boolean).join(" · ");
              return (
                <Link
                  href={`/portfolio/${row.id}/celta5`}
                  onClick={(e) => e.stopPropagation()}
                  title={[s2.long, s3.long, moved].filter(Boolean).join(" · ")}
                  className="whitespace-nowrap hover:underline text-ink"
                >
                  <span className={row.stage2BookedPosition ? "" : "text-status-warning-text"}>{s2.short}</span>
                  {" · "}
                  <span className={row.stage3Required && !row.stage3Done ? "text-status-warning-text" : ""}>{s3.short}</span>
                  {moved ? <span className="ml-1 text-status-warning-text" aria-label="moved earlier">*</span> : null}
                </Link>
              );
            })()}
            {isMct && (row.stage2CanMoveEarlier || row.stage3CanMoveEarlier) ? (
              <div className="mt-1 flex flex-col items-center gap-1">
                {row.stage2CanMoveEarlier && !row.stage2MovedEarlierReason ? <MoveEarlierControl traineeId={row.id} stage="stage2" /> : null}
                {row.stage3CanMoveEarlier && !row.stage3MovedEarlierReason ? <MoveEarlierControl traineeId={row.id} stage="stage3" /> : null}
              </div>
            ) : null}
          </td>
          <td className="text-center">
            <Link
              href={`/portfolio/${row.id}/celta5`}
              onClick={(e) => e.stopPropagation()}
              className={`hover:underline ${row.celta5SignoffStatus === "both_signed" ? "text-ink" : "text-status-warning-text"}`}
            >
              {CELTA5_SIGNOFF_LABEL[row.celta5SignoffStatus]}
            </Link>
          </td>
          <td
            className={`text-center tabular-nums ${row.folEntriesLow ? "text-status-warning-text" : "text-ink"}`}
            title={row.folEntriesLow ? "Below half the cohort's average -- may be under-logging" : "FOL entries logged this course"}
          >
            {row.folEntriesLogged}
          </td>
          <td className="text-center">
            <div className="ml-auto">
              <TrajectoryBarCompact value={row.trajectory} />
            </div>
          </td>
          <td className="text-center tabular-nums">
            {row.obsTasksTotal > 0 ? (
              <Link
                href={`/portfolio/${row.id}/celta5`}
                onClick={(e) => e.stopPropagation()}
                className={`hover:underline ${row.obsTasksDone < row.obsTasksTotal ? "text-status-warning-text" : "text-ink"}`}
              >
                {row.obsTasksDone}/{row.obsTasksTotal}
              </Link>
            ) : (
              <span className="text-muted">--</span>
            )}
          </td>
          <td className="text-center tabular-nums">
            {row.preCourseTaskTotal > 0 ? (
              <Link
                href={`/portfolio/${row.id}/pre-course-task`}
                onClick={(e) => e.stopPropagation()}
                className={`hover:underline ${row.preCourseTaskAnswered < row.preCourseTaskTotal ? "text-status-warning-text" : "text-ink"}`}
              >
                {row.preCourseTaskAnswered}/{row.preCourseTaskTotal}
              </Link>
            ) : (
              <span className="text-muted">--</span>
            )}
          </td>
          <td className="text-center tabular-nums">
            {row.filmedObsTotal > 0 ? (
              <Link
                href={`/portfolio/${row.id}/resources`}
                onClick={(e) => e.stopPropagation()}
                className={`hover:underline ${row.filmedObsDone < row.filmedObsTotal ? "text-status-warning-text" : "text-ink"}`}
              >
                {row.filmedObsDone}/{row.filmedObsTotal}
              </Link>
            ) : (
              <span className="text-muted">--</span>
            )}
          </td>
        </>
      ) : null}
    </tr>
  );
}
