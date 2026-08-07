"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { TrajectoryBarCompact } from "@/components/trajectory-gradient-bar";
import type { RosterRow } from "@/lib/roster";

// build-spec.md §8 bug 3 -- rows carried cursor-pointer but only the name
// cell actually navigated. Whole row now pushes to the portfolio; the
// name keeps its own <Link> too, for keyboard nav and hover color.
export function RosterRowView({ row }: { row: RosterRow }) {
  const router = useRouter();
  return (
    <tr className="cursor-pointer" onClick={() => router.push(`/portfolio/${row.id}`)}>
      <td>
        <Link href={`/portfolio/${row.id}`} className="text-ink hover:text-primary">
          {row.name}
        </Link>
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
      <td className="text-right">
        <div className="ml-auto">
          <TrajectoryBarCompact value={row.trajectory} />
        </div>
      </td>
    </tr>
  );
}
