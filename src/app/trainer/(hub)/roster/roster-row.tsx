"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { TrajectoryBarCompact } from "@/components/trajectory-gradient-bar";
import type { RosterRow } from "@/lib/roster";
import { AT_RISK_LABELS } from "@/lib/at-risk";
import { COURSE_STATUS_LABEL, isCourseStatusReadOnly } from "@/lib/course-status";
import { ordinal } from "@/lib/stage2-tutorials";

function formatSupervisedTime(totalSeconds: number): string {
  const m = Math.round(totalSeconds / 60);
  return m > 0 ? `${m} min` : "under a minute";
}

const CELTA5_SIGNOFF_LABEL: Record<RosterRow["celta5SignoffStatus"], string> = {
  not_started: "Not started",
  candidate_signed: "Candidate signed",
  both_signed: "Both signed",
};

// build-spec.md §8 bug 3 -- rows carried cursor-pointer but only the name
// cell actually navigated. Whole row now pushes to the portfolio; the
// name keeps its own <Link> too, for keyboard nav and hover color.
export function RosterRowView({ row }: { row: RosterRow }) {
  const router = useRouter();

  // §3 -- a withdrawn/deferred/etc. candidate is "present in the roster"
  // but their working columns (hrs, TPs, etc.) stop meaning anything once
  // frozen, so this row collapses to name + status rather than showing
  // stale numbers next to the others' live ones.
  if (isCourseStatusReadOnly(row.courseStatus)) {
    return (
      <tr className="cursor-pointer opacity-70" onClick={() => router.push(`/portfolio/${row.id}`)}>
        <td>
          <Link href={`/portfolio/${row.id}`} className="text-ink hover:text-primary">
            {row.name}
          </Link>
        </td>
        <td colSpan={15} className="text-right">
          <span className="pill pill-neutral">{COURSE_STATUS_LABEL[row.courseStatus]}</span>
        </td>
      </tr>
    );
  }

  return (
    <tr className="cursor-pointer" onClick={() => router.push(`/portfolio/${row.id}`)}>
      <td>
        <Link href={`/portfolio/${row.id}`} className="text-ink hover:text-primary">
          {row.name}
        </Link>
        {row.courseStatus === "extension" ? <span className="pill pill-info ml-2">Extension</span> : null}
      </td>
      <td className={`text-right tabular-nums ${row.assessedHrs < 6 ? "text-status-warning-text" : "text-ink"}`}>
        {row.assessedHrs.toFixed(2)}
      </td>
      <td className="text-right tabular-nums text-ink">{row.tpsPassed} / 8</td>
      <td className="text-right tabular-nums text-ink">
        {row.assignmentsTotal > 0 ? (
          <Link
            href={`/portfolio/${row.id}/assignments`}
            onClick={(e) => e.stopPropagation()}
            title={row.assignmentsResubmitted ? "Includes a resubmission" : "No resubmissions used"}
            className="hover:underline"
          >
            {row.assignmentsPassed} / {row.assignmentsTotal}
            {row.assignmentsResubmitted ? <sup className="ml-0.5 text-status-warning-text">R</sup> : null}
          </Link>
        ) : (
          <span className="text-muted">--</span>
        )}
      </td>
      <td className="text-right tabular-nums text-ink">{row.criteriaPct}%</td>
      <td className={`text-right tabular-nums ${row.attendancePct < 80 ? "font-semibold text-destructive" : "text-ink"}`}>
        {row.attendancePct}%
      </td>
      <td className="text-right tabular-nums">
        {row.tpStagesTaught > 0 ? (
          <Link
            href={`/portfolio/${row.id}/tp`}
            onClick={(e) => e.stopPropagation()}
            title="Taught TPs with plan + self-evaluation + feedback all submitted"
            className={`hover:underline ${row.tpStagesBehind > 0 ? "text-status-warning-text" : "text-ink"}`}
          >
            {row.tpStagesTaught - row.tpStagesBehind} / {row.tpStagesTaught}
          </Link>
        ) : (
          <span className="text-muted">--</span>
        )}
      </td>
      <td className="text-right tabular-nums">
        {row.supervisedTotal > 0 ? (
          <Link
            href={`/portfolio/${row.id}/timetable`}
            onClick={(e) => e.stopPropagation()}
            title={`${formatSupervisedTime(row.supervisedSecondsSpent)} spent -- click to see per-session status on their timetable`}
            className={`hover:underline ${row.supervisedDone < row.supervisedTotal ? "text-status-warning-text" : "text-ink"}`}
          >
            {row.supervisedDone} / {row.supervisedTotal}
          </Link>
        ) : (
          <span className="text-muted">--</span>
        )}
      </td>
      <td className="text-right tabular-nums">
        <Link
          href={`/portfolio/${row.id}/celta5`}
          onClick={(e) => e.stopPropagation()}
          className={`hover:underline ${row.observationHoursShort ? "text-status-warning-text" : "text-ink"}`}
        >
          {row.observationHoursCounted.toFixed(1)} / 6
        </Link>
      </td>
      <td className="text-right">
        <Link
          href={`/portfolio/${row.id}/celta5`}
          onClick={(e) => e.stopPropagation()}
          className={`hover:underline ${row.stage1Filed ? "text-ink" : "text-status-warning-text"}`}
        >
          {row.stage1Filed ? "Filed" : "Not filed"}
        </Link>
      </td>
      <td className="text-right">
        <Link href={`/portfolio/${row.id}/celta5`} onClick={(e) => e.stopPropagation()} className="hover:underline text-ink">
          {row.stage2BookedPosition ? ordinal(row.stage2BookedPosition) : <span className="text-status-warning-text">Not booked</span>}
          {" · "}
          {row.stage3Required ? (row.stage3Done ? "Stage 3 done" : "Stage 3 pending") : "Stage 3 N/A"}
        </Link>
      </td>
      <td className="text-right">
        <Link
          href={`/portfolio/${row.id}/celta5`}
          onClick={(e) => e.stopPropagation()}
          className={`hover:underline ${row.celta5SignoffStatus === "both_signed" ? "text-ink" : "text-status-warning-text"}`}
        >
          {CELTA5_SIGNOFF_LABEL[row.celta5SignoffStatus]}
        </Link>
      </td>
      <td
        className={`text-right tabular-nums ${row.folEntriesLow ? "text-status-warning-text" : "text-ink"}`}
        title={row.folEntriesLow ? "Below half the cohort's average -- may be under-logging" : "FOL entries logged this course"}
      >
        {row.folEntriesLogged}
      </td>
      <td className="text-right">
        <div className="ml-auto">
          <TrajectoryBarCompact value={row.trajectory} />
        </div>
      </td>
      <td className={`text-right ${row.provisionalSlashed ? "font-bold text-destructive" : "text-ink"}`}>
        {row.provisionalLabel ?? <span className="text-muted">Not set</span>}
      </td>
      <td className="text-right">
        {row.atRiskReasons.length > 0 ? (
          <span title={row.atRiskReasons.map((r) => AT_RISK_LABELS[r]).join(" · ")} className="pill pill-danger">
            At risk
          </span>
        ) : null}
      </td>
    </tr>
  );
}
