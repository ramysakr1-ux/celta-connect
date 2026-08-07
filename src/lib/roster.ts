import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { CELTA_CRITERIA_CODES, computeCriteriaPct, computeTrajectory, type Trajectory } from "@/lib/celta-criteria";

export interface RosterRow {
  id: string;
  name: string;
  assessedHrs: number;
  tpsPassed: number;
  assignmentsLeft: number;
  criteriaPct: number;
  attendancePct: number;
  trajectory: Trajectory;
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

  return (trainees ?? []).map((trainee) => {
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
    const criteriaPct = computeCriteriaPct(matrixByCode);

    const hoursAttended = celta5Records?.find((r) => r.trainee_id === trainee.id)?.hours_attended ?? 0;
    const attendancePct = Math.round((hoursAttended / totalHours) * 100);

    const trajectory = computeTrajectory(CELTA_CRITERIA_CODES.map((code) => matrixByCode.get(code) ?? null));

    return {
      id: trainee.id,
      name: trainee.full_name,
      assessedHrs,
      tpsPassed,
      assignmentsLeft,
      criteriaPct,
      attendancePct,
      trajectory,
    };
  });
}
