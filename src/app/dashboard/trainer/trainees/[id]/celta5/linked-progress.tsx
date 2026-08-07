import Link from "next/link";
import {
  ASSIGNMENT_INFO,
  ASSIGNMENT_ORDER,
  ASSIGNMENT_STATUS_LABEL,
  ASSIGNMENT_STATUS_PILL_CLASS,
} from "@/lib/assignment-info";
import { StandardRatingPill } from "@/lib/status-pill";
import { MIN_LEVELS_REQUIRED, type AssessedTpStats } from "@/lib/course-progress";
import type { Database } from "@/lib/supabase/types";

type AssignmentRow = Database["public"]["Tables"]["assignments"]["Row"];
type TpFeedbackRow = Database["public"]["Tables"]["tp_feedback"]["Row"];

// Section 6 stats badge -- "X hrs assessed" plus the distinct-levels count
// build-spec.md calls out specifically ("at least two levels", not just
// hours). Sits above TpFeedbackSummary in both the trainee-own and staff
// views since both already render that list from the same taught-TP data.
export function AssessedTpStatsBadge({ stats }: { stats: AssessedTpStats }) {
  const levelsOk = stats.levels.length >= MIN_LEVELS_REQUIRED;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="rounded-[6px] bg-accent px-2.5 py-1 text-xs font-medium text-ink">
        {stats.tpsTaught} TP{stats.tpsTaught === 1 ? "" : "s"} taught · {stats.hoursAssessed.toFixed(1)} hrs assessed
      </span>
      <span
        className={`rounded-[6px] px-2.5 py-1 text-xs font-medium ${
          levelsOk ? "bg-accent text-ink" : "border border-dashed border-gold text-gold"
        }`}
      >
        Levels taught: {stats.levels.length > 0 ? stats.levels.join(", ") : "none yet"} ({stats.levels.length} of{" "}
        {MIN_LEVELS_REQUIRED} required)
      </span>
    </div>
  );
}

// Auto-pulled from the assignments/TP-feedback trainers already fill in
// elsewhere in the app, so the Stage Two/Three "written assignments notes"
// fields below don't have to be a retyped summary of data that already
// exists -- the confirmed gap: C5 should read from the rest of the app,
// never duplicate it.
export function AssignmentsSummary({
  traineeId,
  assignments,
}: {
  traineeId: string;
  assignments: AssignmentRow[];
}) {
  if (assignments.length === 0) return null;
  const sorted = [...assignments].sort(
    (a, b) => ASSIGNMENT_ORDER.indexOf(a.assignment_type) - ASSIGNMENT_ORDER.indexOf(b.assignment_type)
  );

  return (
    <div>
      <h3 className="font-serif text-lg text-ink">Written assignments (auto-pulled)</h3>
      <div className="sheet mt-3 overflow-hidden !p-0">
        <table className="table-plain w-full">
          <thead>
            <tr>
              <th className="text-sm text-muted">Assignment</th>
              <th className="text-sm text-muted">Status</th>
              <th className="text-sm text-muted">Own work</th>
              <th className="text-sm text-muted">Final grade</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((a) => {
              const isResubmissionRound = a.first_status === "resubmission_required";
              const status = isResubmissionRound ? a.resubmission_status : a.first_status;
              const ownWorkConfirmed = isResubmissionRound ? a.resubmission_own_work_confirmed : a.first_own_work_confirmed;
              return (
                <tr key={a.id}>
                  <td className="text-ink">
                    <Link href={`/portfolio/${traineeId}/assignments/${a.id}`} className="hover:text-primary">
                      {ASSIGNMENT_INFO[a.assignment_type].title}
                    </Link>
                  </td>
                  <td>
                    <span className={`pill ${ASSIGNMENT_STATUS_PILL_CLASS[status]}`}>
                      {ASSIGNMENT_STATUS_LABEL[status]}
                    </span>
                  </td>
                  <td className="text-muted">{status === "not_submitted" ? "--" : ownWorkConfirmed ? "Confirmed" : "Not confirmed"}</td>
                  <td className="text-muted">{a.final_grade ?? "--"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TpFeedbackSummary({
  traineeId,
  feedbackRows,
}: {
  traineeId: string;
  feedbackRows: TpFeedbackRow[];
}) {
  const submitted = feedbackRows.filter((f) => f.submitted_at).sort((a, b) => a.tp_number - b.tp_number);
  if (submitted.length === 0) return null;

  return (
    <div>
      <h3 className="font-serif text-lg text-ink">TP feedback so far (auto-pulled)</h3>
      <div className="sheet mt-3 flex flex-col gap-3 !p-0">
        {submitted.map((f) => {
          const starred = [...(f.action_points_planning ?? []), ...(f.action_points_teaching ?? [])].filter(
            (p) => p.starred
          );
          return (
            <div key={f.id} className="list-row">
              <div className="flex items-center justify-between gap-3">
                <Link
                  href={`/portfolio/${traineeId}/tp/${f.tp_number}`}
                  className="text-sm font-medium text-ink hover:text-primary"
                >
                  TP {f.tp_number}
                </Link>
                <StandardRatingPill rating={f.grade} />
              </div>
              {f.overall_comment ? <p className="mt-2 text-sm text-ink">{f.overall_comment}</p> : null}
              {starred.length > 0 ? (
                <ul className="mt-2 flex flex-col gap-1">
                  {starred.map((p, i) => (
                    <li key={i} className="text-xs text-muted">
                      ★ {p.text}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
