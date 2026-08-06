import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { CELTA_CRITERIA_CODES, computeTrajectory } from "@/lib/celta-criteria";
import { TrajectoryBarCompact } from "@/components/trajectory-gradient-bar";

// The detailed operational roster -- moved here from the /trainer landing
// (which now just shows summary candidate cards + a link into this page)
// so the full column set (TPs passed, assignments left, attendance) still
// lives somewhere, just one level in rather than on the first thing you see.
export default async function TrainerRosterPage() {
  const session = await getCurrentProfile();
  const trainer = session?.profile?.role === "trainer" || session?.profile?.role === "admin" ? session.profile : null;
  const assessorCourseId = !trainer ? await getAssessorCourseId() : null;
  if (!trainer && !assessorCourseId) redirect("/login");

  const supabase = assessorCourseId ? createAdminClient() : await createClient();

  const courseId = trainer?.course_id ?? assessorCourseId;
  if (!courseId) {
    return <div className="sheet p-6 text-sm text-muted">No course assigned.</div>;
  }

  const { data: trainees } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("course_id", courseId)
    .eq("role", "trainee")
    .order("full_name");

  const traineeIds = (trainees ?? []).map((t) => t.id);
  const [{ data: lessons }, { data: feedbackRows }, { data: assignments }, { data: celta5Records }, { data: matrixRows }, { data: course }] =
    traineeIds.length > 0
      ? await Promise.all([
          supabase.from("tp_lessons").select("trainee_id, length_minutes").eq("course_id", courseId),
          supabase.from("tp_feedback").select("trainee_id, grade, submitted_at").in("trainee_id", traineeIds),
          supabase.from("assignments").select("trainee_id, first_status, resubmission_status").eq("course_id", courseId),
          supabase.from("celta5_records").select("trainee_id, hours_attended").eq("course_id", courseId),
          supabase.from("celta5_matrix").select("trainee_id, criteria_code, tutor_status_stage2").eq("course_id", courseId),
          supabase.from("courses").select("total_hours").eq("id", courseId).maybeSingle(),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: null }];

  const totalHours = course?.total_hours ?? 120;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-xl text-ink">Candidate roster</h1>
        <p className="text-xs text-muted">{(trainees ?? []).length} candidates · click a row to open a portfolio</p>
      </div>

      <div className="sheet overflow-hidden !p-0">
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
                      <div className="ml-auto">
                        <TrajectoryBarCompact value={trajectory} />
                      </div>
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
  );
}
