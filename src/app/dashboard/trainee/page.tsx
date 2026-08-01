import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { SubmissionStatusPill } from "@/lib/status-pill";

export default async function TraineeDashboardPage() {
  const profile = await requireRole("trainee");
  const supabase = await createClient();

  const [{ data: assignments }, { data: tps }] = await Promise.all([
    supabase
      .from("assignments")
      .select("*")
      .eq("trainee_id", profile.id)
      .order("assignment_type"),
    supabase.from("tps").select("*").eq("trainee_id", profile.id).order("tp_number"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-6">
        <h1 className="font-serif text-xl text-ink">Welcome, {profile.full_name}</h1>
        <p className="mt-2 text-muted">Your assignments and teaching practice.</p>
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
        <div className="card mt-3 overflow-hidden">
          <table className="table-plain w-full">
            <thead>
              <tr>
                <th className="text-sm text-muted">TP</th>
                <th className="text-sm text-muted">Main aim</th>
                <th className="text-sm text-muted">Scheduled</th>
                <th className="text-sm text-muted">Status</th>
              </tr>
            </thead>
            <tbody>
              {tps?.map((tp) => (
                <tr key={tp.id}>
                  <td className="text-ink">TP{tp.tp_number}</td>
                  <td className="text-muted">{tp.main_aim ?? "--"}</td>
                  <td className="text-muted">
                    {tp.scheduled_at
                      ? new Date(tp.scheduled_at).toLocaleDateString()
                      : "Not yet scheduled"}
                  </td>
                  <td>
                    <span
                      className={`status-pill ${
                        Object.keys(tp.stage_grades ?? {}).length > 0
                          ? "status-pill-on-track"
                          : "status-pill-pending"
                      }`}
                    >
                      {Object.keys(tp.stage_grades ?? {}).length > 0
                        ? "Graded"
                        : "Not yet assessed"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
