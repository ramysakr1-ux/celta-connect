import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CourseStatus, Database } from "@/lib/supabase/types";
import { CELTA_CRITERIA_CODES, computeCriteriaPct, computeTrajectory, type Trajectory } from "@/lib/celta-criteria";
import { TP_LESSON_LENGTH_MINUTES } from "@/lib/tp-plan-content";
import { computeAtRiskReasons, type AtRiskReason } from "@/lib/at-risk";
import { toLocalIso } from "@/lib/timetable-grid";

export interface RosterRow {
  id: string;
  name: string;
  courseStatus: CourseStatus;
  assessedHrs: number;
  tpsPassed: number;
  assignmentsLeft: number;
  criteriaPct: number;
  attendancePct: number;
  trajectory: Trajectory;
  atRiskReasons: AtRiskReason[];
  provisionalLabel: string | null;
  provisionalSlashed: boolean;
  // for-claude-code-unified-tracking.md: "Supervised review quizzes --
  // Column: Done/Pending + score + time spent." No scoring exists yet (the
  // spec's own open question -- reread-only vs reread+quiz -- isn't
  // resolved), so this is submitted-count/total + total time, not a score.
  supervisedDone: number;
  supervisedTotal: number;
  supervisedSecondsSpent: number;
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
    .select("id, full_name, course_status")
    .eq("course_id", courseId)
    .eq("role", "trainee")
    .order("full_name");

  const traineeIds = (trainees ?? []).map((t) => t.id);
  const [
    { data: taughtPlans },
    { data: feedbackRows },
    { data: assignments },
    { data: celta5Records },
    { data: matrixRows },
    { data: course },
    { data: supervisedEvents },
    { data: supervisedCompletions },
  ] =
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
            .select("trainee_id, assignment_type, first_status, resubmission_status, due_date, first_submitted_at")
            .eq("course_id", courseId),
          supabase
            .from("celta5_records")
            .select("trainee_id, hours_attended, provisional_grade, provisional_grade_upper")
            .eq("course_id", courseId),
          supabase.from("celta5_matrix").select("trainee_id, criteria_code, tutor_status_stage2").eq("course_id", courseId),
          supabase.from("courses").select("total_hours").eq("id", courseId).maybeSingle(),
          supabase.from("course_timetable_events").select("id").eq("course_id", courseId).eq("type", "supervised_session"),
          supabase
            .from("supervised_session_completions")
            .select("timetable_event_id, trainee_id, submitted_at, time_spent_seconds")
            .in("trainee_id", traineeIds),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: null }, { data: [] }, { data: [] }];

  const supervisedTotal = (supervisedEvents ?? []).length;

  const totalHours = course?.total_hours ?? 120;
  const today = toLocalIso(new Date());

  return (trainees ?? []).map((trainee) => {
    const tpsTaught = (taughtPlans ?? []).filter((p) => p.trainee_id === trainee.id).length;
    const assessedHrs = (tpsTaught * TP_LESSON_LENGTH_MINUTES) / 60;

    const tpsPassed = (feedbackRows ?? []).filter(
      (f) => f.trainee_id === trainee.id && f.submitted_at && f.grade !== "not_to_standard"
    ).length;

    const traineeAssignments = (assignments ?? []).filter((a) => a.trainee_id === trainee.id);
    // build-spec.md "Assignment 5": a Plagiarism Reflection "does not
    // count toward the 3-of-4 rule and cannot raise or lower the
    // certificate grade" -- excluded here, but still fed into
    // computeAtRiskReasons below (an overdue one is still a real
    // must-submit document, just not part of this specific tally).
    const standardAssignments = traineeAssignments.filter((a) => a.assignment_type !== "Plagiarism Reflection");
    const assignmentsPassed = standardAssignments.filter(
      (a) => a.first_status === "approved" || a.resubmission_status === "approved"
    ).length;
    const assignmentsLeft = Math.max(standardAssignments.length - assignmentsPassed, 0);

    const traineeMatrix = (matrixRows ?? []).filter((m) => m.trainee_id === trainee.id);
    const matrixByCode = new Map(traineeMatrix.map((m) => [m.criteria_code, m.tutor_status_stage2]));
    const criteriaPct = computeCriteriaPct(matrixByCode);

    const celta5Record = celta5Records?.find((r) => r.trainee_id === trainee.id);
    const hoursAttended = celta5Record?.hours_attended ?? 0;
    const attendancePct = Math.round((hoursAttended / totalHours) * 100);
    // for-claude-code-trainer-remaining-screens.md's "slashed provisional"
    // -- a candidate the tutors haven't settled between two adjacent
    // grades yet. Same provisional_grade/_upper pairing Grades Report
    // already reads (see cohort-sheet.tsx's wasSlashed).
    const provisionalLabel = celta5Record?.provisional_grade
      ? celta5Record.provisional_grade_upper
        ? `${celta5Record.provisional_grade} / ${celta5Record.provisional_grade_upper}`
        : celta5Record.provisional_grade
      : null;
    const provisionalSlashed = Boolean(celta5Record?.provisional_grade_upper);

    const trajectory = computeTrajectory(CELTA_CRITERIA_CODES.map((code) => matrixByCode.get(code) ?? null));

    const atRiskReasons = computeAtRiskReasons(
      (feedbackRows ?? []).filter((f) => f.trainee_id === trainee.id),
      traineeAssignments,
      today
    );

    const traineeSupervised = (supervisedCompletions ?? []).filter((c) => c.trainee_id === trainee.id);
    const supervisedDone = traineeSupervised.filter((c) => c.submitted_at).length;
    const supervisedSecondsSpent = traineeSupervised.reduce((sum, c) => sum + (c.time_spent_seconds ?? 0), 0);

    return {
      id: trainee.id,
      name: trainee.full_name,
      courseStatus: trainee.course_status,
      assessedHrs,
      tpsPassed,
      assignmentsLeft,
      criteriaPct,
      attendancePct,
      trajectory,
      atRiskReasons,
      provisionalLabel,
      provisionalSlashed,
      supervisedDone,
      supervisedTotal,
      supervisedSecondsSpent,
    };
  });
}
