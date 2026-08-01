import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { SubmissionStatusPill } from "@/lib/status-pill";

export default async function TraineeDashboardPage() {
  const profile = await requireRole("trainee");
  const supabase = await createClient();

  const [{ data: assignments }, { data: lessons }] = await Promise.all([
    supabase
      .from("assignments")
      .select("*")
      .eq("trainee_id", profile.id)
      .order("assignment_type"),
    supabase
      .from("tp_lessons")
      .select("*")
      .eq("trainee_id", profile.id)
      .order("lesson_date", { ascending: false, nullsFirst: false }),
  ]);

  const totalMinutes = (lessons ?? []).reduce((sum, l) => sum + (l.length_minutes ?? 0), 0);
  const levels = new Set((lessons ?? []).map((l) => l.level).filter(Boolean));

  return (
    <div className="flex flex-col gap-6">
      <div className="card flex items-center justify-between p-6">
        <div>
          <h1 className="font-serif text-xl text-ink">Welcome, {profile.full_name}</h1>
          <p className="mt-2 text-muted">Your assignments and teaching practice.</p>
        </div>
        <Link
          href="/dashboard/trainee/celta5"
          className="rounded-[6px] border border-border px-4 py-2 text-sm text-ink hover:border-primary"
        >
          CELTA 5 record
        </Link>
      </div>

      <div>
        <h2 className="font-serif text-lg text-ink">Assignments</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {assignments?.map((a) => (
            <div key={a.id} className="card p-4">
              <div className="flex items-center justify-between">
                <span className="text-ink">{a.assignment_type}</span>
                <SubmissionStatusPill status={a.first_status} />
              </div>
              {a.first_status === "resubmission_required" ? (
                <div className="mt-3 border-t border-border pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted">Resubmission</span>
                    <SubmissionStatusPill status={a.resubmission_status} />
                  </div>
                </div>
              ) : null}
              {a.final_grade ? (
                <p className="mt-2 text-sm text-muted">Final grade: {a.final_grade}</p>
              ) : null}
            </div>
          ))}
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
