import "server-only";
import { responseIsAnswered } from "@/lib/pre-course-task-shape";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CourseStatus, Database } from "@/lib/supabase/types";
import { CELTA_CRITERIA_CODES, computeCriteriaPct, computeTrajectory, type Trajectory } from "@/lib/celta-criteria";
import { TP_LESSON_LENGTH_MINUTES } from "@/lib/tp-plan-content";
import { computeAtRiskReasons, type AtRiskReason } from "@/lib/at-risk";
import { toLocalIso, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";
import { getCachedCenter } from "@/lib/supabase/cached-queries";
import { computeObservationHours, OBSERVATION_HOURS_REQUIRED } from "@/lib/observation-hours";

export type Celta5SignoffStatus = "not_started" | "candidate_signed" | "both_signed";

export type AssignmentTileState = "passed" | "pending" | "resub_pending" | "failed" | "not_submitted";
export interface AssignmentTile {
  type: string;
  /** FoL · LRT · SRT · LfC -- Ramy, 5 Sep 2026: "we say SRT for skills". */
  short: string;
  state: AssignmentTileState;
}

const ASSIGNMENT_TILE_ORDER = ["Focus on Learner", "LRT", "Skills", "LfC"] as const;
const ASSIGNMENT_SHORT: Record<(typeof ASSIGNMENT_TILE_ORDER)[number], string> = {
  "Focus on Learner": "FoL",
  LRT: "LRT",
  Skills: "SRT",
  LfC: "LfC",
};

export interface RosterRow {
  id: string;
  name: string;
  email: string;
  // build-spec.md §18 -- "phone matters more than email for the real
  // cases." Never required at enrolment, so this is commonly null.
  phone: string | null;
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
  /**
   * Roster v2 (design_handoff_trainer_roster_v2): one tile per standard
   * assignment, in syllabus order, with the state a tutor cares about.
   * "resub_pending" = failed first submission, resubmission not yet in.
   */
  assignmentTiles: AssignmentTile[];
  /** Any assignment waiting on a resubmission -- the v2 "Resubmission" flag and summary tile. */
  resubmissionPending: boolean;
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
  // Ramy, 28 Aug 2026: "more important that it would appear on the roster
  // who finished it and who hasn't." The pre-course task is answered inside
  // Connect now, so who's done it is real data rather than something a
  // tutor finds out by asking on day one. Total is centre-wide (sections
  // hang off center_id, not course_id), so it's the same denominator for
  // every candidate here.
  preCourseTaskAnswered: number;
  preCourseTaskTotal: number;
  // Ramy, 29 Aug 2026: completing a filmed observation task notifies
  // nobody, deliberately -- five candidates times five recordings is
  // twenty-five emails about something with no deadline. A column answers
  // the question a tutor actually has ("who is behind?") at a glance,
  // which is how every other item on this roster already works.
  filmedObsDone: number;
  filmedObsTotal: number;
}

// Single source of truth for what a roster row means -- both the roster
// page and its CSV export call this, so the two can never disagree on a
// column's definition (checkpoint 2, per Ramy's build-spec.md).
type T = Database["public"]["Tables"];
/** What hub_roster_bundle() (migration 0273) returns: the same 24 datasets, same columns, one round trip. */
interface RosterBundle {
  trainees: Pick<T["profiles"]["Row"], "id" | "full_name" | "email" | "phone" | "course_status">[];
  stage2_blocks: { id: string }[];
  tutorial_invites: Pick<T["individual_tutorial_invites"]["Row"], "trainee_id" | "stage" | "confirmed_at">[];
  filmed_events: { id: string }[];
  filmed_sessions: { id: string }[];
  course: Pick<T["courses"]["Row"], "total_hours" | "center_id"> | null;
  taught_plans: Pick<T["plan_assignments"]["Row"], "trainee_id" | "tp_number">[];
  feedback: Pick<T["tp_feedback"]["Row"], "trainee_id" | "tp_number" | "grade" | "submitted_at" | "strengths_planning" | "strengths_teaching" | "action_points_planning" | "action_points_teaching">[];
  assignments: Pick<T["assignments"]["Row"], "trainee_id" | "assignment_type" | "first_status" | "resubmission_status" | "due_date" | "first_submitted_at" | "resubmission_submitted_at">[];
  celta5_records: Pick<T["celta5_records"]["Row"], "trainee_id" | "hours_attended" | "provisional_grade" | "provisional_grade_upper" | "stage1_completed_at" | "stage2_candidate_submitted_at" | "stage2_completed_at" | "stage2_moved_earlier_at" | "stage2_moved_earlier_reason" | "trainee_signoff_final_at" | "trainer_signoff_final_at" | "stage3_tutorial_required" | "stage3_finalized_at" | "stage3_moved_earlier_at" | "stage3_moved_earlier_reason">[];
  matrix: Pick<T["celta5_matrix"]["Row"], "trainee_id" | "criteria_code" | "tutor_status_stage2">[];
  supervised_events: { id: string }[];
  supervised_completions: Pick<T["supervised_session_completions"]["Row"], "timetable_event_id" | "trainee_id" | "submitted_at" | "time_spent_seconds">[];
  tp_plans: Pick<T["tp_plans"]["Row"], "trainee_id" | "tp_number" | "submitted_at">[];
  tp_self_evals: Pick<T["tp_self_evaluations"]["Row"], "trainee_id" | "tp_number" | "submitted_at">[];
  observations: Pick<T["observations"]["Row"], "trainee_id" | "filmed" | "length_minutes">[];
  stage2_slots: Pick<T["stage2_tutorial_slots"]["Row"], "position" | "trainee_id" | "booked_at">[];
  error_log: Pick<T["class_error_log"]["Row"], "logged_by_candidate_id">[];
  obs_tasks: { id: string }[];
  obs_task_submissions: Pick<T["observation_task_submissions"]["Row"], "trainee_id" | "task_id">[];
  pct_sections: { id: string; pre_course_task_items: { id: string }[] }[];
  pct_responses: Pick<T["pre_course_task_responses"]["Row"], "trainee_id" | "response">[];
  filmed_tasks: { id: string; session_id: string }[];
  filmed_responses: Pick<T["filmed_observation_task_responses"]["Row"], "trainee_id" | "task_id" | "completed_at">[];
}

export async function fetchRosterRows(
  supabase: SupabaseClient<Database>,
  courseId: string
): Promise<RosterRow[]> {
  // One round trip for everything below (migration 0273), with the
  // query-by-query path kept as the fallback until the function exists on
  // the database -- and as the readable definition of what the bundle
  // must return. Perf audit 5 Sep 2026: 20 tutors opening Roster in the
  // same second meant 20 x 26 calls; this makes it 20 x 1.
  const bundled = await supabase.rpc("hub_roster_bundle", { p_course_id: courseId });
  const B: RosterBundle | null = !bundled.error && bundled.data ? (bundled.data as unknown as RosterBundle) : null;
  // Wave 1: the roster, plus everything that needs only the course. Perf
  // audit 5 Sep 2026: this function ran 12 one-after-another waves; the
  // course-only lookups (stage 2 blocks, tutorial invites, filmed-obs
  // events and sessions, pre-course sections) waited behind the trainee
  // list for no reason. Three waves now.
  const [{ data: trainees }, { data: stage2Blocks }, { data: tutorialInvites }, { data: filmedObsEvents }, { data: filmedObsSessions }, { data: courseForCentre }] = B
    ? [{ data: B.trainees }, { data: B.stage2_blocks }, { data: B.tutorial_invites }, { data: B.filmed_events }, { data: B.filmed_sessions }, { data: B.course }]
    : await Promise.all([
      supabase.from("profiles").select("id, full_name, email, phone, course_status").eq("course_id", courseId).eq("role", "trainee").order("full_name"),
      // Stage 2 blocks are scoped by course first (stage2_tutorial_slots has
      // no course_id of its own -- it only reaches the course through its block).
      supabase.from("stage2_tutorial_blocks").select("id").eq("course_id", courseId),
      supabase.from("individual_tutorial_invites").select("trainee_id, stage, confirmed_at").eq("course_id", courseId),
      // Denominator is the course's scheduled filmed-observation slots, not
      // the sessions a trainer has set up -- a slot with no recording attached
      // is still one the candidate will owe.
      supabase.from("course_timetable_events").select("id").eq("course_id", courseId).eq("type", "milestone").ilike("title", "Filmed observation%"),
      supabase.from("filmed_observation_sessions").select("id").eq("course_id", courseId),
      supabase.from("courses").select("center_id").eq("id", courseId).maybeSingle(),
    ]);

  const traineeIds = (trainees ?? []).map((t) => t.id);
  const stage2BlockIds = (stage2Blocks ?? []).map((b) => b.id);

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
  ] = B
    ? [
        { data: B.taught_plans },
        { data: B.feedback },
        { data: B.assignments },
        { data: B.celta5_records },
        { data: B.matrix },
        { data: B.course },
        { data: B.supervised_events },
        { data: B.supervised_completions },
        { data: B.tp_plans },
        { data: B.tp_self_evals },
        { data: B.observations },
        { data: B.stage2_slots },
        { data: B.error_log },
        { data: B.obs_tasks },
        { data: B.obs_task_submissions },
      ]
    : traineeIds.length > 0
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
              "trainee_id, hours_attended, provisional_grade, provisional_grade_upper, stage1_completed_at, stage2_candidate_submitted_at, stage2_completed_at, stage2_moved_earlier_at, stage2_moved_earlier_reason, trainee_signoff_final_at, trainer_signoff_final_at, stage3_tutorial_required, stage3_finalized_at, stage3_moved_earlier_at, stage3_moved_earlier_reason"
            )
            .eq("course_id", courseId),
          supabase.from("celta5_matrix").select("trainee_id, criteria_code, tutor_status_stage2").eq("course_id", courseId),
          supabase.from("courses").select("total_hours, center_id").eq("id", courseId).maybeSingle(),
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
  const centerId = course?.center_id ?? courseForCentre?.center_id ?? null;

  // Wave 3: what needs wave 2's ids -- and the pre-course task, which lives
  // on the CENTRE (sections are seeded per centre and shared by every
  // course it runs, so the total is one number for the whole roster). The
  // sections come with their items in one embedded read.
  const centerPromise = centerId ? getCachedCenter(centerId) : Promise.resolve(null);
  const [center, { data: pctSectionsWithItems }, { data: pctResponses }, { data: filmedObsTasks }] = B
    ? await Promise.all([centerPromise, Promise.resolve({ data: B.pct_sections }), Promise.resolve({ data: B.pct_responses }), Promise.resolve({ data: B.filmed_tasks })])
    : await Promise.all([
        centerPromise,
        centerId && traineeIds.length > 0
          ? supabase.from("pre_course_task_sections").select("id, pre_course_task_items(id)").eq("center_id", centerId)
          : Promise.resolve({ data: [] as { id: string; pre_course_task_items: { id: string }[] }[] }),
        traineeIds.length > 0
          ? supabase.from("pre_course_task_responses").select("trainee_id, response").in("trainee_id", traineeIds)
          : Promise.resolve({ data: [] as { trainee_id: string; response: string }[] }),
        (filmedObsSessions ?? []).length > 0
          ? supabase.from("filmed_observation_tasks").select("id").in("session_id", (filmedObsSessions ?? []).map((x) => x.id))
          : Promise.resolve({ data: [] as { id: string }[] }),
      ]);
  const preCourseTaskTotal = (pctSectionsWithItems ?? []).reduce((n, sec) => n + (sec.pre_course_task_items?.length ?? 0), 0);
  // Shares responseIsAnswered with the task page itself, so the roster and
  // the candidate's own progress bar can never disagree about what counts
  // -- a structured task saves JSON, and an empty shell of one must not
  // read as answered.
  // Denominator is the course's scheduled filmed-observation slots, not the
  // sessions a trainer has set up -- a slot with no recording attached is
  // still one the candidate will owe, and counting only prepared sessions
  // would make the target shrink and grow as staff work through setup.
  const filmedObsTotal = (filmedObsEvents ?? []).length;
  const { data: filmedObsResponses } = B
    ? { data: B.filmed_responses }
    : (filmedObsTasks ?? []).length > 0 && traineeIds.length > 0
      ? await supabase
          .from("filmed_observation_task_responses")
          .select("trainee_id, task_id, completed_at")
          .in("trainee_id", traineeIds)
          .not("completed_at", "is", null)
      : { data: [] };
  const filmedObsTaskIds = new Set((filmedObsTasks ?? []).map((t) => t.id));
  const filmedObsDoneByTrainee = new Map<string, number>();
  for (const r of filmedObsResponses ?? []) {
    if (!filmedObsTaskIds.has(r.task_id)) continue;
    filmedObsDoneByTrainee.set(r.trainee_id, (filmedObsDoneByTrainee.get(r.trainee_id) ?? 0) + 1);
  }

  const preCourseAnsweredByTrainee = new Map<string, number>();
  for (const row of pctResponses ?? []) {
    if (!responseIsAnswered(row.response)) continue;
    preCourseAnsweredByTrainee.set(row.trainee_id, (preCourseAnsweredByTrainee.get(row.trainee_id) ?? 0) + 1);
  }
  const today = toLocalIso(new Date(), center?.time_zone ?? DEFAULT_TIMEZONE);

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
    const assignmentTiles: AssignmentTile[] = ASSIGNMENT_TILE_ORDER.flatMap((type) => {
      const a = standardAssignments.find((x) => x.assignment_type === type);
      if (!a) return [];
      const awaitingMark = (st: string) => st === "pending" || st === "submitted";
      const state: AssignmentTileState =
        a.first_status === "approved" || a.resubmission_status === "approved"
          ? "passed"
          : awaitingMark(a.first_status) || awaitingMark(a.resubmission_status)
            ? "pending"
            : a.first_status === "resubmission_required" && a.resubmission_status === "resubmission_required"
              ? "failed"
              : a.first_status === "resubmission_required"
                ? "resub_pending"
                : "not_submitted";
      return [{ type, short: ASSIGNMENT_SHORT[type], state }];
    });
    const resubmissionPending = assignmentTiles.some((t) => t.state === "resub_pending");

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
    const stage3Required = Boolean(celta5Record?.stage3_tutorial_required);
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
      email: trainee.email,
      phone: trainee.phone,
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
      assignmentTiles,
      resubmissionPending,
      assignmentsResubmitted,
      folEntriesLogged,
      folEntriesLow,
      obsTasksDone,
      obsTasksTotal,
      preCourseTaskAnswered: preCourseAnsweredByTrainee.get(trainee.id) ?? 0,
      preCourseTaskTotal,
      filmedObsDone: filmedObsDoneByTrainee.get(trainee.id) ?? 0,
      filmedObsTotal,
    };
  });
}
