import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAssessorCourseId, getPortfolioTrainee } from "@/lib/auth/portfolio-access";
import { getCachedCenter } from "@/lib/supabase/cached-queries";
import {
  CELTA_CRITERIA_SECTIONS,
  CRITERIA_LABELS,
  CRITERIA_GUIDANCE,
  CELTA_CRITERIA_CODES,
  computeCriteriaSuggestion,
  computeAttentionFlags,
  computeTrajectoryByDimension,
  computeStageFlagSuggestions,
  addTpFeedbackCriteriaTags,
} from "@/lib/celta-criteria";
import { TrajectoryGradientBars } from "@/components/trajectory-gradient-bar";
import { AssignmentsSummary, TpFeedbackSummary, AssessedTpStatsBadge } from "@/app/dashboard/trainer/trainees/[id]/celta5/linked-progress";
import { CriteriaRatingPill, StandardRatingPill } from "@/lib/status-pill";
import { computeProgressIssues, computeAssessedTpStats, computeAssessedHoursByMode, computeCurrentTpRound } from "@/lib/course-progress";
import { computeObservationHours, OBSERVATION_HOURS_REQUIRED } from "@/lib/observation-hours";
import { toLocalIso, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";
import { TP_LESSON_LENGTH_MINUTES } from "@/lib/tp-plan-content";
import { SelfAssessmentForm } from "@/app/dashboard/trainee/celta5/self-assessment-form";
import { ObservationForm } from "@/app/dashboard/trainee/celta5/observation-form";
import { ObservationTaskForm } from "@/app/portfolio/[traineeId]/celta5/observation-task-form";
import { FinalChecklistForm } from "@/app/dashboard/trainee/celta5/final-checklist-form";
import { signOffStage1, signOffStage2, signOffStage3 } from "@/app/dashboard/trainee/actions";
import { SetSignatureForm } from "@/components/set-signature-form";
import { Stage1Form } from "@/app/dashboard/trainer/trainees/[id]/celta5/stage1-form";
import { StageRatingsForm } from "@/app/dashboard/trainer/trainees/[id]/celta5/stage-ratings-form";
import { Stage2OverallForm } from "@/app/dashboard/trainer/trainees/[id]/celta5/stage2-overall-form";
import { Stage3OverallForm } from "@/app/dashboard/trainer/trainees/[id]/celta5/stage3-overall-form";
import { GradeReviewCommentsForm } from "@/app/dashboard/trainer/trainees/[id]/celta5/grade-review-comments-form";
import { FinalGradeForm } from "@/app/dashboard/trainer/trainees/[id]/celta5/final-grade-form";
import { AttendanceForm } from "@/app/dashboard/trainer/trainees/[id]/celta5/attendance-form";
import { AdminGrantForm } from "@/app/dashboard/trainer/trainees/[id]/celta5/admin-grant-form";
import { FinalizeRecordForm } from "@/app/dashboard/trainer/trainees/[id]/celta5/finalize-record-form";
import { ReleaseFinalReportForm } from "@/app/dashboard/trainer/trainees/[id]/celta5/release-final-report-form";
import { SignatureLedger } from "@/app/dashboard/trainer/trainees/[id]/celta5/signature-ledger";
import { AbsencePanel } from "@/app/portfolio/[traineeId]/celta5/absence-panel";
import { BookletSections } from "@/app/portfolio/[traineeId]/celta5/booklet-sections";
import { BookletSection } from "@/app/portfolio/[traineeId]/celta5/booklet/shell";
import { BookletContents } from "@/app/portfolio/[traineeId]/celta5/booklet/contents";
import { BookletCover } from "@/app/portfolio/[traineeId]/celta5/booklet/cover";
import { ProgressOverview } from "@/app/portfolio/[traineeId]/celta5/booklet/progress-overview";
import { AttendanceRecord, ObservationsRecord, AssessedTpRecord } from "@/app/portfolio/[traineeId]/celta5/booklet/records";
import { FinalDayChecks, type FinalCheck } from "@/app/portfolio/[traineeId]/celta5/booklet/final-day";
import { WrittenAssignmentsRecord } from "@/app/portfolio/[traineeId]/celta5/booklet/written-assignments";
import { CriteriaGrid, StageLocked, type CriterionRow, type Mark } from "@/app/portfolio/[traineeId]/celta5/booklet/criteria-grid";
import { Appendix1, Appendix2 } from "@/app/portfolio/[traineeId]/celta5/booklet/appendices";
import { computeSignatureLedger } from "@/lib/celta5-signatures";
import { computeStage3Triggers, stage3Expected, isStage3Mandatory, STAGE3_TRIGGER_LABELS } from "@/lib/stage3-triggers";
import { markScavengerHuntFound } from "@/lib/scavenger-hunt";

// CELTA 5's own wording for the overall-progress options (p.19, p.24).
// The booklet prints the sentence, not the enum, and "not recorded" is a
// truthful empty state -- a blank box reads as an oversight.
function overallLabel(v: string | null | undefined): string {
  if (v === "above_standard") return "Above standard for this stage of the course";
  if (v === "to_standard") return "To standard for this stage of the course";
  if (v === "not_to_standard") return "Not to standard for this stage and needs more work in order to pass the course";
  return "Not recorded yet";
}

function ReadOnlyField({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="mt-2">
      <p className="text-sm text-muted">{label}</p>
      <p className="text-ink">{value}</p>
    </div>
  );
}

// §9 -- CELTA5 record. Trainee viewers get the exact self-assessment ->
// gated-release -> sign-off flow from /dashboard/trainee/celta5 (same RPCs,
// which are already scoped to the calling user's own record so they work
// unchanged here). Staff viewers get the exact editable record from
// /dashboard/trainer/trainees/[id]/celta5 -- attendance, stage forms, the
// 41-code criteria matrix, trajectory, final grade -- keyed off :traineeId
// instead of the trainer route's :id. The criteria set/wording is the real,
// booklet-verified CELTA_CRITERIA_SECTIONS (41 codes, no 3c) -- not the shorter
// invented set shown in the design reference, per standing instruction that
// the real CELTA5 booklet always overrides the visual reference on this.
export default async function PortfolioCelta5Page({
  params,
  searchParams,
}: {
  params: Promise<{ traineeId: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { traineeId } = await params;
  const { preview } = await searchParams;
  const session = await getCurrentProfile();
  const viewer = session?.profile ?? null;
  // Raw role check for the access gate -- see the TP detail page's
  // identical comment for why this can't fold in previewAsTrainee.
  const isStaff = viewer?.role === "trainer" || viewer?.role === "admin";
  const assessorCourseId = !viewer ? await getAssessorCourseId() : null;
  if (!viewer && !assessorCourseId) notFound();
  if (viewer && !isStaff && viewer.id !== traineeId) notFound();

  // CELTA5 doesn't get the same previewAsTrainee treatment as the rest of
  // the portfolio tree: the trainee's real view is masked SERVER-SIDE by
  // get_my_celta5_record()'s auth.uid()-scoped RPC (migration 0034 --
  // final_recommended_grade/final_teaching_grade/final_assignments_grade/
  // overall_notes always null for a trainee, no exceptions). That RPC can't
  // be called "as" another user, and the staff/assessor branch below
  // genuinely does show the real grade (assessors are allowed to). Faking
  // a preview by reusing that branch would risk showing the real grade
  // inside something labelled "what the trainee sees" -- given "trainees
  // must NEVER see the real grade" is the single most repeated hard rule
  // in this project, an honest placeholder here is safer than a wrong
  // simulation.
  if (isStaff && preview === "trainee") {
    return (
      <div className="sheet p-6 text-sm text-muted">
        CELTA 5 preview isn&apos;t available here -- the trainee&apos;s grade fields are masked at the database
        level for their own session specifically, not just hidden in this page&apos;s markup, so staff can&apos;t
        safely simulate that exact view. To verify what a trainee sees on this record, check with their real
        account.
      </div>
    );
  }

  const supabase = assessorCourseId ? createAdminClient() : await createClient();

  if (!isStaff && !assessorCourseId) {
    // Scavenger hunt Q4 ("Where do you log an observation hour?") -- this
    // page is that place, so a real trainee landing here resolves it.
    if (viewer?.course_id) {
      await markScavengerHuntFound(supabase, viewer.course_id, traineeId, "observation_hour");
    }
    const [
      { data: recordRows },
      { data: matrix },
      { data: observations },
      { data: timetableEvents },
      { data: plans },
      { data: subgroupMember },
      { data: assignments },
      { data: course },
      { data: center },
      { data: courseTutorRows },
      { data: obsTasks },
      { data: obsTaskSubmissions },
      { data: tutorialInvites },
      { data: peerNotes },
      { data: tpLessons },
      { data: traineeAbsences },
    ] = await Promise.all([
      supabase.rpc("get_my_celta5_record"),
      supabase.rpc("get_my_celta5_matrix"),
      supabase.from("observations").select("*").eq("trainee_id", traineeId).order("observation_date"),
      viewer?.course_id
        ? supabase
            .from("course_timetable_events")
            .select("type, event_date, linked_tp_number, linked_assignment_type, title, mode")
            .eq("course_id", viewer.course_id)
            .in("type", ["tp", "assignment_due", "resubmission_due"])
        : Promise.resolve({ data: [] }),
      supabase.from("plan_assignments").select("tp_number, tp_point_id, taught_at").eq("trainee_id", traineeId),
      supabase.from("course_subgroup_members").select("subgroup_id").eq("trainee_id", traineeId).maybeSingle(),
      supabase
        .from("assignments")
        .select(
          "assignment_type, first_status, resubmission_status, final_grade, first_own_work_confirmed, resubmission_own_work_confirmed, first_outcome_signature_name, first_outcome_signed_at, resubmission_outcome_signature_name, resubmission_outcome_signed_at"
        )
        .eq("trainee_id", traineeId),
      viewer?.course_id
        ? supabase.from("courses").select("name, start_date, end_date, delivery_mode, total_hours, course_code").eq("id", viewer.course_id).maybeSingle()
        : Promise.resolve({ data: null }),
      viewer?.center_id
        ? supabase.from("centers").select("name, center_number, is_uk_centre, time_zone, stage3_for_all_candidates").eq("id", viewer.center_id).maybeSingle()
        : Promise.resolve({ data: null }),
      viewer?.course_id
        ? supabase.from("course_tutors").select("profile_id").eq("course_id", viewer.course_id).is("left_at", null)
        : Promise.resolve({ data: [] }),
      viewer?.course_id
        ? supabase.from("observation_tasks").select("id, title, instructions").eq("course_id", viewer.course_id).order("created_at")
        : Promise.resolve({ data: [] }),
      supabase.from("observation_task_submissions").select("task_id, response, submitted_at").eq("trainee_id", traineeId),
      supabase.from("individual_tutorial_invites").select("stage, timetable_event_id, confirmed_at").eq("trainee_id", traineeId),
      supabase.from("peer_observation_notes").select("sheet_id, submitted_at").eq("observer_id", traineeId).not("submitted_at", "is", null),
      // Same source the PDF replica reads for this table (see
      // api/portfolio/[traineeId]/celta5/replica/route.ts). The booklet on
      // screen and the booklet Cambridge receives must not be able to
      // disagree about what was taught, so both read tp_lessons rather than
      // one reading the plan and the other the lesson record.
      supabase
        .from("tp_lessons")
        .select("lesson_date, length_minutes, level, learner_count, lesson_focus, tutor_assessment, trainer_id")
        .eq("trainee_id", traineeId)
        .order("lesson_date"),
      // Section 5 of the booklet. This branch never fetched absences before
      // because the old page had no attendance section at all -- the record
      // Cambridge prints was simply missing from the candidate's own view.
      supabase.from("attendance_absences").select("*").eq("trainee_id", traineeId).order("session_date"),
    ]);
    const record = recordRows?.[0];
    const submissionByTaskId = new Map((obsTaskSubmissions ?? []).map((s) => [s.task_id, s]));

    if (!record) {
      return <div className="sheet p-6 text-sm text-muted">No CELTA 5 record found yet. Check with your trainer.</div>;
    }

    const taughtAssignments = (plans ?? []).filter((p) => p.taught_at);
    const tpPointIds = [...new Set(taughtAssignments.map((p) => p.tp_point_id).filter((id): id is string => !!id))];
    const { data: tpPointsForLevels } =
      tpPointIds.length > 0
        ? await supabase.from("tp_points").select("id, tp_coursebook_id").in("id", tpPointIds)
        : { data: [] };
    const coursebookIds = [...new Set((tpPointsForLevels ?? []).map((p) => p.tp_coursebook_id))];
    const { data: coursebooksForLevels } =
      coursebookIds.length > 0
        ? await supabase.from("tp_coursebooks").select("id, level").in("id", coursebookIds)
        : { data: [] };
    const assessedTpStats = computeAssessedTpStats({
      taughtAssignments,
      tpPointCoursebookById: new Map((tpPointsForLevels ?? []).map((p) => [p.id, p.tp_coursebook_id])),
      coursebookLevelById: new Map((coursebooksForLevels ?? []).map((c) => [c.id, c.level])),
    });

    // course-modes.md §2 (Handbook 9.1.2) -- mixed-mode only.
    const { data: subgroupForMode } = subgroupMember?.subgroup_id
      ? await supabase.from("course_subgroups").select("half_order").eq("id", subgroupMember.subgroup_id).maybeSingle()
      : { data: null };
    const assessedHoursByMode =
      course?.delivery_mode === "mixed"
        ? computeAssessedHoursByMode({
            taughtAssignments,
            halfOrder: subgroupForMode?.half_order === 1 || subgroupForMode?.half_order === 2 ? subgroupForMode.half_order : null,
            tpEvents: (timetableEvents ?? []).filter((e) => e.type === "tp"),
          })
        : null;

    const byCode = new Map((matrix ?? []).map((m) => [m.criteria_code, m]));
    const candidateRatedCount = CELTA_CRITERIA_CODES.filter((c) => byCode.get(c)?.candidate_status).length;
    const tutorRatedCount = CELTA_CRITERIA_CODES.filter((c) => byCode.get(c)?.tutor_status_stage2).length;
    const stage2Submitted = !!record.stage2_candidate_submitted_at;
    const stage1And2Released = !!record.stage2_completed_at;
    const finalReleased = !!record.trainer_signoff_final_at;
    // "Both signed" specifically means the candidate's own final sign-off
    // (trainee_signoff_stage2_at, set by signOffStage2 below), not just the
    // tutor's release of the matrix -- release makes the sign-off button
    // available, it isn't the signature itself.
    const bothSigned = !!record.trainee_signoff_stage2_at;

    const taughtTpNumbers = new Set((plans ?? []).filter((p) => p.taught_at).map((p) => p.tp_number));
    const assignmentStatusByType = new Map((assignments ?? []).map((a) => [a.assignment_type, a]));
    // Ramy, 28 Aug 2026: "the logic behind everything" -- was the server's
    // UTC date; currentTpRound below already reads the centre's real
    // time_zone the correct way, this call was just missed.
    const progressIssues = computeProgressIssues({
      today: toLocalIso(new Date(), center?.time_zone ?? DEFAULT_TIMEZONE),
      timetableEvents: timetableEvents ?? [],
      taughtTpNumbers,
      assignmentStatusByType,
      halfOrder: subgroupForMode?.half_order === 1 || subgroupForMode?.half_order === 2 ? subgroupForMode.half_order : null,
    });

    const tutorIds = (courseTutorRows ?? []).map((t) => t.profile_id);
    const { data: tutorProfiles } =
      tutorIds.length > 0 ? await supabase.from("profiles").select("id, full_name").in("id", tutorIds) : { data: [] };
    const tutorNames = (tutorProfiles ?? []).map((t) => t.full_name);

    // design_handoff_progress_tab, screen 1g -- three glanceable panels
    // (Stage 1/2/3, self-assessment, observation hours) above the detailed
    // record below, which stays as the drill-down. Stage 2 slot and Stage
    // 1/3 invites are fetched here rather than in the main Promise.all
    // since they depend on viewer.course_id being resolved first, same
    // pattern as tpPointsForLevels above.
    const [{ data: stage2Blocks }, { data: tutorialEvents }] = await Promise.all([
      viewer?.course_id ? supabase.from("stage2_tutorial_blocks").select("id").eq("course_id", viewer.course_id) : Promise.resolve({ data: [] }),
      tutorialInvites && tutorialInvites.length > 0
        ? supabase
            .from("course_timetable_events")
            .select("id, event_date, event_time")
            .in("id", tutorialInvites.map((i) => i.timetable_event_id))
        : Promise.resolve({ data: [] }),
    ]);
    const stage2BlockIds = (stage2Blocks ?? []).map((b) => b.id);
    const { data: myStage2Slot } =
      stage2BlockIds.length > 0
        ? await supabase.from("stage2_tutorial_slots").select("position, booked_at").in("block_id", stage2BlockIds).eq("trainee_id", traineeId).not("booked_at", "is", null).maybeSingle()
        : { data: null };
    const tutorialEventById = new Map((tutorialEvents ?? []).map((e) => [e.id, e]));
    const stage1Invite = (tutorialInvites ?? []).find((i) => i.stage === "stage1");
    const stage3Invite = (tutorialInvites ?? []).find((i) => i.stage === "stage3");

    // Peer observation has no duration field of its own (peer_observation_
    // notes is a written-note model, not an hours-logged model) -- each
    // submitted note represents one full TP round observed, so hours are
    // derived from the real TP length rather than fabricated.
    const peerSheetsObserved = new Set((peerNotes ?? []).map((n) => n.sheet_id)).size;
    const peerHours = (peerSheetsObserved * TP_LESSON_LENGTH_MINUTES) / 60;
    // Ramy, 28 Aug 2026: "the logic behind everything" -- was liveHours,
    // which silently dropped filmed hours from the figure compared against
    // the 6h requirement (same bug as the standalone Progress tab's card).
    const { hoursCounted: experiencedTeacherHours, filmedHours } = computeObservationHours(observations ?? []);


    // Decorative teal/garnet alternation down this long vertical stack of
    // plain sheets -- no status meaning of its own, same rule as everywhere
    // else. "Course progress" just below stays plain teal (index 0); this
    // counter starts at 1 and is called, in render order, only for each
    // sheet that actually renders, so it still alternates correctly across
    // this section's many mutually-exclusive branches.
    let sheetCounter = 1;
    const nextSheetGarnet = () => sheetCounter++ % 2 === 1;

    // ---- Booklet figures -------------------------------------------------
    // Everything below feeds the document-shaped view built from Ramy's
    // design file (see booklet/shell.tsx). All of it is derived from the
    // same queries the rest of this page already runs -- nothing here is a
    // second source of truth for a number shown elsewhere.
    const totalCourseHours = course?.total_hours ?? null;
    const attendancePct =
      totalCourseHours && record.hours_attended != null
        ? Math.round((record.hours_attended / totalCourseHours) * 100)
        : null;
    const assignmentsGraded = (assignments ?? []).filter(
      (a) => a.first_status === "approved" || a.resubmission_status === "approved" || a.first_status === "resubmission_required"
    ).length;
    const assignmentsPassed = (assignments ?? []).filter(
      (a) => a.first_status === "approved" || a.resubmission_status === "approved"
    ).length;
    const observationRows = (observations ?? []).map((o) => ({
      date: o.observation_date ?? "",
      minutes: o.length_minutes,
      level: o.level ?? "",
      learners: o.learners_present,
      focus: o.lesson_focus ?? "",
      kind: o.filmed ? "Filmed" : "Experienced teacher",
    }));
    const TP_HOURS_REQUIRED = 6;
    const assessedTpHours = assessedTpStats.hoursAssessed;
    const bookletCards = [
      {
        label: "Attendance",
        value: attendancePct != null ? `${attendancePct}%` : "—",
        detail: `${record.hours_attended ?? 0} / ${totalCourseHours ?? "—"} hours attended`,
        state: (attendancePct != null && attendancePct >= 100 ? "met" : "neutral") as "met" | "short" | "neutral",
      },
      {
        label: "Observation hours",
        value: `${experiencedTeacherHours.toFixed(2)} / ${OBSERVATION_HOURS_REQUIRED.toFixed(2)}`,
        detail: `filmed capped at 3 of the ${OBSERVATION_HOURS_REQUIRED} hrs`,
        state: (experiencedTeacherHours >= OBSERVATION_HOURS_REQUIRED ? "met" : "short") as "met" | "short" | "neutral",
      },
      {
        label: "Assessed TP hours",
        value: `${assessedTpHours.toFixed(2)} / ${TP_HOURS_REQUIRED.toFixed(2)}`,
        detail: "at two levels required",
        state: (assessedTpHours >= TP_HOURS_REQUIRED ? "met" : "short") as "met" | "short" | "neutral",
      },
      {
        label: "Written assignments",
        value: `${assignmentsGraded} / 4 graded`,
        detail: `${assignmentsPassed} passed \u00b7 ${Math.max(0, 4 - assignmentsGraded)} pending`,
        state: (assignmentsGraded >= 4 ? "met" : "short") as "met" | "short" | "neutral",
      },
    ];
    // Assessed TP rows. Date and level come from the taught plan; length is
    // the course's real TP length. Lesson focus, tutor assessment and tutor
    // initials are columns the TUTOR fills on the Cambridge form -- they are
    // left blank here rather than invented, so a partly-filled row reads as
    // exactly that to an assessor.
    const tutorAssessmentLabel = (r: string | null) =>
      r === "above_standard" ? "Above standard" : r === "to_standard" ? "To standard" : r === "not_to_standard" ? "Below standard" : "";
    const assessedTpRows = (tpLessons ?? []).map((l) => ({
      date: l.lesson_date ?? "",
      length: l.length_minutes != null ? `${l.length_minutes}` : "",
      level: l.level ?? "",
      learners: l.learner_count != null ? `${l.learner_count}` : "",
      focus: l.lesson_focus ?? "",
      assessment: tutorAssessmentLabel(l.tutor_assessment),
      initials: "",
    }));

    // Written assignments. The result is derived from the recorded
    // statuses rather than re-entered, and the signature shown is the one
    // the candidate actually gave for the round that was decided -- the
    // same rule the PDF now follows, so the two cannot disagree.
    // Cambridge prints the four in this order on the form; these are the
    // real assignment_type values, not display labels.
    // Cambridge prints these four titles verbatim on p.12, in this order.
    // The app's own ASSIGNMENT_INFO labels differ -- "Language Skills
    // Related Tasks" against Cambridge's "Skills assignment", and title
    // case against sentence case -- and on this page it is Cambridge's
    // wording that has to appear, since an assessor reads it as their form.
    const ASSIGNMENT_ORDER = [
      { type: "Focus on Learner", title: "Focus on the learner" },
      { type: "LRT", title: "Language related tasks" },
      { type: "Skills", title: "Skills assignment" },
      { type: "LfC", title: "Lessons from the classroom" },
    ] as const;
    const assignmentByType = new Map((assignments ?? []).map((a) => [a.assignment_type, a]));
    const writtenAssignmentRows = ASSIGNMENT_ORDER.map(({ type, title }) => {
      const a = assignmentByType.get(type);
      const onResubmission = !!a && a.resubmission_status !== "not_submitted";
      const result = !a
        ? "— not yet submitted"
        : a.resubmission_status === "approved"
          ? "Pass 2nd submission"
          : a.first_status === "approved"
            ? "Pass 1st submission"
            : a.final_grade === "Fail"
              ? "Fail"
              : a.first_status === "resubmission_required"
                ? "Resubmission required"
                : "— not yet graded";
      return {
        title,
        result,
        signatureName: onResubmission
          ? a?.resubmission_outcome_signature_name ?? null
          : a?.first_outcome_signature_name ?? null,
        signedAt: onResubmission ? a?.resubmission_outcome_signed_at ?? null : a?.first_outcome_signed_at ?? null,
      };
    });

    // Criteria rows for the Stage Two / Stage Three grids. Topic bands are
    // printed on the first row of each section, the way the form does it.
    const toMark = (v: string | null | undefined): Mark =>
      v === "S+" || v === "S" || v === "N" || v === "X" ? v : null;
    const buildCriteriaRows = (which: "stage2" | "stage3"): CriterionRow[] =>
      CELTA_CRITERIA_SECTIONS.flatMap((sec) =>
        sec.codes.map((code, i) => {
          const m = byCode.get(code);
          return {
            code,
            text: CRITERIA_LABELS[code] ?? code,
            topic: i === 0 ? `TOPIC ${sec.section} – ${sec.title.toUpperCase()}` : undefined,
            candidate: which === "stage2" ? toMark(m?.candidate_status) : null,
            tutor: toMark(which === "stage2" ? m?.tutor_status_stage2 : m?.tutor_status_stage3),
          };
        })
      );
    const stage2Rows = buildCriteriaRows("stage2");
    const stage3Rows = buildCriteriaRows("stage3");

    // Handbook 10.2 / CELTA 5 p.20 -- who must be given Stage Three.
    // "Not making the expected progress" is read from TPs taught after the
    // Stage 2 tutorial; assessedTpOutcomes below is ordered by teaching
    // date, so anything after the tutorial date is the second half.
    const stage2TutorialDate = record.stage2_completed_at ?? null;
    const postStage2TpOutcomes = (plans ?? [])
      .filter((p) => p.taught_at && (!stage2TutorialDate || p.taught_at > stage2TutorialDate))
      .map(() => null as null);
    const stage3Triggers = computeStage3Triggers({
      stage2TutorOverall: record.stage2_tutor_overall ?? null,
      postStage2TpOutcomes,
      higherGradeIndicated: false,
      centreGivesStage3ToAll: center?.stage3_for_all_candidates ?? false,
    });
    const stage3IsExpected = stage3Expected(stage3Triggers) || record.stage3_tutorial_required;
    const stage3TriggerReason = isStage3Mandatory(stage3Triggers)
      ? STAGE3_TRIGGER_LABELS[stage3Triggers.find((t) => t !== "centre_gives_to_all")!]
      : stage3Triggers.length > 0
        ? STAGE3_TRIGGER_LABELS.centre_gives_to_all
        : undefined;

    const fmtCoverDate = (iso: string | null | undefined) =>
      iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : null;
    const coverData = {
      candidateName: viewer?.full_name ?? null,
      centreName: center?.name ?? null,
      centreNumber: center?.center_number ?? null,
      courseNumber: course?.course_code ?? null,
      courseDates:
        course?.start_date && course?.end_date
          ? `${fmtCoverDate(course.start_date)} \u2013 ${fmtCoverDate(course.end_date)}`
          : null,
      tutors: tutorNames,
      uln: viewer?.uln ?? null,
    };

    // CELTA 5 p.25, verbatim. Ramy, 29 Aug 2026: "fix section twelve...
    // make sure the wording matches what's in here" -- the app had
    // substituted "Stage Two progress record complete" and "Stage Three
    // progress record" for Cambridge's last two confirmations, which
    // dropped two statements the form actually asks a candidate to make
    // and added two it doesn't. Cambridge's five, in Cambridge's order:
    const ownWorkAllConfirmed =
      (assignments ?? []).length > 0 &&
      (assignments ?? []).every((a) =>
        a.resubmission_status !== "not_submitted" ? a.resubmission_own_work_confirmed : a.first_own_work_confirmed
      );
    // "All records" means the records this booklet is made of: attendance,
    // observations, assessed TP and the written assignments table.
    const allRecordsComplete =
      observationRows.length > 0 && assessedTpRows.length > 0 && assignmentsGraded >= 4;
    const finalChecks: FinalCheck[] = [
      {
        label: "I have completed six hours of assessed teaching practice at at least two levels.",
        met: assessedTpHours >= TP_HOURS_REQUIRED && assessedTpStats.levels.length >= 2,
        detail: `${assessedTpHours.toFixed(2)} of ${TP_HOURS_REQUIRED.toFixed(2)} hrs`,
      },
      {
        label: "I have completed six hours of observation of experienced teachers.",
        met: experiencedTeacherHours >= OBSERVATION_HOURS_REQUIRED,
        detail: `${experiencedTeacherHours.toFixed(2)} of ${OBSERVATION_HOURS_REQUIRED.toFixed(2)} hrs`,
      },
      {
        label: "I have completed four written assignments.",
        met: assignmentsGraded >= 4,
        detail: `${assignmentsGraded} / 4 graded`,
      },
      {
        label: "The written assignments are my own work.",
        met: ownWorkAllConfirmed,
        detail: ownWorkAllConfirmed ? undefined : "declared on each assignment when you submit it",
      },
      {
        label: "I have completed all records.",
        met: allRecordsComplete,
        detail: allRecordsComplete ? undefined : "attendance, observations, teaching practice and assignments",
      },
    ];

    return (
      <div className="flex flex-col gap-4">
      {/* Ramy, 30 Aug 2026: "the parts on top, on top of the Cambridge logo
          -- that part actually doesn't belong in the CELTA 5."
          
          He is right, and it was worse than clutter: this block printed the
          candidate, centre, course, dates and tutors immediately above a
          Cambridge cover page that prints the same five things itself. The
          booklet opens on the cover now, with nothing of Connect's in front
          of it. (I first read this as "remove the cover fields" and took out
          the wrong half -- they are the real form's own fields and are
          back.) */}
        {/* ONE booklet, in Cambridge's order. Ramy, 29 Aug 2026: the first
            cut rendered the new booklet ABOVE the old progress page instead
            of replacing it, so Stage Two appeared twice and the static
            sections sat out of order below everything. The forms a candidate
            actually uses now live inside the section they belong to, and
            every box the paper form prints -- including the tutorial
            summaries -- has a place here whether it is filled or not. */}
        <div className="c5-doc">
          {/* His file's order: cover, then contents, then the overview.
              The app opened on the overview and had no cover at all. */}
          {/* Ramy, 30 Aug 2026: "the third page is roles and responsibilities,
              and this page should read page number one." Cover, contents and
              the progress overview are front matter: they break a page but
              take no number, so Section 1 is page 1, exactly as the printed
              booklet has it. The overview is Connect's own addition rather
              than part of the Cambridge document -- and he asked for it back
              when an earlier rebuild dropped it -- so it stays where a
              candidate expects it, just outside the numbering. */}
          <BookletSection frontMatter>
            <BookletCover data={coverData} />
          </BookletSection>

          <BookletSection title="Contents" frontMatter>
            <BookletContents />
          </BookletSection>

          <BookletSection title="Progress overview" frontMatter>
            <ProgressOverview cards={bookletCards} />

            {/* Where each stage has got to. Removed when this page was
                rebuilt as the booklet, and Ramy noticed: "we had those
                progress cards in the CELTA 5. I think they're gone now."
                The cards above are pulled TOTALS; this is a different
                question -- released, booked, signed, pending -- and it is
                the one a candidate actually asks. Kept on this page so the
                booklet stays one document. */}
            <div className="c5-box" style={{ marginTop: 16 }}>
              <span className="lab">Stage 1 / 2 / 3</span>
              <div className="flex flex-col">
                <div className="flex items-start justify-between gap-3 border-b border-border-faint py-2">
                  <div>
                    <p className="text-[11px] font-semibold text-ink">Stage 1 report</p>
                    <p className="mt-0.5 text-[10px] text-muted">
                      {record.stage1_released_at
                        ? "Filed by your tutor · the tutorial itself is optional, not held up on this"
                        : stage1Invite
                          ? `Tutorial ${stage1Invite.confirmed_at ? "confirmed" : "invited, not yet confirmed"}${
                              tutorialEventById.get(stage1Invite.timetable_event_id)
                                ? ` · ${tutorialEventById.get(stage1Invite.timetable_event_id)!.event_date}`
                                : ""
                            } -- the report itself isn't filed yet`
                          : "Not yet filed"}
                    </p>
                  </div>
                  <span className={`pill ${record.stage1_released_at ? "pill-success" : "pill-warning"}`}>
                    {record.stage1_released_at ? "Filed" : "Not filed"}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3 border-b border-border-faint py-2">
                  <div>
                    <p className="text-[11px] font-semibold text-ink">Stage 2 tutorial</p>
                    <p className="mt-0.5 text-[10px] text-muted">
                      {myStage2Slot
                        ? `You booked ${myStage2Slot.position === 1 ? "1st" : myStage2Slot.position === 2 ? "2nd" : myStage2Slot.position === 3 ? "3rd" : `${myStage2Slot.position}th`}`
                        : "Book your slot from the timetable"}
                    </p>
                  </div>
                  <span className={`pill ${myStage2Slot ? "pill-success" : "pill-warning"}`}>
                    {myStage2Slot ? "Booked" : "Not booked"}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3 py-2">
                  <div>
                    <p className="text-[11px] font-semibold text-ink">Stage 3 report</p>
                    <p className="mt-0.5 text-[10px] text-muted">
                      {stage3IsExpected
                        ? record.stage3_finalized_at
                          ? "Filed by your tutor"
                          : stage3Invite
                            ? `Tutorial ${stage3Invite.confirmed_at ? "confirmed" : "invited, not yet confirmed"}${
                                tutorialEventById.get(stage3Invite.timetable_event_id)
                                  ? ` · ${tutorialEventById.get(stage3Invite.timetable_event_id)!.event_date}`
                                  : ""
                              }`
                            : stage3TriggerReason ?? "Expected -- not yet filed"
                        : "Only filed if triggered -- not to standard at Stage 2, or not making the expected progress in the second half"}
                    </p>
                  </div>
                  <span
                    className={`pill ${
                      !stage3IsExpected ? "pill-neutral" : record.stage3_finalized_at ? "pill-success" : "pill-warning"
                    }`}
                  >
                    {!stage3IsExpected ? "N/A so far" : record.stage3_finalized_at ? "Filed" : "Pending"}
                  </span>
                </div>
              </div>
            </div>

            <div className="c5-box" style={{ marginTop: 12 }}>
              <span className="lab">CELTA 5 self-assessment</span>
              <p className="text-[11px] text-ink">
                {bothSigned
                  ? "Signed off — you and your tutor have both signed."
                  : stage2Submitted
                    ? "Submitted — waiting on your tutor's column and the tutorial."
                    : `Not started — ${candidateRatedCount} of ${CELTA_CRITERIA_CODES.length} criteria rated.`}
              </p>
            </div>
          </BookletSection>

          <BookletSections
            portfolioConfirmedAt={record.portfolio_terms_confirmed_at}
            portfolioSignatureName={record.portfolio_terms_signature_name}
            appealsConfirmedAt={record.appeals_read_confirmed_at}
            appealsSignatureName={record.appeals_read_signature_name}
            canSign={!isStaff && !assessorCourseId && viewer?.id === traineeId}
            fullName={viewer?.full_name ?? null}
          />

          <BookletSection id="c5-attendance" title="Record of attendance">
            <AttendanceRecord
              courseHours={course?.total_hours ?? null}
              hoursAttended={record.hours_attended}
              unavoidable={(traineeAbsences ?? [])
                .filter((a) => a.category === "unavoidable")
                .map((a) => ({
                  date: a.session_date ?? "",
                  session: a.session_missed ?? "",
                  reason: a.reason ?? "",
                  madeUp: a.work_made_up ?? "",
                  tutor: a.tutor_signature_name ?? "",
                }))}
              other={(traineeAbsences ?? [])
                .filter((a) => a.category === "other")
                .map((a) => ({
                  date: a.session_date ?? "",
                  session: a.session_missed ?? "",
                  reason: a.reason ?? "",
                  madeUp: a.work_made_up ?? "",
                  candidate: a.candidate_comment ?? "",
                  tutor: [a.tutor_comment, a.tutor_signature_name].filter(Boolean).join(" · "),
                }))}
            />
            <div className="mt-4">
              <AbsencePanel
                variant="booklet"
                absences={traineeAbsences ?? []}
                hoursAttended={record.hours_attended}
                totalHours={course?.total_hours ?? 120}
              />
            </div>
          </BookletSection>

          <BookletSection
            id="c5-observations"
            title="Record of observations of experienced classroom teachers (including filmed observations)"
          >
            <ObservationsRecord rows={observationRows} />
            {(obsTasks ?? []).length > 0 ? (
              <div className="mt-4">
                <p className="text-[11px] font-bold text-ink">Observation tasks</p>
                <div className="mt-2 flex flex-col gap-3">
                  {(obsTasks ?? []).map((task) => {
                    const submission = submissionByTaskId.get(task.id);
                    return (
                      <div key={task.id} className="c5-box">
                        <p className="text-[11px] font-bold text-ink">{task.title}</p>
                        {task.instructions ? <p className="mt-1 text-[10px] text-muted">{task.instructions}</p> : null}
                        {submission?.submitted_at ? (
                          <p className="mt-2 text-[10px] text-muted">
                            Submitted {new Date(submission.submitted_at).toLocaleDateString("en-GB")}.
                          </p>
                        ) : (
                          <div className="mt-2">
                            <ObservationTaskForm taskId={task.id} deliveryMode={course?.delivery_mode ?? undefined} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <div className="mt-4">
              <p className="text-[11px] font-bold text-ink">Log an observation</p>
              <div className="mt-2 flex flex-col gap-3">
                {observations?.map((o) => (
                  <ObservationForm key={`${o.id}-${o.updated_at}`} observation={o} deliveryMode={course?.delivery_mode ?? undefined} />
                ))}
                <ObservationForm deliveryMode={course?.delivery_mode ?? undefined} />
              </div>
            </div>
          </BookletSection>

          <BookletSection id="c5-tp" title="Record of assessed teaching practice">
            <AssessedTpRecord rows={assessedTpRows} />
          </BookletSection>

          <BookletSection id="c5-assignments" title="Record of written assignments">
            <WrittenAssignmentsRecord rows={writtenAssignmentRows} />
          </BookletSection>

          <BookletSection id="c5-stage1" num="Section 9" title="Stage One progress record">
            <p className="text-[10px] leading-relaxed text-muted" style={{ marginBottom: 10 }}>
              This form will be completed by your tutor in the first third of the course. Some centres may hold a
              tutorial with you at the same time, but this is not obligatory. Having read and agreed with the summary,
              sign and date the report.
            </p>
            {record.stage1_released_at ? (
              <>
                <div className="c5-box" style={{ marginBottom: 10 }}>
                  <span className="lab">Strengths</span>
                  <p className="text-[11px] leading-relaxed text-ink">{record.stage1_strengths || "—"}</p>
                </div>
                <div className="c5-box" style={{ marginBottom: 10 }}>
                  <span className="lab">Action plan for next stage of the course</span>
                  <p className="text-[11px] leading-relaxed text-ink">{record.stage1_action_plan || "—"}</p>
                </div>
                <p className="text-[11px]">
                  <span className="text-muted">Tutor&rsquo;s signature:</span>{" "}
                  <strong className="text-ink">{record.stage1_tutor_signature_name ?? "—"}</strong>
                </p>
                <div className="mt-3 border-t border-border-faint pt-3">
                  {record.stage1_candidate_signed_at ? (
                    <p className="text-[11px] text-muted">
                      Signed by {record.stage1_candidate_signature_name} on{" "}
                      {new Date(record.stage1_candidate_signed_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.
                    </p>
                  ) : !viewer?.signature_name ? (
                    <SetSignatureForm fullName={viewer?.full_name ?? ""} />
                  ) : (
                    <form action={signOffStage1}>
                      <p className="mb-2 text-[11px] text-ink">I have read and agree with the summarising comments above.</p>
                      <button type="submit" className="c5-btn">Sign as {viewer.signature_name}</button>
                    </form>
                  )}
                </div>
              </>
            ) : (
              <StageLocked>
                Not released yet. Your tutor is preparing your Stage One record from your TP feedback so far &mdash;
                you&rsquo;ll be notified and asked to sign once it&rsquo;s ready.
              </StageLocked>
            )}
          </BookletSection>

          <BookletSection
            id="c5-stage2"
            num={`Section 10${record.stage2_hours_taught != null ? ` · Hours taught: ${record.stage2_hours_taught}` : ""}`}
            title="Stage Two progress record"
          >
            <p className="text-[10px] leading-relaxed text-muted" style={{ marginBottom: 10 }}>
              With this record, a tutor will conduct a one-to-one tutorial with you. In the column marked
              &lsquo;You&rsquo;, indicate the extent to which you feel you have demonstrated each of the criteria at
              this stage: &lsquo;S+&rsquo; above the standard, &lsquo;S&rsquo; meets the standard, &lsquo;N&rsquo; not
              to standard, &lsquo;X&rsquo; not applicable at this stage.
            </p>
            {/* One list of criteria, not two. Ramy, 29 Aug 2026: "this looks
                like there are two stage two self assessment." It did --
                SelfAssessmentForm already renders all 41 criteria with its
                own controls, and the grid below it was rendering them
                again. They do different jobs at different moments, so the
                page shows whichever one applies: the editable form until
                the candidate submits, the You/Tutor grid afterwards. */}
            {stage2Submitted ? (
              <CriteriaGrid
                stage="stage2"
                rows={stage2Rows}
                showCandidateColumn
                candidateEditable={false}
                tutorLocked={!stage1And2Released}
                tutorLockedLabel="Hidden until your tutorial"
              />
            ) : (
              <SelfAssessmentForm />
            )}

            {/* The boxes the paper form prints. Cambridge asks for the
                candidate's issues and the tutor's beside them, then the two
                overall assessments, then the tutorial summary. Each renders
                whether or not it is filled -- an assessor reading this needs
                to see the box exists and is empty, not to wonder whether the
                screen simply omits it. */}
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="c5-box">
                <span className="lab">Written assignments &mdash; you</span>
                <p className="text-[11px] leading-relaxed text-ink">{record.stage2_candidate_written_assignments_notes || "—"}</p>
              </div>
              <div className="c5-box">
                <span className="lab">Written assignments &mdash; tutor</span>
                {stage2Submitted ? (
                  <p className="text-[11px] leading-relaxed text-ink">{record.stage2_tutor_written_assignments_notes || "—"}</p>
                ) : (
                  <p className="text-[10px] italic text-muted">Hidden until you submit your self-assessment.</p>
                )}
              </div>
              <div className="c5-box">
                <span className="lab">Other issues &mdash; you</span>
                <p className="text-[11px] leading-relaxed text-ink">{record.stage2_candidate_other_notes || "—"}</p>
              </div>
              <div className="c5-box">
                <span className="lab">Other issues &mdash; tutor</span>
                {stage2Submitted ? (
                  <p className="text-[11px] leading-relaxed text-ink">{record.stage2_tutor_other_notes || "—"}</p>
                ) : (
                  <p className="text-[10px] italic text-muted">Hidden until you submit your self-assessment.</p>
                )}
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-3">
              <div className="c5-box">
                <span className="lab">Overall progress &mdash; candidate&rsquo;s assessment</span>
                <p className="text-[11px] text-ink">{overallLabel(record.stage2_candidate_overall)}</p>
                {record.stage2_candidate_notes ? (
                  <p className="mt-1 text-[11px] leading-relaxed text-muted">{record.stage2_candidate_notes}</p>
                ) : null}
              </div>
              <div className="c5-box">
                <span className="lab">Overall progress &mdash; tutor&rsquo;s assessment</span>
                {stage1And2Released ? (
                  <p className="text-[11px] text-ink">{overallLabel(record.stage2_tutor_overall)}</p>
                ) : (
                  <p className="text-[10px] italic text-muted">Released after your tutorial.</p>
                )}
              </div>
              <div className="c5-box">
                <span className="lab">Summary of tutorial and action points</span>
                {stage1And2Released ? (
                  <p className="text-[11px] leading-relaxed text-ink">{record.stage2_tutor_notes || "—"}</p>
                ) : (
                  <p className="text-[10px] italic text-muted">Released after your tutorial.</p>
                )}
              </div>
            </div>

            {stage1And2Released ? (
              <div className="mt-3 border-t border-border-faint pt-3">
                <p className="mb-2 text-[11px] text-ink">
                  <span className="text-muted">Tutor&rsquo;s signature:</span>{" "}
                  <strong>{record.stage2_tutor_signature_name ?? "—"}</strong>
                </p>
                {record.trainee_signoff_stage2_at ? (
                  <p className="text-[11px] text-muted">
                    Signed by {record.stage2_candidate_signature_name ?? "you"} on{" "}
                    {new Date(record.trainee_signoff_stage2_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.
                  </p>
                ) : !viewer?.signature_name ? (
                  <SetSignatureForm fullName={viewer?.full_name ?? ""} />
                ) : (
                  <form action={signOffStage2}>
                    <p className="mb-2 text-[11px] text-ink">
                      This is an accurate record of the tutorial discussion and my progress to date. I have read and
                      agree with the summarising comments.
                    </p>
                    <button type="submit" className="c5-btn">Sign as {viewer.signature_name}</button>
                  </form>
                )}
              </div>
            ) : null}
          </BookletSection>

          <BookletSection id="c5-stage3" num="Section 11" title="Stage Three progress record">
            <p className="text-[10px] leading-relaxed text-muted" style={{ marginBottom: 10 }}>
              This record must be completed by tutors in the final third of the course for all candidates who: a) were
              not to standard at Stage 2; b) were at standard at Stage 2 but are not making the expected progress in
              the second half of the course; c) were above standard at Stage 2 but are not making the expected
              progress in the second half of the course. A tutorial must be given and the whole record completed.
            </p>
            {stage3IsExpected ? (
              record.stage3_finalized_at ? (
                <>
                  <CriteriaGrid stage="stage3" rows={stage3Rows} showCandidateColumn={false} candidateEditable={false} tutorLocked={false} />
                  <div className="mt-3 flex flex-col gap-3">
                    <div className="c5-box">
                      <span className="lab">Written assignments &mdash; tutor&rsquo;s comments</span>
                      <p className="text-[11px] leading-relaxed text-ink">{record.stage3_tutor_notes || "—"}</p>
                    </div>
                    <div className="c5-box">
                      <span className="lab">Other issues &mdash; tutor&rsquo;s comments</span>
                      <p className="text-[11px] leading-relaxed text-ink">{record.stage3_tutor_other_notes || "—"}</p>
                    </div>
                    <div className="c5-box">
                      <span className="lab">Overall progress &mdash; tutor&rsquo;s assessment</span>
                      <p className="text-[11px] text-ink">{overallLabel(record.stage3_tutor_overall)}</p>
                    </div>
                  </div>
                  <div className="mt-3 border-t border-border-faint pt-3">
                    <p className="mb-2 text-[11px] text-ink">
                      <span className="text-muted">Tutor&rsquo;s signature:</span>{" "}
                      <strong>{record.stage3_tutor_signature_name ?? "—"}</strong>
                    </p>
                    {record.stage3_candidate_signed_at ? (
                      <p className="text-[11px] text-muted">
                        Signed by {record.stage3_candidate_signature_name} on{" "}
                        {new Date(record.stage3_candidate_signed_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.
                      </p>
                    ) : !viewer?.signature_name ? (
                      <SetSignatureForm fullName={viewer?.full_name ?? ""} />
                    ) : (
                      <form action={signOffStage3}>
                        <p className="mb-2 text-[11px] text-ink">I have read and agree with the summarising comments above.</p>
                        <button type="submit" className="c5-btn">Sign as {viewer.signature_name}</button>
                      </form>
                    )}
                  </div>
                </>
              ) : (
                <StageLocked>
                  {stage3TriggerReason
                    ? `Stage Three applies to you — ${stage3TriggerReason.toLowerCase()}. Your tutor will complete it in the final third of the course.`
                    : "Your tutor will complete this in the final third of the course."}
                </StageLocked>
              )
            ) : (
              <StageLocked>
                Stage Three is completed for candidates who are not making the expected progress in the second half of
                the course. It does not currently apply to you.
              </StageLocked>
            )}
          </BookletSection>

          <BookletSection id="c5-final" num="Section 12" title="To be completed on the final day of the course">
            <p className="text-[10px] italic text-muted" style={{ marginBottom: 4 }}>
              Please tick the appropriate boxes and sign.
            </p>
            <p className="text-[11px] text-ink" style={{ marginBottom: 10 }}>
              In handing in this portfolio for assessment purposes, I confirm that:
            </p>
            <FinalDayChecks checks={finalChecks} />
            <div className="mt-4">
              <FinalChecklistForm signatureName={viewer?.signature_name ?? null} fullName={viewer?.full_name ?? ""} />
            </div>

            <p className="text-[11px]" style={{ marginTop: 16 }}>
              <span className="text-muted">Accepted by Tutor:</span>{" "}
              <strong className="text-ink">{record.final_tutor_signature_name ?? "\u2014"}</strong>
              {record.trainer_signoff_final_at ? (
                <span className="text-muted">
                  {" \u00b7 "}
                  {new Date(record.trainer_signoff_final_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              ) : null}
            </p>

            {/* Cambridge prints this box on the same page, for candidates
                whose portfolios go to Cambridge English. */}
            <div className="c5-box" style={{ marginTop: 24 }}>
              <span className="lab">
                Information for the CELTA grade review &mdash; tutor comments on action points detailed in Stage Three
                progress record
              </span>
              <p className="text-[10px] leading-relaxed text-muted">
                This box is to be completed for all candidates whose portfolios are submitted to Cambridge English.
                (See CELTA Administration Handbook for details of portfolios to be submitted.)
              </p>
              {/* The second instruction, which the app had dropped. It is the
                  one that tells a tutor WHAT to write, so a box carrying only
                  the first paragraph says who must fill it in and not what
                  belongs in it. */}
              <p className="mt-2 text-[10px] leading-relaxed italic text-muted">
                Please state whether the candidate did or did not demonstrate effectiveness in the areas identified,
                making reference to feedback to the candidate in final lessons and/or written assignments, as
                appropriate.
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-ink">{record.grade_review_tutor_comments || "—"}</p>
            </div>

          {/* His file keeps both appendices inside the final-day page rather
              than giving them pages of their own, so the booklet ends where
              his ends. They stay anchored so the contents links still jump. */}
          <div id="c5-appendix1" className="scroll-mt-6">
            <div className="c5-section-num">Appendix 1</div>
            <h2 className="c5-section-header">CELTA criteria</h2>
            <Appendix1 />
          </div>

          <div id="c5-appendix2" className="scroll-mt-6" style={{ marginTop: 28 }}>
            <div className="c5-section-num">Appendix 2</div>
            <h2 className="c5-section-header">CELTA performance descriptors</h2>
            <Appendix2 />
          </div>
          </BookletSection>
        </div>

      </div>
    );
  }

  // -- Staff / assessor view --
  const isEditableStaff = isStaff; // real trainer/admin session; assessor is view-only
  const trainee = await getPortfolioTrainee(traineeId);
  if (!trainee) notFound();
  if (viewer?.role === "trainer" && trainee.course_id !== viewer.course_id) notFound();
  if (assessorCourseId && trainee.course_id !== assessorCourseId) notFound();

  const [
    { data: course },
    center,
    { data: matrix },
    { data: record },
    { data: absences },
    { data: observations },
    { data: lessons },
    { data: assignments },
    { data: tpFeedbackRows },
    { data: planAssignments },
    { data: tpEvents },
    { data: subgroupMember },
  ] = await Promise.all([
    supabase.from("courses").select("name, start_date, end_date, delivery_mode, total_hours, course_code").eq("id", trainee.course_id ?? "").maybeSingle(),
    getCachedCenter(trainee.center_id),
    supabase.from("celta5_matrix").select("*").eq("trainee_id", traineeId),
    supabase.from("celta5_records").select("*").eq("trainee_id", traineeId).maybeSingle(),
    supabase.from("attendance_absences").select("*").eq("trainee_id", traineeId).order("session_date"),
    supabase.from("observations").select("*").eq("trainee_id", traineeId).order("observation_date"),
    supabase
      .from("tp_lessons")
      .select("id, lesson_date, length_minutes, level, learner_count, lesson_focus, tutor_assessment")
      .eq("trainee_id", traineeId)
      .order("lesson_date"),
    supabase
      .from("assignments")
      .select("id, assignment_type, first_status, resubmission_status, first_own_work_confirmed, resubmission_own_work_confirmed, first_outcome_signature_name, first_outcome_signed_at, resubmission_outcome_signature_name, resubmission_outcome_signed_at, final_grade")
      .eq("trainee_id", traineeId),
    supabase.from("tp_feedback").select("*").eq("trainee_id", traineeId),
    supabase.from("plan_assignments").select("tp_number, tp_point_id, taught_at").eq("trainee_id", traineeId),
    supabase
      .from("course_timetable_events")
      .select("type, event_date, linked_tp_number, mode")
      .eq("course_id", trainee.course_id ?? "")
      .eq("type", "tp"),
    supabase.from("course_subgroup_members").select("subgroup_id").eq("trainee_id", traineeId).maybeSingle(),
  ]);

  // assessment-model.md link 3: which TP round the COHORT has reached,
  // not this one trainee's own pace -- see computeCurrentTpRound().
  const currentTpRound = computeCurrentTpRound(tpEvents ?? [], toLocalIso(new Date(), center?.time_zone ?? DEFAULT_TIMEZONE));

  // remaining-compliance.md item 4: CELTA 5 front matter (candidate name,
  // centre number, tutors) populated from real data, never typed by hand.
  const lessonIds = (lessons ?? []).map((l) => l.id);
  const [{ data: courseTutorRows }, { data: obsTasks }, { data: obsTaskSubmissions }, { data: criteriaTags }] = await Promise.all([
    trainee.course_id
      ? supabase.from("course_tutors").select("profile_id").eq("course_id", trainee.course_id).is("left_at", null)
      : Promise.resolve({ data: [] }),
    trainee.course_id
      ? supabase.from("observation_tasks").select("id, title, instructions").eq("course_id", trainee.course_id).order("created_at")
      : Promise.resolve({ data: [] }),
    supabase.from("observation_task_submissions").select("task_id, response, submitted_at").eq("trainee_id", traineeId),
    lessonIds.length > 0
      ? supabase.from("tp_lesson_criteria_tags").select("*").in("tp_lesson_id", lessonIds).order("created_at")
      : Promise.resolve({ data: [] }),
  ]);
  const staffSubmissionByTaskId = new Map((obsTaskSubmissions ?? []).map((s) => [s.task_id, s]));
  const tutorIds = (courseTutorRows ?? []).map((t) => t.profile_id);
  const { data: tutorProfiles } =
    tutorIds.length > 0 ? await supabase.from("profiles").select("id, full_name").in("id", tutorIds) : { data: [] };
  const tutorNames = (tutorProfiles ?? []).map((t) => t.full_name);

  const taughtAssignments = (planAssignments ?? []).filter((p) => p.taught_at);
  const tpPointIdsForLevels = [...new Set(taughtAssignments.map((p) => p.tp_point_id).filter((id): id is string => !!id))];
  const { data: tpPointsForLevels } =
    tpPointIdsForLevels.length > 0
      ? await supabase.from("tp_points").select("id, tp_coursebook_id").in("id", tpPointIdsForLevels)
      : { data: [] };
  const coursebookIdsForLevels = [...new Set((tpPointsForLevels ?? []).map((p) => p.tp_coursebook_id))];
  const { data: coursebooksForLevels } =
    coursebookIdsForLevels.length > 0
      ? await supabase.from("tp_coursebooks").select("id, level").in("id", coursebookIdsForLevels)
      : { data: [] };
  const assessedTpStats = computeAssessedTpStats({
    taughtAssignments,
    tpPointCoursebookById: new Map((tpPointsForLevels ?? []).map((p) => [p.id, p.tp_coursebook_id])),
    coursebookLevelById: new Map((coursebooksForLevels ?? []).map((c) => [c.id, c.level])),
  });

  // course-modes.md §2 (Handbook 9.1.2) -- mixed-mode only.
  const { data: subgroupForMode } = subgroupMember?.subgroup_id
    ? await supabase.from("course_subgroups").select("half_order").eq("id", subgroupMember.subgroup_id).maybeSingle()
    : { data: null };
  const assessedHoursByMode =
    course?.delivery_mode === "mixed"
      ? computeAssessedHoursByMode({
          taughtAssignments,
          halfOrder: subgroupForMode?.half_order === 1 || subgroupForMode?.half_order === 2 ? subgroupForMode.half_order : null,
          tpEvents: tpEvents ?? [],
        })
      : null;

  const tagsByCriteria = new Map<string, { tag_type: "strength" | "action_point"; created_at: string }[]>();
  for (const tag of criteriaTags ?? []) {
    const list = tagsByCriteria.get(tag.criteria_code) ?? [];
    list.push({ tag_type: tag.tag_type, created_at: tag.created_at });
    tagsByCriteria.set(tag.criteria_code, list);
  }
  addTpFeedbackCriteriaTags(tagsByCriteria, tpFeedbackRows ?? []);

  const suggestions: Record<string, "S+" | "S" | "N"> = {};
  const attentionFlags: Record<string, ReturnType<typeof computeAttentionFlags>> = {};
  for (const code of CELTA_CRITERIA_CODES) {
    const tags = tagsByCriteria.get(code) ?? [];
    const suggestion = computeCriteriaSuggestion(tags);
    if (suggestion) suggestions[code] = suggestion;
    const flags = computeAttentionFlags(code, tags, currentTpRound);
    if (flags.length > 0) attentionFlags[code] = flags;
  }

  if (!record) {
    return (
      <div className="sheet p-6 text-sm text-muted">
        No CELTA 5 record exists for this trainee yet. It&apos;s created automatically when they&apos;re invited -- if this
        trainee predates that, an admin will need to add it manually.
      </div>
    );
  }

  const signatureLedger = computeSignatureLedger(record, assignments ?? []);

  const matrixRows = matrix ?? [];
  const matrixKey = matrixRows.map((m) => m.updated_at).join(",");
  const matrixByCode = new Map(matrixRows.map((m) => [m.criteria_code, m]));
  const stage2CandidateRatedCount = CELTA_CRITERIA_CODES.filter((c) => matrixByCode.get(c)?.candidate_status).length;
  const stage2TutorRatedCount = CELTA_CRITERIA_CODES.filter((c) => matrixByCode.get(c)?.tutor_status_stage2).length;
  const stage3TutorRatedCount = CELTA_CRITERIA_CODES.filter((c) => matrixByCode.get(c)?.tutor_status_stage3).length;

  const ratingsByCode: Record<string, "S+" | "S" | "N" | "X" | null> = {};
  for (const code of CELTA_CRITERIA_CODES) {
    ratingsByCode[code] = matrixByCode.get(code)?.tutor_status_stage2 ?? suggestions[code] ?? null;
  }
  const trajectoryByDimension = computeTrajectoryByDimension(ratingsByCode);
  const stageFlagSuggestions = computeStageFlagSuggestions(ratingsByCode);

  const headerBlock = (
    <div>
      <h2 className="font-serif text-xl text-ink">CELTA 5 record</h2>
      <div className="mt-3 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
        <div>
          <p className="text-muted">Candidate</p>
          <p className="text-ink">{trainee.full_name}</p>
        </div>
        <div>
          <p className="text-muted">Centre</p>
          <p className="text-ink">
            {center?.name ?? "--"}
            {center?.center_number ? ` (Centre ${center.center_number})` : ""}
          </p>
        </div>
        <div>
          <p className="text-muted">Course</p>
          <p className="text-ink">{course?.name ?? "--"}</p>
        </div>
        <div>
          <p className="text-muted">Dates</p>
          <p className="text-ink">{course ? `${course.start_date} → ${course.end_date}` : "--"}</p>
        </div>
        <div>
          <p className="text-muted">Tutors</p>
          <p className="text-ink">{tutorNames.length > 0 ? tutorNames.join(", ") : "--"}</p>
        </div>
        {center?.is_uk_centre ? (
          <div>
            <p className="text-muted">ULN</p>
            <p className="text-ink">{trainee.uln || "Not provided"}</p>
          </div>
        ) : null}
      </div>
    </div>
  );

  const { hoursCounted: observationHoursCounted, liveHours, filmedHours } = computeObservationHours(observations ?? []);
  const observationLivePct = Math.min(100, (liveHours / OBSERVATION_HOURS_REQUIRED) * 100);
  const filmedCountedHours = observationHoursCounted - liveHours;
  const observationFilmedPct = Math.min(100 - observationLivePct, (filmedCountedHours / OBSERVATION_HOURS_REQUIRED) * 100);

  const tasksBlock =
    (obsTasks ?? []).length > 0 ? (
      <div>
        <h3 className="font-serif text-lg text-ink">Observation tasks</h3>
        <div className="sheet mt-2 flex flex-col gap-3">
          {(obsTasks ?? []).map((task) => {
            const submission = staffSubmissionByTaskId.get(task.id);
            return (
              <div key={task.id} className="border-b border-border-faint pb-3 last:border-none last:pb-0">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-ink">{task.title}</p>
                  <span className={`pill ${submission ? "pill-success" : "pill-neutral"}`}>
                    {submission ? "Submitted" : "Not yet"}
                  </span>
                </div>
                {submission ? (
                  <>
                    <p className="mt-1 text-xs text-muted">{new Date(submission.submitted_at).toLocaleString()}</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{submission.response}</p>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    ) : null;

  const observationsBlock = (
    <div>
      <h3 className="font-serif text-lg text-ink">Observations of experienced teachers (self-reported)</h3>
      <div className="mt-2">
        <p className="text-sm text-ink">
          {observationHoursCounted.toFixed(1)} of {OBSERVATION_HOURS_REQUIRED} hrs counted · {liveHours.toFixed(1)} hrs live
          {filmedHours > 0 ? ` · ${filmedHours.toFixed(1)} hrs filmed (capped at 3)` : ""}
        </p>
        <div className="mt-1.5 flex h-1.5 w-full overflow-hidden rounded-full bg-accent">
          <div className="h-full bg-primary" style={{ width: `${observationLivePct}%` }} />
          {/* Filmed is a category, not a status -- gold is reserved, so this
              reuses Observation Tasks.dc.html's own decorative "Filmed" hue
              (plum) rather than inventing a third treatment for the same
              concept. */}
          <div className="h-full bg-[oklch(46%_0.09_320)]" style={{ width: `${observationFilmedPct}%` }} />
        </div>
      </div>
      {/* Decorative teal/garnet alternation -- shared by both the assessor
          and trainer-edit views below, since this block renders once and is
          reused in both branches. */}
      <div className="sheet sheet-garnet mt-3 overflow-hidden !p-0">
        {observations && observations.length > 0 ? (
          <table className="table-plain w-full">
            <thead>
              <tr>
                <th className="text-sm text-muted">Date</th>
                <th className="text-sm text-muted">Length</th>
                <th className="text-sm text-muted">Level</th>
                <th className="text-sm text-muted">Focus</th>
                <th className="text-sm text-muted">Filmed</th>
              </tr>
            </thead>
            <tbody>
              {observations.map((o) => (
                <tr key={o.id}>
                  <td className="text-ink">{o.observation_date ?? "--"}</td>
                  <td className="text-muted">{o.length_minutes ? `${o.length_minutes} min` : "--"}</td>
                  <td className="text-muted">{o.level ?? "--"}</td>
                  <td className="text-muted">{o.lesson_focus ?? "--"}</td>
                  <td className="text-muted">{o.filmed ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="p-4 text-muted">No observations logged yet.</p>
        )}
      </div>
    </div>
  );

  if (!isEditableStaff) {
    // Assessor: read-only summary, not the trainer's editable stage forms --
    // same fetched data (record/matrix/attendance/observations), rendered
    // as plain text/pills instead of Stage1Form/StageRatingsForm/etc.
    // FinalizeRecordForm and AdminGrantForm are trainer/admin operational
    // controls with no read equivalent for an assessor to see at all.
    //
    // This is the branch an external assessor lands on during the visit in
    // the final week, so it carries the booklet itself -- the whole reason
    // the trainee view was rebuilt as the Cambridge document (Ramy, 29 Aug
    // 2026). Until now the document-shaped view existed only on the trainee
    // branch, i.e. the one view the assessor never opens.
    const assessorObservationRows = (observations ?? []).map((o) => ({
      date: o.observation_date ?? "",
      minutes: o.length_minutes,
      level: o.level ?? "",
      learners: o.learners_present,
      focus: o.lesson_focus ?? "",
      kind: o.filmed ? "Filmed" : "Experienced teacher",
    }));
    // Cambridge asks the two absence tables for different things: the
    // unavoidable table wants a tutor SIGNATURE, the other table wants a
    // tutor COMMENT and a signature. Migration 0249 separated those, so
    // each column here now comes from the field that actually means it.
    const assessorUnavoidable = (absences ?? [])
      .filter((a) => a.category === "unavoidable")
      .map((a) => ({
        date: a.session_date ?? "",
        session: a.session_missed ?? "",
        reason: a.reason ?? "",
        madeUp: a.work_made_up ?? "",
        tutor: a.tutor_signature_name ?? "",
      }));
    const assessorOther = (absences ?? [])
      .filter((a) => a.category === "other")
      .map((a) => ({
        date: a.session_date ?? "",
        session: a.session_missed ?? "",
        reason: a.reason ?? "",
        madeUp: a.work_made_up ?? "",
        candidate: a.candidate_comment ?? "",
        tutor: [a.tutor_comment, a.tutor_signature_name].filter(Boolean).join(" \u00b7 "),
      }));

    // Assessed TP and written assignments read the same sources the
    // trainee's own booklet does, so the two views cannot disagree about
    // what an assessor is looking at.
    const assessorTpRows = (lessons ?? []).map((l) => ({
      date: l.lesson_date ?? "",
      length: l.length_minutes != null ? `${l.length_minutes}` : "",
      level: l.level ?? "",
      learners: l.learner_count != null ? `${l.learner_count}` : "",
      focus: l.lesson_focus ?? "",
      assessment:
        l.tutor_assessment === "above_standard"
          ? "Above standard"
          : l.tutor_assessment === "to_standard"
            ? "To standard"
            : l.tutor_assessment === "not_to_standard"
              ? "Below standard"
              : "",
      initials: "",
    }));
    const ASSESSOR_ASSIGNMENTS = [
      { type: "Focus on Learner", title: "Focus on the learner" },
      { type: "LRT", title: "Language related tasks" },
      { type: "Skills", title: "Skills assignment" },
      { type: "LfC", title: "Lessons from the classroom" },
    ] as const;
    const assessorAssignmentByType = new Map((assignments ?? []).map((a) => [a.assignment_type, a]));
    const assessorAssignmentRows = ASSESSOR_ASSIGNMENTS.map(({ type, title }) => {
      const a = assessorAssignmentByType.get(type);
      const onResub = !!a && a.resubmission_status !== "not_submitted";
      return {
        title,
        result: !a
          ? "— not yet submitted"
          : a.resubmission_status === "approved"
            ? "Pass 2nd submission"
            : a.first_status === "approved"
              ? "Pass 1st submission"
              : a.final_grade === "Fail"
                ? "Fail"
                : a.first_status === "resubmission_required"
                  ? "Resubmission required"
                  : "— not yet graded",
        signatureName: onResub
          ? a?.resubmission_outcome_signature_name ?? null
          : a?.first_outcome_signature_name ?? null,
        signedAt: onResub ? a?.resubmission_outcome_signed_at ?? null : a?.first_outcome_signed_at ?? null,
      };
    });
    const assessorCriteriaRows = (which: "stage2" | "stage3"): CriterionRow[] =>
      CELTA_CRITERIA_SECTIONS.flatMap((sec) =>
        sec.codes.map((code, i) => {
          const m = matrixByCode.get(code);
          const mark = (v: string | null | undefined): Mark =>
            v === "S+" || v === "S" || v === "N" || v === "X" ? v : null;
          return {
            code,
            text: CRITERIA_LABELS[code] ?? code,
            topic: i === 0 ? `TOPIC ${sec.section} – ${sec.title.toUpperCase()}` : undefined,
            candidate: which === "stage2" ? mark(m?.candidate_status) : null,
            tutor: mark(which === "stage2" ? m?.tutor_status_stage2 : m?.tutor_status_stage3),
          };
        })
      );
    const assessorOverall = (v: string | null | undefined) => overallLabel(v);
    const sigLine = (name: string | null, at: string | null) =>
      name ? `${name}${at ? ` · ${new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}` : ""}` : "Not signed";

    return (
      <div className="flex flex-col gap-4">
        {/* headerBlock deliberately not rendered here -- see the note on the
            candidate branch. The cover is the document's own title page. */}

        {/* The assessor reads the booklet, not a summary of it. Ramy, 29 Aug
            2026 -- this is the view the rebuild exists for: an external
            assessor opens this during the visit in the final week and
            compares it against the real CELTA 5. Same fifteen pages as the
            candidate's own view, read-only, nothing hidden and nothing
            added. */}
        <div className="c5-doc">
          {/* Front matter, unnumbered -- see the note on the trainee branch. */}
          <BookletSection frontMatter>
            <BookletCover
              data={{
                candidateName: trainee.full_name,
                centreName: center?.name ?? null,
                centreNumber: center?.center_number ?? null,
                courseNumber: course?.course_code ?? null,
                courseDates:
                  course?.start_date && course?.end_date
                    ? `${new Date(`${course.start_date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} – ${new Date(`${course.end_date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`
                    : null,
                tutors: [],
                uln: null,
              }}
            />
          </BookletSection>

          <BookletSection title="Contents" frontMatter>
            <BookletContents />
          </BookletSection>

          <BookletSections
            portfolioConfirmedAt={record.portfolio_terms_confirmed_at}
            portfolioSignatureName={record.portfolio_terms_signature_name}
            appealsConfirmedAt={record.appeals_read_confirmed_at}
            appealsSignatureName={record.appeals_read_signature_name}
            canSign={false}
            fullName={trainee.full_name}
          />

          <BookletSection id="c5-attendance" title="Record of attendance">
            <AttendanceRecord
              courseHours={course?.total_hours ?? null}
              hoursAttended={record.hours_attended}
              unavoidable={assessorUnavoidable}
              other={assessorOther}
            />
          </BookletSection>

          <BookletSection
            id="c5-observations"
            title="Record of observations of experienced classroom teachers (including filmed observations)"
          >
            <ObservationsRecord rows={assessorObservationRows} />
          </BookletSection>

          <BookletSection id="c5-tp" title="Record of assessed teaching practice">
            <AssessedTpRecord rows={assessorTpRows} />
          </BookletSection>

          <BookletSection id="c5-assignments" title="Record of written assignments">
            <WrittenAssignmentsRecord rows={assessorAssignmentRows} />
          </BookletSection>

          <BookletSection id="c5-stage1" num="Section 9" title="Stage One progress record">
            {record.stage1_released_at ? (
              <>
                <div className="c5-box" style={{ marginBottom: 10 }}>
                  <span className="lab">Strengths</span>
                  <p className="text-[11px] leading-relaxed whitespace-pre-wrap text-ink">{record.stage1_strengths || "—"}</p>
                </div>
                <div className="c5-box" style={{ marginBottom: 10 }}>
                  <span className="lab">Action plan for next stage of the course</span>
                  <p className="text-[11px] leading-relaxed whitespace-pre-wrap text-ink">{record.stage1_action_plan || "—"}</p>
                </div>
                <p className="text-[11px]">
                  <span className="text-muted">Tutor&rsquo;s signature:</span>{" "}
                  <strong className="text-ink">{sigLine(record.stage1_tutor_signature_name, record.stage1_completed_at)}</strong>
                </p>
                <p className="text-[11px]">
                  <span className="text-muted">Candidate&rsquo;s signature:</span>{" "}
                  <strong className="text-ink">{sigLine(record.stage1_candidate_signature_name, record.stage1_candidate_signed_at)}</strong>
                </p>
              </>
            ) : (
              <StageLocked>Not yet released to the candidate.</StageLocked>
            )}
          </BookletSection>

          <BookletSection
            id="c5-stage2"
            num={`Section 10${record.stage2_hours_taught != null ? ` · Hours taught: ${record.stage2_hours_taught}` : ""}`}
            title="Stage Two progress record"
          >
            <CriteriaGrid
              stage="stage2"
              rows={assessorCriteriaRows("stage2")}
              showCandidateColumn
              candidateEditable={false}
              tutorLocked={false}
            />
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="c5-box">
                <span className="lab">Written assignments &mdash; candidate</span>
                <p className="text-[11px] whitespace-pre-wrap text-ink">{record.stage2_candidate_written_assignments_notes || "—"}</p>
              </div>
              <div className="c5-box">
                <span className="lab">Written assignments &mdash; tutor</span>
                <p className="text-[11px] whitespace-pre-wrap text-ink">{record.stage2_tutor_written_assignments_notes || "—"}</p>
              </div>
              <div className="c5-box">
                <span className="lab">Other issues &mdash; candidate</span>
                <p className="text-[11px] whitespace-pre-wrap text-ink">{record.stage2_candidate_other_notes || "—"}</p>
              </div>
              <div className="c5-box">
                <span className="lab">Other issues &mdash; tutor</span>
                <p className="text-[11px] whitespace-pre-wrap text-ink">{record.stage2_tutor_other_notes || "—"}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-col gap-3">
              <div className="c5-box">
                <span className="lab">Overall progress &mdash; candidate&rsquo;s assessment</span>
                <p className="text-[11px] text-ink">{assessorOverall(record.stage2_candidate_overall)}</p>
                {record.stage2_candidate_notes ? (
                  <p className="mt-1 text-[11px] whitespace-pre-wrap text-muted">{record.stage2_candidate_notes}</p>
                ) : null}
              </div>
              <div className="c5-box">
                <span className="lab">Overall progress &mdash; tutor&rsquo;s assessment</span>
                <p className="text-[11px] text-ink">{assessorOverall(record.stage2_tutor_overall)}</p>
              </div>
              <div className="c5-box">
                <span className="lab">Summary of tutorial and action points</span>
                <p className="text-[11px] whitespace-pre-wrap text-ink">{record.stage2_tutor_notes || "—"}</p>
              </div>
            </div>
            <p className="mt-3 text-[11px]">
              <span className="text-muted">Tutor&rsquo;s signature:</span>{" "}
              <strong className="text-ink">{sigLine(record.stage2_tutor_signature_name, record.stage2_completed_at)}</strong>
            </p>
            <p className="text-[11px]">
              <span className="text-muted">Candidate&rsquo;s signature:</span>{" "}
              <strong className="text-ink">{sigLine(record.stage2_candidate_signature_name, record.trainee_signoff_stage2_at)}</strong>
            </p>
          </BookletSection>

          <BookletSection id="c5-stage3" num="Section 11" title="Stage Three progress record">
            {record.stage3_finalized_at ? (
              <>
                <CriteriaGrid stage="stage3" rows={assessorCriteriaRows("stage3")} showCandidateColumn={false} candidateEditable={false} tutorLocked={false} />
                <div className="mt-3 flex flex-col gap-3">
                  <div className="c5-box">
                    <span className="lab">Written assignments &mdash; tutor&rsquo;s comments</span>
                    <p className="text-[11px] whitespace-pre-wrap text-ink">{record.stage3_tutor_notes || "—"}</p>
                  </div>
                  <div className="c5-box">
                    <span className="lab">Other issues &mdash; tutor&rsquo;s comments</span>
                    <p className="text-[11px] whitespace-pre-wrap text-ink">{record.stage3_tutor_other_notes || "—"}</p>
                  </div>
                  <div className="c5-box">
                    <span className="lab">Overall progress &mdash; tutor&rsquo;s assessment</span>
                    <p className="text-[11px] text-ink">{assessorOverall(record.stage3_tutor_overall)}</p>
                  </div>
                </div>
                <p className="mt-3 text-[11px]">
                  <span className="text-muted">Tutor&rsquo;s signature:</span>{" "}
                  <strong className="text-ink">{sigLine(record.stage3_tutor_signature_name, record.stage3_finalized_at)}</strong>
                </p>
                <p className="text-[11px]">
                  <span className="text-muted">Candidate&rsquo;s signature:</span>{" "}
                  <strong className="text-ink">{sigLine(record.stage3_candidate_signature_name, record.stage3_candidate_signed_at)}</strong>
                </p>
              </>
            ) : (
              <StageLocked>
                {record.stage3_tutorial_required
                  ? "Required for this candidate; not yet completed."
                  : "Not required for this candidate."}
              </StageLocked>
            )}
          </BookletSection>

          <BookletSection id="c5-final" num="Section 12" title="To be completed on the final day of the course">
            <p className="text-[10px] italic text-muted" style={{ marginBottom: 4 }}>
              Please tick the appropriate boxes and sign.
            </p>
            <p className="text-[11px] text-ink" style={{ marginBottom: 10 }}>
              In handing in this portfolio for assessment purposes, I confirm that:
            </p>
            <FinalDayChecks
              checks={[
                { label: "I have completed six hours of assessed teaching practice at at least two levels.", met: record.final_checklist_tp },
                { label: "I have completed six hours of observation of experienced teachers.", met: record.final_checklist_observations },
                { label: "I have completed four written assignments.", met: record.final_checklist_assignments },
                { label: "The written assignments are my own work.", met: record.final_checklist_own_work },
                { label: "I have completed all records.", met: record.final_checklist_all_records },
              ]}
            />
            <p className="mt-3 text-[11px]">
              <span className="text-muted">Candidate&rsquo;s signature:</span>{" "}
              <strong className="text-ink">{sigLine(record.final_candidate_signature_name, record.trainee_signoff_final_at)}</strong>
            </p>
            <p className="text-[11px]">
              <span className="text-muted">Accepted by Tutor:</span>{" "}
              <strong className="text-ink">{sigLine(record.final_tutor_signature_name, record.trainer_signoff_final_at)}</strong>
            </p>

            <div className="c5-box" style={{ marginTop: 24 }}>
              <span className="lab">
                Information for the CELTA grade review &mdash; tutor comments on action points detailed in Stage Three
                progress record
              </span>
              <p className="text-[10px] leading-relaxed text-muted">
                This box is to be completed for all candidates whose portfolios are submitted to Cambridge English.
                (See CELTA Administration Handbook for details of portfolios to be submitted.)
              </p>
              <p className="mt-2 text-[10px] leading-relaxed italic text-muted">
                Please state whether the candidate did or did not demonstrate effectiveness in the areas identified,
                making reference to feedback to the candidate in final lessons and/or written assignments, as
                appropriate.
              </p>
              <p className="mt-2 text-[11px] whitespace-pre-wrap text-ink">{record.grade_review_tutor_comments || "—"}</p>
            </div>

            <div id="c5-appendix1" className="scroll-mt-6" style={{ marginTop: 28 }}>
              <div className="c5-section-num">Appendix 1</div>
              <h2 className="c5-section-header">CELTA criteria</h2>
              <Appendix1 />
            </div>

            <div id="c5-appendix2" className="scroll-mt-6" style={{ marginTop: 28 }}>
              <div className="c5-section-num">Appendix 2</div>
              <h2 className="c5-section-header">CELTA performance descriptors</h2>
              <Appendix2 />
            </div>
          </BookletSection>
        </div>

        {/* Assessor-only, deliberately outside the booklet: these are
            Connect's own working aids, not part of Cambridge's document,
            and an assessor should never mistake one for the other. */}
        <div className="sheet">
          <p className="text-sm text-muted">Trajectory (estimated, informal -- not part of the CELTA 5)</p>
          <div className="mt-3">
            <TrajectoryGradientBars byDimension={trajectoryByDimension} />
          </div>
        </div>

        <AssessedTpStatsBadge stats={assessedTpStats} byMode={assessedHoursByMode} />

        <div className="sheet">
          <p className="text-sm text-muted">Final recommended grade</p>
          {record.final_recommended_grade ? (
            <>
              <span className="mt-1 inline-flex rounded-[6px] bg-primary px-3 py-1 font-serif text-2xl text-primary-foreground">
                {record.final_recommended_grade}
              </span>
              {record.overall_notes ? <p className="mt-3 text-ink">{record.overall_notes}</p> : null}
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">Not yet decided.</p>
          )}
        </div>

        <SignatureLedger rows={signatureLedger} traineeId={traineeId} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {headerBlock}

      <div className="sheet">
        <p className="text-sm text-muted">Trajectory (trainer-only, estimated -- never shown to the trainee, never sets the real final grade)</p>
        <div className="mt-3">
          <TrajectoryGradientBars byDimension={trajectoryByDimension} />
        </div>
      </div>

      <AttendanceForm key={`attendance-${record.updated_at}`} record={record} totalHours={course?.total_hours ?? 120} absences={absences ?? []} />

      {tasksBlock}

      {observationsBlock}

      <AssessedTpStatsBadge stats={assessedTpStats} byMode={assessedHoursByMode} />

      <AssignmentsSummary traineeId={traineeId} assignments={assignments ?? []} />
      <TpFeedbackSummary traineeId={traineeId} feedbackRows={tpFeedbackRows ?? []} />

      {stageFlagSuggestions.length > 0 && (!record.stage1_completed_at || !record.stage3_tutorial_required) ? (
        <div className="sheet-accent-alert flex flex-col gap-1.5">
          <p className="text-sm font-semibold text-ink">Worth a look for Stage 1 or Stage 3</p>
          <p className="text-xs text-muted">
            A pattern in the ratings so far, not a decision -- criteria tallies never trigger anything on their own.
          </p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {stageFlagSuggestions.map((s) => (
              <li key={s.section} className="text-sm text-ink">
                {s.nCount} of {CELTA_CRITERIA_SECTIONS.find((sec) => sec.section === s.section)?.codes.length} criteria rated N in
                Topic {s.section} -- {s.title}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Stage1Form key={`stage1-${record.updated_at}`} record={record} trainerFullName={viewer?.full_name ?? ""} trainerSignatureName={viewer?.signature_name ?? null} />

      <div>
        <h3 className="font-serif text-lg text-ink">Progress Record — Stage 2: criteria ratings</h3>
        <div className="mt-3">
          <StageRatingsForm
            key={`s2-${matrixKey}`}
            stage={2}
            traineeId={traineeId}
            rows={matrixRows}
            suggestions={suggestions}
            attentionFlags={attentionFlags}
            currentTpRound={currentTpRound}
          />
        </div>
      </div>

      <Stage2OverallForm key={`stage2-${record.updated_at}`} record={record} trainerFullName={viewer?.full_name ?? ""} trainerSignatureName={viewer?.signature_name ?? null} />

      <div>
        <h3 className="font-serif text-lg text-ink">Stage Three -- criteria ratings</h3>
        <div className="mt-3">
          <StageRatingsForm
            key={`s3-${matrixKey}`}
            stage={3}
            traineeId={traineeId}
            rows={matrixRows}
            attentionFlags={attentionFlags}
            currentTpRound={currentTpRound}
          />
        </div>
      </div>

      <Stage3OverallForm key={`stage3-${record.updated_at}`} record={record} trainerFullName={viewer?.full_name ?? ""} trainerSignatureName={viewer?.signature_name ?? null} />

      {record.stage3_tutorial_required ? (
        <GradeReviewCommentsForm key={`grade-review-${record.updated_at}`} record={record} />
      ) : null}

      {record.final_recommended_grade && record.final_recommended_grade !== "Withdrawn" && record.final_recommended_grade !== "Extension" && record.final_recommended_grade !== "Deferred" && record.trainer_signoff_final_at ? (
        <div className="sheet sheet-garnet flex items-center justify-between gap-3">
          <p className="text-ink">Final report ready to download.</p>
          <a
            href={`/api/celta5/${traineeId}/final-report`}
            className="shrink-0 rounded-[6px] border border-border px-3 py-1.5 text-sm text-ink trainee-hover-fill"
          >
            Download final report
          </a>
        </div>
      ) : null}

      <FinalGradeForm key={`final-${record.updated_at}`} record={record} />

      <FinalizeRecordForm key={`finalize-${record.updated_at}`} record={record} trainerFullName={viewer?.full_name ?? ""} trainerSignatureName={viewer?.signature_name ?? null} />

      {record.final_recommended_grade && record.final_recommended_grade !== "Withdrawn" && record.final_recommended_grade !== "Extension" && record.final_recommended_grade !== "Deferred" && record.trainer_signoff_final_at ? (
        <ReleaseFinalReportForm key={`release-${record.updated_at}`} record={record} />
      ) : null}

      <AdminGrantForm key={`admin-grant-${record.updated_at}`} record={record} />

      <SignatureLedger rows={signatureLedger} traineeId={traineeId} />
    </div>
  );
}
