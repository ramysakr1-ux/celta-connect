"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { TrajectoryBarCompact } from "@/components/trajectory-gradient-bar";
import type { RosterRow } from "@/lib/roster";
import { AT_RISK_LABELS } from "@/lib/at-risk";
import { COURSE_STATUS_LABEL, isCourseStatusReadOnly } from "@/lib/course-status";

function formatSupervisedTime(totalSeconds: number): string {
  const m = Math.round(totalSeconds / 60);
  return m > 0 ? `${m} min` : "under a minute";
}

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
        <td colSpan={9} className="text-right">
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
      <td className="text-right tabular-nums text-ink">{row.assignmentsLeft}</td>
      <td className="text-right tabular-nums text-ink">{row.criteriaPct}%</td>
      <td className={`text-right tabular-nums ${row.attendancePct < 80 ? "font-semibold text-destructive" : "text-ink"}`}>
        {row.attendancePct}%
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
