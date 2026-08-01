import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export default async function TrainerDashboardPage() {
  const profile = await requireRole("trainer");
  const supabase = await createClient();

  const courseId = profile.course_id;

  const [{ data: trainees }, { data: tps }, { data: assignments }] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .eq("course_id", courseId ?? "")
      .eq("role", "trainee")
      .order("full_name"),
    supabase.from("tps").select("*").eq("course_id", courseId ?? ""),
    supabase.from("assignments").select("*").eq("course_id", courseId ?? ""),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-6">
        <h1 className="font-serif text-xl text-ink">Welcome, {profile.full_name}</h1>
        <p className="mt-2 text-muted">Your cohort&apos;s TP and assignment progress.</p>
      </div>

      <div>
        <h2 className="font-serif text-lg text-ink">Cohort</h2>
        <div className="card mt-3 overflow-hidden">
          <table className="table-plain w-full">
            <thead>
              <tr>
                <th className="text-sm text-muted">Name</th>
                <th className="text-sm text-muted">TPs scheduled</th>
                <th className="text-sm text-muted">Assignments approved</th>
              </tr>
            </thead>
            <tbody>
              {trainees && trainees.length > 0 ? (
                trainees.map((trainee) => {
                  const traineeTps = tps?.filter((tp) => tp.trainee_id === trainee.id) ?? [];
                  const traineeAssignments =
                    assignments?.filter((a) => a.trainee_id === trainee.id) ?? [];
                  const scheduledCount = traineeTps.filter((tp) => tp.main_aim).length;
                  const approvedCount = traineeAssignments.filter(
                    (a) => a.first_status === "approved"
                  ).length;

                  return (
                    <tr key={trainee.id}>
                      <td>
                        <Link
                          href={`/dashboard/trainer/trainees/${trainee.id}`}
                          className="text-ink hover:text-primary"
                        >
                          {trainee.full_name}
                        </Link>
                      </td>
                      <td className="text-muted">{scheduledCount} / {traineeTps.length}</td>
                      <td className="text-muted">
                        {approvedCount} / {traineeAssignments.length}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={3} className="text-muted">
                    No trainees on this course yet.
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
