import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { CELTA_CRITERIA_CODES, computeTrajectory, type Trajectory } from "@/lib/celta-criteria";

const TRAJECTORY_LABEL: Record<Trajectory, string> = {
  "Pass A": "Pass A",
  "Pass B": "Pass B",
  Pass: "Pass",
  Fail: "At Risk",
  not_enough_data: "Not Yet Assessed",
};

const TRAJECTORY_PILL_CLASS: Record<Trajectory, string> = {
  "Pass A": "pill-success",
  "Pass B": "pill-success",
  Pass: "pill-success",
  Fail: "pill-danger",
  not_enough_data: "pill-neutral",
};

// §10 -- the trainer/admin home. Was previously a dead link (every portfolio
// page's "Command Centre" header link pointed at /trainer with no page.tsx
// behind it -- a real 404, not a placeholder). The roster reuses
// computeTrajectory() for the "Standing" column exactly as the CELTA5
// trainer page already does (same function, same "trainer-only, estimated"
// caveat) rather than inventing a second grading signal.
export default async function TrainerHomePage() {
  const trainer = await requireRole("trainer");
  const supabase = await createClient();

  if (!trainer.course_id) {
    return <div className="sheet p-6 text-sm text-muted">No course assigned.</div>;
  }

  const courseId = trainer.course_id;

  const [{ data: course }, { data: trainees }] = await Promise.all([
    supabase.from("courses").select("name, start_date, end_date, total_hours").eq("id", courseId).maybeSingle(),
    supabase.from("profiles").select("id, full_name").eq("course_id", courseId).eq("role", "trainee").order("full_name"),
  ]);

  const traineeIds = (trainees ?? []).map((t) => t.id);
  const [{ data: lessons }, { data: feedbackRows }, { data: assignments }, { data: celta5Records }, { data: matrixRows }] =
    traineeIds.length > 0
      ? await Promise.all([
          supabase.from("tp_lessons").select("trainee_id, length_minutes").eq("course_id", courseId),
          supabase.from("tp_feedback").select("trainee_id, grade, submitted_at").in("trainee_id", traineeIds),
          supabase.from("assignments").select("trainee_id, first_status, resubmission_status").eq("course_id", courseId),
          supabase.from("celta5_records").select("trainee_id, hours_attended").eq("course_id", courseId),
          supabase.from("celta5_matrix").select("trainee_id, criteria_code, tutor_status_stage2").eq("course_id", courseId),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const totalHours = course?.total_hours ?? 120;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-serif text-2xl text-ink">Trainer Command Center</h1>
        <p className="mt-1 text-sm text-muted">
          {[course?.name, course ? `${course.start_date} – ${course.end_date}` : null].filter(Boolean).join(" · ")}
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg text-ink">Candidate roster</h2>
          <p className="text-xs text-muted">{(trainees ?? []).length} candidates · click a row to open a portfolio</p>
        </div>

        <div className="sheet mt-3 overflow-hidden !p-0">
          <table className="table-plain w-full">
            <thead>
              <tr>
                <th className="text-sm text-muted">Candidate</th>
                <th className="text-right text-sm text-muted">Assessed hrs</th>
                <th className="text-right text-sm text-muted">TPs passed</th>
                <th className="text-right text-sm text-muted">Assignments left</th>
                <th className="text-right text-sm text-muted">Criteria</th>
                <th className="text-right text-sm text-muted">Attendance</th>
                <th className="text-right text-sm text-muted">Standing</th>
              </tr>
            </thead>
            <tbody>
              {trainees && trainees.length > 0 ? (
                trainees.map((trainee) => {
                  const traineeLessons = (lessons ?? []).filter((l) => l.trainee_id === trainee.id);
                  const assessedHrs = traineeLessons.reduce((sum, l) => sum + (l.length_minutes ?? 0), 0) / 60;

                  const tpsPassed = (feedbackRows ?? []).filter(
                    (f) => f.trainee_id === trainee.id && f.submitted_at && f.grade !== "not_to_standard"
                  ).length;

                  const traineeAssignments = (assignments ?? []).filter((a) => a.trainee_id === trainee.id);
                  const assignmentsPassed = traineeAssignments.filter(
                    (a) => a.first_status === "approved" || a.resubmission_status === "approved"
                  ).length;
                  const assignmentsLeft = Math.max(traineeAssignments.length - assignmentsPassed, 0);

                  const traineeMatrix = (matrixRows ?? []).filter((m) => m.trainee_id === trainee.id);
                  const matrixByCode = new Map(traineeMatrix.map((m) => [m.criteria_code, m.tutor_status_stage2]));
                  const achievedCount = traineeMatrix.filter((m) => m.tutor_status_stage2 === "S+" || m.tutor_status_stage2 === "S").length;
                  const criteriaPct = Math.round((achievedCount / CELTA_CRITERIA_CODES.length) * 100);

                  const hoursAttended = celta5Records?.find((r) => r.trainee_id === trainee.id)?.hours_attended ?? 0;
                  const attendancePct = Math.round((hoursAttended / totalHours) * 100);

                  const trajectory = computeTrajectory(CELTA_CRITERIA_CODES.map((code) => matrixByCode.get(code) ?? null));

                  return (
                    <tr key={trainee.id} className="cursor-pointer">
                      <td>
                        <Link href={`/portfolio/${trainee.id}`} className="text-ink hover:text-primary">
                          {trainee.full_name}
                        </Link>
                      </td>
                      <td className={`text-right tabular-nums ${assessedHrs < 6 ? "text-status-warning-text" : "text-ink"}`}>
                        {assessedHrs.toFixed(2)}
                      </td>
                      <td className="text-right tabular-nums text-ink">{tpsPassed} / 8</td>
                      <td className="text-right tabular-nums text-ink">{assignmentsLeft}</td>
                      <td className="text-right tabular-nums text-ink">{criteriaPct}%</td>
                      <td className={`text-right tabular-nums ${attendancePct < 80 ? "font-semibold text-destructive" : "text-ink"}`}>
                        {attendancePct}%
                      </td>
                      <td className="text-right">
                        <span className={`pill ${TRAJECTORY_PILL_CLASS[trajectory]}`}>{TRAJECTORY_LABEL[trajectory]}</span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="text-muted">
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
