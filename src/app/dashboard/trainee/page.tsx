import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { SubmissionStatusPill } from "@/lib/status-pill";
import { ASSIGNMENT_INFO, ASSIGNMENT_ORDER, ASSIGNMENT_WORD_COUNT } from "@/lib/assignment-info";

export default async function TraineeDashboardPage() {
  const profile = await requireRole("trainee");
  const supabase = await createClient();

  const [{ data: assignmentsRaw }, { data: lessons }] = await Promise.all([
    supabase.from("assignments").select("*").eq("trainee_id", profile.id),
    supabase
      .from("tp_lessons")
      .select("*")
      .eq("trainee_id", profile.id)
      .order("lesson_date", { ascending: false, nullsFirst: false }),
  ]);

  const assignments = (assignmentsRaw ?? []).sort(
    (a, b) => ASSIGNMENT_ORDER.indexOf(a.assignment_type) - ASSIGNMENT_ORDER.indexOf(b.assignment_type)
  );

  const totalMinutes = (lessons ?? []).reduce((sum, l) => sum + (l.length_minutes ?? 0), 0);
  const levels = new Set((lessons ?? []).map((l) => l.level).filter(Boolean));

  return (
    <div className="flex flex-col gap-6">
      <div className="card flex items-center justify-between p-6">
        <div>
          <h1 className="font-serif text-xl text-ink">Welcome, {profile.full_name}</h1>
          <p className="mt-2 text-muted">Your assignments and teaching practice.</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Link
            href="/dashboard/trainee/plan"
            className="rounded-[6px] border border-border px-4 py-2 text-sm text-ink hover:border-primary"
          >
            Lesson plans
          </Link>
          <Link
            href="/dashboard/trainee/celta5"
            className="rounded-[6px] border border-border px-4 py-2 text-sm text-ink hover:border-primary"
          >
            CELTA 5 record
          </Link>
        </div>
      </div>

      <div>
        <h2 className="font-serif text-lg text-ink">Assignments</h2>
        <div className="mt-3 flex flex-col gap-3">
          {assignments.length > 0 ? (
            assignments.map((a, i) => {
              const info = ASSIGNMENT_INFO[a.assignment_type];
              return (
                <div key={a.id} className="card p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted">
                        Assignment {i + 1}
                      </p>
                      <h3 className="font-serif text-lg text-ink">{info.title}</h3>
                    </div>
                    <SubmissionStatusPill status={a.first_status} />
                  </div>

                  <p className="mt-2 text-muted">{info.description}</p>

                  <p className="mt-3 text-sm text-muted">
                    {[
                      a.due_date ? `Due ${a.due_date}` : null,
                      ASSIGNMENT_WORD_COUNT,
                      a.first_submitted_at ? `Submitted ${a.first_submitted_at.slice(0, 10)}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>

                  {a.first_status === "resubmission_required" ? (
                    <div className="mt-3 border-t border-border-faint pt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted">Resubmission</span>
                        <SubmissionStatusPill status={a.resubmission_status} />
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-4 border-t border-border-faint pt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">
                      Tutor feedback
                    </p>
                    <p className="mt-2 text-ink">{a.tutor_feedback || "No feedback yet."}</p>
                  </div>

                  {a.final_grade ? (
                    <p className="mt-3 text-sm text-muted">Final grade: {a.final_grade}</p>
                  ) : null}
                </div>
              );
            })
          ) : (
            <p className="text-muted">No assignments yet.</p>
          )}
        </div>
      </div>

      <div>
        <h2 className="font-serif text-lg text-ink">Teaching Practice</h2>
        <p className="mt-1 text-sm text-muted">
          {(totalMinutes / 60).toFixed(1)} hours taught across {levels.size} level
          {levels.size === 1 ? "" : "s"} (6 hours across 2+ levels required).
        </p>
        <div className="card mt-3 overflow-hidden">
          <table className="table-plain w-full">
            <thead>
              <tr>
                <th className="text-sm text-muted">Date</th>
                <th className="text-sm text-muted">Level</th>
                <th className="text-sm text-muted">Focus</th>
                <th className="text-sm text-muted">Assessment</th>
              </tr>
            </thead>
            <tbody>
              {lessons && lessons.length > 0 ? (
                lessons.map((lesson) => (
                  <tr key={lesson.id}>
                    <td className="text-ink">{lesson.lesson_date ?? "--"}</td>
                    <td className="text-muted">{lesson.level ?? "--"}</td>
                    <td className="text-muted">{lesson.lesson_focus ?? "--"}</td>
                    <td>
                      <span
                        className={`status-pill ${
                          lesson.tutor_assessment === "not_to_standard"
                            ? "status-pill-at-risk"
                            : lesson.tutor_assessment
                              ? "status-pill-on-track"
                              : "status-pill-pending"
                        }`}
                      >
                        {lesson.tutor_assessment
                          ? lesson.tutor_assessment.replace(/_/g, " ")
                          : "Not yet assessed"}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="text-muted">
                    No lessons logged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
