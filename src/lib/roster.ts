import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { CELTA_CRITERIA_CODES, computeCriteriaPct, computeTrajectory, type Trajectory } from "@/lib/celta-criteria";
import { TP_LESSON_LENGTH_MINUTES } from "@/lib/tp-plan-content";
import { computeAtRiskReasons, type AtRiskReason } from "@/lib/at-risk";
import { toLocalIso } from "@/lib/timetable-grid";

export interface RosterRow {
  id: string;
  name: string;
  assessedHrs: number;
  tpsPassed: number;
  assignmentsLeft: number;
  criteriaPct: number;
  attendancePct: number;
  trajectory: Trajectory;
  atRiskReasons: AtRiskReason[];
}

// Single source of truth for what a roster row means -- both the roster
// page and its CSV export call this, so the two can never disagree on a
// column's definition (checkpoint 2, per Ramy's build-spec.md).
export async function fetchRosterRows(
  supabase: SupabaseClient<Database>,
  courseId: string
): Promise<RosterRow[]> {
  const { data: trainees } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("course_id", courseId)
    .eq("role", "trainee")
    .order("full_name");

  const traineeIds = (trainees ?? []).map((t) => t.id);
  const [{ data: taughtPlans }, { data: feedbackRows }, { data: assignments }, { data: celta5Records }, { data: matrixRows }, { data: course }] =
    traineeIds.length > 0
      ? await Promise.all([
          // Real "taught" signal is plan_assignments.taught_at (migration
          // 0017) -- tp_lessons is only ever written by the old,
          // pre-rebuild trainer page and reads as permanently empty for any
          // course run through the live app (same dead-table bug already
          // fixed for the CELTA5 record's own "hrs assessed" stat).
          supabase.from("plan_assignments").select("trainee_id").eq("course_id", courseId).not("taught_at", "is", null),
          supabase
            .from("tp_feedback")
            .select(
              "trainee_id, tp_number, grade, submitted_at, strengths_planning, strengths_teaching, action_points_planning, action_points_teaching"
            )
            .in("trainee_id", traineeIds),
          supabase
            .from("assignments")
            .select("trainee_id, first_status, resubmission_status, due_date, first_submitted_at")
            .eq("course_id", courseId),
          supabase.from("celta5_records").select("trainee_id, hours_attended").eq("course_id", courseId),
          supabase.from("celta5_matrix").select("trainee_id, criteria_code, tutor_status_stage2").eq("course_id", courseId),
          supabase.from("courses").select("total_hours").eq("id", courseId).maybeSingle(),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: null }];

  const totalHours = course?.total_hours ?? 120;
  const today = toLocalIso(new Date());

  return (trainees ?? []).map((trainee) => {
    const tpsTaught = (taughtPlans ?? []).filter((p) => p.trainee_id === trainee.id).length;
    const assessedHrs = (tpsTaught * TP_LESSON_LENGTH_MINUTES) / 60;

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
    const criteriaPct = computeCriteriaPct(matrixByCode);

    const hoursAttended = celta5Records?.find((r) => r.trainee_id === trainee.id)?.hours_attended ?? 0;
    const attendancePct = Math.round((hoursAttended / totalHours) * 100);

    const trajectory = computeTrajectory(CELTA_CRITERIA_CODES.map((code) => matrixByCode.get(code) ?? null));

    const atRiskReasons = computeAtRiskReasons(
      (feedbackRows ?? []).filter((f) => f.trainee_id === trainee.id),
      traineeAssignments,
      today
    );

    return {
      id: trainee.id,
      name: trainee.full_name,
      assessedHrs,
      tpsPassed,
      assignmentsLeft,
      criteriaPct,
      attendancePct,
      trajectory,
      atRiskReasons,
    };
  });
}
