import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CourseStatus, Database } from "@/lib/supabase/types";
import { CELTA_CRITERIA_CODES, computeCriteriaPct, computeTrajectory, type Trajectory } from "@/lib/celta-criteria";
import { TP_LESSON_LENGTH_MINUTES } from "@/lib/tp-plan-content";
import { computeAtRiskReasons, type AtRiskReason } from "@/lib/at-risk";
import { toLocalIso } from "@/lib/timetable-grid";
import { computeObservationHours, OBSERVATION_HOURS_REQUIRED } from "@/lib/observation-hours";

export type Celta5SignoffStatus = "not_started" | "candidate_signed" | "both_signed";

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
  // Item 2: "plan submitted, self-evaluation written, feedback returned"
  // per taught TP. tpStagesTaught is the denominator (TPs actually taught
  // so far); tpStagesBehind counts taught TPs missing any of the three.
  tpStagesTaught: number;
  tpStagesBehind: number;
  // Item 4: filmed-capped hours, same real `observations` rows and same
  // shared helper the CELTA5 page reads, so the two can't drift. Peer
  // observation stays excluded (no "peer" column exists on `observations`
  // at all -- resolved in project_progress_tab_spec, not re-litigated here).
  observationHoursCounted: number;
  observationHoursShort: boolean;
  // Item 5
  stage1Filed: boolean;
  // Item 6: Stage 2 booking is a real slot with a position. Stage 1/3 are
  // individualized invites (migration 0129) -- null means not invited yet,
  // otherwise whether the candidate has confirmed the time the tutor set.
  stage2BookedPosition: number | null;
  stage1TutorialConfirmed: boolean | null;
  // Grade Pipeline handoff: MCT can flag a standing concern before the
  // standard checkpoint. Stage 1 has no equivalent -- its timing is fixed.
  stage2CanMoveEarlier: boolean;
  stage2MovedEarlierReason: string | null;
  stage3Required: boolean;
  stage3Done: boolean;
  stage3TutorialConfirmed: boolean | null;
  stage3CanMoveEarlier: boolean;
  stage3MovedEarlierReason: string | null;
  // Item 7
  celta5SignoffStatus: Celta5SignoffStatus;
  // Item 8: refines the existing "assignmentsLeft" with the raw counts +
  // whether a resubmission was ever used, per the spec's "N of 4 passed,
  // resubmission flag if used."
  assignmentsPassed: number;
  assignmentsTotal: number;
  assignmentsResubmitted: boolean;
  // Item 9: relative to the course, not an invented absolute number --
  // "flagged low" means below half the cohort's own average, since the
  // spec gave no fixed threshold.
  folEntriesLogged: number;
  folEntriesLow: boolean;
  // Observation Tasks (2026-08-16) -- same unified-tracking pattern as
  // every item above: a column here, not a new bespoke screen.
  obsTasksDone: number;
  obsTasksTotal: number;
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

  // Stage 2 blocks are scoped by course first, same two-step pattern the
  // Timetable page already uses (stage2_tutorial_slots has no course_id of
  // its own -- it only reaches the course through its block).
  const { data: stage2Blocks } =
    traineeIds.length > 0 ? await supabase.from("stage2_tutorial_blocks").select("id").eq("course_id", courseId) : { data: [] };
  const stage2BlockIds = (stage2Blocks ?? []).map((b) => b.id);

  const { data: tutorialInvites } =
    traineeIds.length > 0
      ? await supabase.from("individual_tutorial_invites").select("trainee_id, stage, confirmed_at").eq("course_id", courseId)
      : { data: [] };

  const [
    { data: taughtPlans },
    { data: feedbackRows },
    { data: assignments },
    { data: celta5Records },
    { data: matrixRows },
    { data: course },
    { data: supervisedEvents },
    { data: supervisedCompletions },
    { data: tpPlans },
    { data: tpSelfEvals },
    { data: observations },
    { data: stage2Slots },
    { data: errorLog },
    { data: obsTasks },
    { data: obsTaskSubmissions },
  ] =
    traineeIds.length > 0
      ? await Promise.all([
          // Real "taught" signal is plan_assignments.taught_at (migration
          // 0017) -- tp_lessons is only ever written by the old,
          // pre-rebuild trainer page and reads as permanently empty for any
          // course run through the live app (same dead-table bug already
          // fixed for the CELTA5 record's own "hrs assessed" stat).
          supabase.from("plan_assignments").select("trainee_id, tp_number").eq("course_id", courseId).not("taught_at", "is", null),
          supabase
            .from("tp_feedback")
            .select(
              "trainee_id, tp_number, grade, submitted_at, strengths_planning, strengths_teaching, action_points_planning, action_points_teaching"
            )
            .in("trainee_id", traineeIds),
          supabase
            .from("assignments")
            .select("trainee_id, assignment_type, first_status, resubmission_status, due_date, first_submitted_at, resubmission_submitted_at")
            .eq("course_id", courseId),
          supabase
            .from("celta5_records")
            .select(
              "trainee_id, hours_attended, provisional_grade, provisional_grade_upper, stage1_completed_at, stage2_candidate_submitted_at, stage2_completed_at, stage2_moved_earlier_at, stage2_moved_earlier_reason, trainee_signoff_final_at, trainer_signoff_final_at, stage3_required, stage3_finalized_at, stage3_moved_earlier_at, stage3_moved_earlier_reason"
            )
            .eq("course_id", courseId),
          supabase.from("celta5_matrix").select("trainee_id, criteria_code, tutor_status_stage2").eq("course_id", courseId),
          supabase.from("courses").select("total_hours").eq("id", courseId).maybeSingle(),
          supabase.from("course_timetable_events").select("id").eq("course_id", courseId).eq("type", "supervised_session"),
          supabase
            .from("supervised_session_completions")
            .select("timetable_event_id, trainee_id, submitted_at, time_spent_seconds")
            .in("trainee_id", traineeIds),
          supabase.from("tp_plans").select("trainee_id, tp_number, submitted_at").in("trainee_id", traineeIds),
          supabase.from("tp_self_evaluations").select("trainee_id, tp_number, submitted_at").in("trainee_id", traineeIds),
          supabase.from("observations").select("trainee_id, filmed, length_minutes").eq("course_id", courseId),
          stage2BlockIds.length > 0
            ? supabase.from("stage2_tutorial_slots").select("position, trainee_id, booked_at").in("block_id", stage2BlockIds)
            : Promise.resolve({ data: [] }),
          supabase.from("class_error_log").select("logged_by_candidate_id").eq("course_id", courseId),
          supabase.from("observation_tasks").select("id").eq("course_id", courseId),
          supabase
            .from("observation_task_submissions")
            .select("trainee_id, task_id")
            .in("trainee_id", traineeIds),
        ])
      : [
          { data: [] },
          { data: [] },
          { data: [] },
          { data: [] },
          { data: [] },
          { data: null },
          { data: [] },
          { data: [] },
          { data: [] },
          { data: [] },
          { data: [] },
          { data: [] },
          { data: [] },
          { data: [] },
          { data: [] },
        ];

  const supervisedTotal = (supervisedEvents ?? []).length;

  const totalHours = course?.total_hours ?? 120;
  const today = toLocalIso(new Date());

  // Item 9's "flagged low" is relative to the cohort, not an invented fixed
  // number -- the spec gave no absolute threshold.
  const folCountsByTrainee = new Map<string, number>();
  for (const row of errorLog ?? []) {
    folCountsByTrainee.set(row.logged_by_candidate_id, (folCountsByTrainee.get(row.logged_by_candidate_id) ?? 0) + 1);
  }
  const folAverage =
    traineeIds.length > 0 ? [...folCountsByTrainee.values()].reduce((sum, n) => sum + n, 0) / traineeIds.length : 0;

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

    const taughtTpNumbers = (taughtPlans ?? []).filter((p) => p.trainee_id === trainee.id).map((p) => p.tp_number);
    const planSubmittedTpNumbers = new Set(
      (tpPlans ?? []).filter((p) => p.trainee_id === trainee.id && p.submitted_at).map((p) => p.tp_number)
    );
    const selfEvalSubmittedTpNumbers = new Set(
      (tpSelfEvals ?? []).filter((e) => e.trainee_id === trainee.id && e.submitted_at).map((e) => e.tp_number)
    );
    const feedbackSubmittedTpNumbers = new Set(
      (feedbackRows ?? []).filter((f) => f.trainee_id === trainee.id && f.submitted_at).map((f) => f.tp_number)
    );
    const tpStagesTaught = taughtTpNumbers.length;
    const tpStagesBehind = taughtTpNumbers.filter(
      (n) => !planSubmittedTpNumbers.has(n) || !selfEvalSubmittedTpNumbers.has(n) || !feedbackSubmittedTpNumbers.has(n)
    ).length;

    const traineeObservations = (observations ?? []).filter((o) => o.trainee_id === trainee.id);
    const { hoursCounted: observationHoursCounted } = computeObservationHours(traineeObservations);
    const observationHoursShort = observationHoursCounted < OBSERVATION_HOURS_REQUIRED;

    const stage1Filed = Boolean(celta5Record?.stage1_completed_at);

    const traineeStage2Slot = (stage2Slots ?? []).find((s) => s.trainee_id === trainee.id && s.booked_at);
    const stage2BookedPosition = traineeStage2Slot?.position ?? null;
    const stage1Invite = (tutorialInvites ?? []).find((i) => i.trainee_id === trainee.id && i.stage === "stage1");
    const stage1TutorialConfirmed = stage1Invite ? Boolean(stage1Invite.confirmed_at) : null;
    const stage3Required = Boolean(celta5Record?.stage3_required);
    const stage3Done = Boolean(celta5Record?.stage3_finalized_at);
    const stage3Invite = (tutorialInvites ?? []).find((i) => i.trainee_id === trainee.id && i.stage === "stage3");
    const stage3TutorialConfirmed = stage3Invite ? Boolean(stage3Invite.confirmed_at) : null;
    const stage2MovedEarlierReason = celta5Record?.stage2_moved_earlier_reason ?? null;
    const stage2CanMoveEarlier = !celta5Record?.stage2_completed_at && !stage2MovedEarlierReason;
    const stage3MovedEarlierReason = celta5Record?.stage3_moved_earlier_reason ?? null;
    const stage3CanMoveEarlier = stage3Required && !stage3Done && !stage3MovedEarlierReason;

    const celta5SignoffStatus: Celta5SignoffStatus =
      celta5Record?.trainee_signoff_final_at && celta5Record?.trainer_signoff_final_at
        ? "both_signed"
        : celta5Record?.stage2_candidate_submitted_at
          ? "candidate_signed"
          : "not_started";

    const assignmentsTotal = standardAssignments.length;
    const assignmentsResubmitted = standardAssignments.some((a) => a.resubmission_submitted_at);

    const folEntriesLogged = folCountsByTrainee.get(trainee.id) ?? 0;
    const folEntriesLow = folAverage > 0 && folEntriesLogged < folAverage / 2;

    const obsTasksTotal = (obsTasks ?? []).length;
    const obsTasksDone = (obsTaskSubmissions ?? []).filter((s) => s.trainee_id === trainee.id).length;

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
      tpStagesTaught,
      tpStagesBehind,
      observationHoursCounted,
      observationHoursShort,
      stage1Filed,
      stage2BookedPosition,
      stage1TutorialConfirmed,
      stage2CanMoveEarlier,
      stage2MovedEarlierReason,
      stage3Required,
      stage3Done,
      stage3TutorialConfirmed,
      stage3CanMoveEarlier,
      stage3MovedEarlierReason,
      celta5SignoffStatus,
      assignmentsPassed,
      assignmentsTotal,
      assignmentsResubmitted,
      folEntriesLogged,
      folEntriesLow,
      obsTasksDone,
      obsTasksTotal,
    };
  });
}
