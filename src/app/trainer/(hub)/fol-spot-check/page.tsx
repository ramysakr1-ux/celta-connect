import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { computeCourseDayProgress } from "@/lib/course-day";

// specs/for-claude-code-fol-spot-check.md, extending
// for-claude-code-fol-pooled-evidence.md's "Trainer UX / Days 2-9": "a spot-
// check view showing per-class log counts (flagging classes with ~0
// entries) is useful but not required for v1." Optional, but fully
// specified, so built. Not a nav tab -- linked from the roster page's
// existing "FOL pool, by class" pill row, same non-tab pattern as
// Announcements.
//
// Two columns the spec asked for don't exist as real data and were dropped
// rather than fabricated (Ramy, 2026-08-19): volunteer_students has no
// link to a TP group/class at all (tp_class is free text typed at logging
// time, not a foreign key), so there's no trustworthy learner-count
// source; and course_subgroups has no level field (level changes per TP
// round via tp_coursebooks, not fixed per group).
export default async function FolSpotCheckPage() {
  const trainer = await requireRole(["trainer", "admin"]);
  const courseId = trainer.course_id;
  if (!courseId) {
    return <div className="sheet p-6 text-sm text-muted">No course assigned.</div>;
  }
  const supabase = await createClient();

  const [{ data: subgroups }, { data: logRows }, { data: timetableDates }] = await Promise.all([
    supabase.from("course_subgroups").select("name").eq("course_id", courseId).order("name"),
    supabase.from("class_error_log").select("tp_class, problem_type, logged_at").eq("course_id", courseId),
    supabase.from("course_timetable_events").select("event_date").eq("course_id", courseId).order("event_date"),
  ]);

  const dayProgress = await computeCourseDayProgress(supabase, courseId);

  // Same "Nth distinct timetabled date" clock as course-day.ts -- Day 10 is
  // the FOL divergence session (timetable-skeleton.ts, both full- and
  // part-time skeletons place the milestone there).
  const distinctDates = Array.from(new Set((timetableDates ?? []).map((d) => d.event_date))).sort();
  const divergenceDate = distinctDates[9] ?? null;
  const today = new Date().toISOString().slice(0, 10);
  const daysUntilDivergence = divergenceDate
    ? Math.max(0, Math.round((new Date(divergenceDate).getTime() - new Date(today).getTime()) / 86_400_000))
    : null;

  type Row = { name: string; grammarCount: number; pronCount: number; lastLoggedAt: string | null };
  const rowByName = new Map<string, Row>();
  for (const s of subgroups ?? []) rowByName.set(s.name, { name: s.name, grammarCount: 0, pronCount: 0, lastLoggedAt: null });
  for (const log of logRows ?? []) {
    const row = rowByName.get(log.tp_class);
    if (!row) continue; // a class name logged that no longer matches a real subgroup -- nothing to attribute it to
    if (log.problem_type === "grammar") row.grammarCount++;
    else row.pronCount++;
    if (!row.lastLoggedAt || log.logged_at > row.lastLoggedAt) row.lastLoggedAt = log.logged_at;
  }
  const rows = [...rowByName.values()].sort((a, b) => a.name.localeCompare(b.name));

  function statusFor(row: Row): { label: string; pillClass: string } {
    const total = row.grammarCount + row.pronCount;
    if (total === 0) return { label: "Empty", pillClass: "pill-danger" };
    if (total <= 2) return { label: "Low", pillClass: "pill-warning" };
    return { label: "On track", pillClass: "pill-success" };
  }

  function relativeTime(iso: string | null): string {
    if (!iso) return "—";
    const diffMs = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diffMs / 60_000);
    if (minutes < 60) return minutes <= 1 ? "just now" : `${minutes} minutes ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="sheet flex flex-col gap-2 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Focus on the Learner · Days 2–9</p>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-serif text-xl text-ink">Error log — spot check</h1>
          <p className="text-sm text-muted">
            {dayProgress ? `Day ${dayProgress.currentDay} of ${dayProgress.totalDays}` : null}
            {dayProgress && daysUntilDivergence !== null ? " · " : null}
            {daysUntilDivergence !== null
              ? daysUntilDivergence === 0
                ? "Divergence session today"
                : `${daysUntilDivergence} day${daysUntilDivergence === 1 ? "" : "s"} until the divergence session`
              : null}
          </p>
        </div>
        <p className="text-sm text-muted">
          This is a pulse check, not a ranking -- it exists to catch a class that's logged nothing before Day 10, not
          to compare candidates against each other. It doesn't show what anyone's claimed or plans to claim.
        </p>
      </div>

      <div className="sheet overflow-x-auto !p-0">
        <table className="table-plain w-full">
          <thead>
            <tr>
              <th className="text-sm text-muted">Class</th>
              <th className="text-right text-sm text-muted">Grammar</th>
              <th className="text-right text-sm text-muted">Pronunciation</th>
              <th className="text-right text-sm text-muted">Last logged</th>
              <th className="text-right text-sm text-muted">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-sm text-muted">
                  No TP classes set up for this course yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const status = statusFor(row);
                return (
                  <tr key={row.name}>
                    <td className="text-sm font-medium text-ink">{row.name}</td>
                    <td className="text-right tabular-nums text-sm text-ink">{row.grammarCount}</td>
                    <td className="text-right tabular-nums text-sm text-ink">{row.pronCount}</td>
                    <td className="text-right text-sm text-muted">{relativeTime(row.lastLoggedAt)}</td>
                    <td className="text-right">
                      <span className={`pill ${status.pillClass}`}>{status.label}</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="sheet flex flex-wrap items-center gap-4 p-4 text-xs text-muted">
        <span className="font-semibold uppercase tracking-[0.08em]">Status</span>
        <span className="flex items-center gap-1.5">
          <span className="pill pill-danger">Empty</span> 0 logged
        </span>
        <span className="flex items-center gap-1.5">
          <span className="pill pill-warning">Low</span> 1–2 logged
        </span>
        <span className="flex items-center gap-1.5">
          <span className="pill pill-success">On track</span> 3+ logged
        </span>
      </div>

      <BackLink href="/trainer/roster" label={"Back to Roster"} />
    </div>
  );
}
