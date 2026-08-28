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
import { computeSignatureLedger } from "@/lib/celta5-signatures";
import { markScavengerHuntFound } from "@/lib/scavenger-hunt";

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
      supabase.from("assignments").select("assignment_type, first_status, resubmission_status").eq("trainee_id", traineeId),
      viewer?.course_id
        ? supabase.from("courses").select("name, start_date, end_date, delivery_mode").eq("id", viewer.course_id).maybeSingle()
        : Promise.resolve({ data: null }),
      viewer?.center_id
        ? supabase.from("centers").select("name, center_number, is_uk_centre, time_zone").eq("id", viewer.center_id).maybeSingle()
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

    const progressHeadingParts: string[] = [];
    if (myStage2Slot) progressHeadingParts.push(`Stage 2 tutorial booked`);
    else if (stage2BlockIds.length > 0) progressHeadingParts.push(`Stage 2 tutorial not booked`);
    progressHeadingParts.push(bothSigned ? "CELTA 5 signed off" : stage2Submitted ? "CELTA 5 under review" : "CELTA 5 not started");
    const progressHeading = progressHeadingParts.join(" · ");

    // Decorative teal/garnet alternation down this long vertical stack of
    // plain sheets -- no status meaning of its own, same rule as everywhere
    // else. "Course progress" just below stays plain teal (index 0); this
    // counter starts at 1 and is called, in render order, only for each
    // sheet that actually renders, so it still alternates correctly across
    // this section's many mutually-exclusive branches.
    let sheetCounter = 1;
    const nextSheetGarnet = () => sheetCounter++ % 2 === 1;

    return (
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">Certification progress</p>
          <h1 className="mt-1 font-serif text-2xl text-ink">{progressHeading}</h1>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sheet flex flex-col gap-3 border-t-[3px] border-t-[oklch(38%_0.085_155)]">
            <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">Stage 1 / 2 / 3</p>
            <div className="flex flex-col">
              <div className="flex items-start justify-between gap-3 border-b border-border-faint py-2.5">
                <div>
                  <p className="text-sm font-semibold text-ink">Stage 1 report</p>
                  <p className="mt-0.5 text-xs text-muted">
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
              <div className="flex items-start justify-between gap-3 border-b border-border-faint py-2.5">
                <div>
                  <p className="text-sm font-semibold text-ink">Stage 2 tutorial</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {myStage2Slot
                      ? `You booked ${myStage2Slot.position === 1 ? "1st" : myStage2Slot.position === 2 ? "2nd" : myStage2Slot.position === 3 ? "3rd" : `${myStage2Slot.position}th`}`
                      : "Book your slot from the timetable"}
                  </p>
                </div>
                <span className={`pill ${myStage2Slot ? "pill-success" : "pill-warning"}`}>{myStage2Slot ? "Booked" : "Not booked"}</span>
              </div>
              <div className="flex items-start justify-between gap-3 py-2.5">
                <div>
                  <p className="text-sm font-semibold text-ink">Stage 3 report</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {record.stage3_required
                      ? record.stage3_finalized_at
                        ? "Filed by your tutor"
                        : stage3Invite
                          ? `Tutorial ${stage3Invite.confirmed_at ? "confirmed" : "invited, not yet confirmed"}${
                              tutorialEventById.get(stage3Invite.timetable_event_id)
                                ? ` · ${tutorialEventById.get(stage3Invite.timetable_event_id)!.event_date}`
                                : ""
                            }`
                          : "Triggered -- not yet filed"
                      : "Only filed if triggered -- not-to-standard at Stage 2, slipping from above-standard, or a failed assignment"}
                  </p>
                </div>
                <span className={`pill ${!record.stage3_required ? "pill-neutral" : record.stage3_finalized_at ? "pill-success" : "pill-warning"}`}>
                  {!record.stage3_required ? "N/A so far" : record.stage3_finalized_at ? "Filed" : "Pending"}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-muted">Sourced from the same Standing table your tutor sees -- this is your own row, not a separate record.</p>
          </div>

          <div className="sheet flex flex-col gap-3 border-t-[3px] border-t-[oklch(42%_0.13_27)]">
            <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">CELTA 5 self-assessment</p>
            <div className="flex flex-col gap-1">
              <p className={`text-sm font-semibold ${bothSigned ? "text-ink" : stage2Submitted ? "text-primary" : "text-status-warning-text"}`}>
                {bothSigned ? "Both signed" : stage2Submitted ? "Candidate signed" : "Not started"}
              </p>
              <p className="text-xs text-muted">
                {bothSigned
                  ? "Signed off by you and your tutor."
                  : stage2Submitted
                    ? stage1And2Released
                      ? "Your tutor has released the matrix -- review it below and sign off."
                      : "Submitted -- your tutor is reviewing it."
                    : "Best completed after TP2, once you have some feedback to reflect on."}
              </p>
            </div>
            <p className="text-xs text-muted">You sign, then your tutor countersigns -- neither alone finishes it.</p>
            <p className="text-[11px] text-muted">No grade lives here. This is your own reflection against the five CELTA components, not an assessment.</p>
          </div>

          <div className="sheet flex flex-col gap-3 border-t-[3px] border-t-[oklch(38%_0.085_155)]">
            <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">Observation hours</p>
            <div className="flex flex-col">
              <div className="flex items-start gap-3 border-b border-border-faint py-2.5">
                <span className="w-9 shrink-0 text-sm font-semibold text-ink">{experiencedTeacherHours.toFixed(1)}h</span>
                <p className="text-xs text-muted">
                  of {OBSERVATION_HOURS_REQUIRED}h minimum, experienced teachers{experiencedTeacherHours >= OBSERVATION_HOURS_REQUIRED ? " -- complete" : ""}
                </p>
              </div>
              <div className="flex items-start gap-3 border-b border-border-faint py-2.5">
                <span className="w-9 shrink-0 text-sm font-semibold text-ink">{peerHours.toFixed(1)}h</span>
                <p className="text-xs text-muted">peer observation, live only</p>
              </div>
              <div className="flex items-start gap-3 py-2.5">
                <span className="w-9 shrink-0 text-sm font-semibold text-ink">{filmedHours.toFixed(1)}h</span>
                <p className="text-xs text-muted">filmed, capped separately -- does not count toward the peer minimum</p>
              </div>
            </div>
            <p className="text-[11px] text-muted">Full log further down this page -- every entry ties back to a specific session.</p>
          </div>
        </div>

        <div>
          <h2 className="font-serif text-xl text-ink">CELTA 5 record</h2>
          {/* remaining-compliance.md item 4: front matter populated from
              real data (name/centre/course/tutors), never typed by hand. */}
          <div className="mt-3 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div>
              <p className="text-muted">Candidate</p>
              <p className="text-ink">{viewer?.full_name}</p>
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
                <p className="text-ink">{viewer?.uln || "Not provided"}</p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="sheet">
          <p className="text-sm text-muted">Course progress</p>
          {progressIssues.length === 0 ? (
            <p className="mt-2">
              <span className="pill pill-success">On track</span>
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {progressIssues.map((issue, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="pill pill-danger">{issue.label}</span>
                  <span className="text-sm text-muted">{issue.detail}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {!stage2Submitted ? (
          <div>
            <h3 className="font-serif text-lg text-ink">Progress Record — Stage 2: self-assessment</h3>
            <div className="mt-3">
              <SelfAssessmentForm />
            </div>
          </div>
        ) : !stage1And2Released ? (
          <div className={`sheet ${nextSheetGarnet() ? "sheet-garnet" : ""}`}>
            <h3 className="font-serif text-lg text-ink">Progress Record — Stage 2</h3>
            <p className="mt-2 text-muted">
              Your self-assessment was submitted {new Date(record.stage2_candidate_submitted_at!).toLocaleString()}.
              Your tutor is reviewing it -- your Progress Record for Stages 1 and 2 will appear here once they release it.
            </p>
          </div>
        ) : (
          <>
            {/* Ramy, 29 Aug 2026: Stage One is tutor-gated -- "the trainee
                sees nothing until the tutor hits Release to trainee".
                Keyed on released_at, not completed_at: those used to be the
                same column, so a tutor finishing the report published it in
                the same action and could neither draft nor take it back. */}
            {record.stage1_released_at ? (
              <div className={`sheet ${nextSheetGarnet() ? "sheet-garnet" : ""}`}>
                <h3 className="font-serif text-lg text-ink">Progress Record — Stage 1</h3>
                {record.stage1_strengths ? (
                  <div className="mt-2">
                    <p className="text-sm text-muted">Strengths</p>
                    <p className="text-ink">{record.stage1_strengths}</p>
                  </div>
                ) : null}
                {record.stage1_action_plan ? (
                  <div className="mt-2">
                    <p className="text-sm text-muted">Action plan</p>
                    <p className="text-ink">{record.stage1_action_plan}</p>
                  </div>
                ) : null}
                <div className="mt-3 border-t border-border-faint pt-3">
                  {record.stage1_candidate_signed_at ? (
                    <p className="text-sm text-muted">
                      Signed by {record.stage1_candidate_signature_name} on {new Date(record.stage1_candidate_signed_at).toLocaleString()}.
                    </p>
                  ) : !viewer?.signature_name ? (
                    <SetSignatureForm fullName={viewer?.full_name ?? ""} />
                  ) : (
                    <form action={signOffStage1}>
                      <p className="mb-2 text-sm text-ink">I have read and agree with the summarising comments above.</p>
                      <button type="submit" className="rounded-[6px] bg-primary px-4 py-2 font-medium text-primary-foreground">
                        Sign as {viewer.signature_name}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            ) : (
              // The "not yet released" state the spec asks for. Deliberately
              // says the report exists and is coming, rather than rendering
              // nothing -- a candidate who knows Stage One happens should
              // not be left wondering whether the page is broken.
              <div className={`sheet ${nextSheetGarnet() ? "sheet-garnet" : ""}`}>
                <h3 className="font-serif text-lg text-ink">Progress Record — Stage 1</h3>
                <p className="mt-2 text-sm text-muted">
                  Your tutor writes this from your teaching practice feedback and releases it to you. Not yet released —
                  you will see it here, and be asked to sign it, once they do.
                </p>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-serif text-lg text-ink">Progress Record — Stage 2</h3>
                <span className="rounded-[6px] bg-accent px-2.5 py-1 text-xs font-medium text-ink">
                  You: {candidateRatedCount} of {CELTA_CRITERIA_CODES.length} · Tutor: {tutorRatedCount} of{" "}
                  {CELTA_CRITERIA_CODES.length}
                </span>
              </div>
              <div className={`sheet mt-3 overflow-hidden !p-0 ${nextSheetGarnet() ? "sheet-garnet" : ""}`}>
                <div className="list-row">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-sm text-muted">Your overall assessment</p>
                      <StandardRatingPill rating={record.stage2_candidate_overall} />
                    </div>
                    <div>
                      <p className="text-sm text-muted">Tutor&apos;s overall assessment</p>
                      <StandardRatingPill rating={record.stage2_tutor_overall} />
                    </div>
                  </div>
                  {record.stage2_tutor_notes ? (
                    <div className="mt-4">
                      <p className="text-sm text-muted">Tutor&apos;s summary and action points</p>
                      <p className="text-ink">{record.stage2_tutor_notes}</p>
                    </div>
                  ) : null}
                </div>

                {CELTA_CRITERIA_SECTIONS.map(({ section, title, codes }) => (
                  <div key={section} className="list-row">
                    <h4 className="font-serif text-ink">
                      Topic {section} -- {title}
                    </h4>
                    <div className="mt-3 flex flex-col gap-3">
                      {codes.map((code) => {
                        const row = byCode.get(code);
                        const disagrees =
                          !!row?.candidate_status && !!row?.tutor_status_stage2 && row.candidate_status !== row.tutor_status_stage2;
                        return (
                          <div key={code} className="border-b border-border-faint pb-3 last:border-none">
                            <p className="text-sm text-ink">
                              {code}
                              {CRITERIA_LABELS[code] ? ` -- ${CRITERIA_LABELS[code]}` : ""}
                              {disagrees ? (
                                <span className="ml-2 text-sm font-semibold text-status-warning-text" title="You and your tutor rated this differently">
                                  &ne;
                                </span>
                              ) : null}
                            </p>
                            <div className="mt-1 flex items-center gap-4">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-muted">You:</span>
                                <CriteriaRatingPill rating={row?.candidate_status ?? null} />
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-muted">Tutor:</span>
                                <CriteriaRatingPill rating={row?.tutor_status_stage2 ?? null} />
                              </div>
                            </div>
                            {CRITERIA_GUIDANCE[code] ? (
                              <details className="mt-2">
                                <summary className="cursor-pointer text-xs text-muted hover:text-primary">Guidance</summary>
                                <ul className="mt-1 flex flex-col gap-0.5 pl-4 text-xs text-muted">
                                  {CRITERIA_GUIDANCE[code].map((bullet, i) => (
                                    <li key={i} className="list-disc">
                                      {bullet}
                                    </li>
                                  ))}
                                </ul>
                              </details>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                <div className="list-row">
                  {record.trainee_signoff_stage2_at ? (
                    <p className="text-sm text-muted">
                      Signed by {record.stage2_candidate_signature_name ?? "you"} on {new Date(record.trainee_signoff_stage2_at).toLocaleString()}.
                    </p>
                  ) : !viewer?.signature_name ? (
                    <SetSignatureForm fullName={viewer?.full_name ?? ""} />
                  ) : (
                    <form action={signOffStage2}>
                      <p className="mb-2 text-sm text-ink">I have read and agree with the summarising comments above.</p>
                      <button type="submit" className="rounded-[6px] bg-primary px-4 py-2 font-medium text-primary-foreground">
                        Sign as {viewer.signature_name}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {finalReleased ? (
          <>
            {record.stage3_required ? (
              <div className={`sheet ${nextSheetGarnet() ? "sheet-garnet" : ""}`}>
                <h3 className="font-serif text-lg text-ink">Stage Three</h3>
                <div className="mt-3">
                  <p className="text-sm text-muted">Tutor&apos;s overall assessment</p>
                  <StandardRatingPill rating={record.stage3_tutor_overall} />
                </div>
                {record.stage3_tutor_notes ? (
                  <div className="mt-3">
                    <p className="text-sm text-muted">Summary and action points</p>
                    <p className="text-ink">{record.stage3_tutor_notes}</p>
                  </div>
                ) : null}
                {record.stage3_finalized_at ? (
                  <div className="mt-3 border-t border-border-faint pt-3">
                    {record.stage3_candidate_signed_at ? (
                      <p className="text-sm text-muted">
                        Signed by {record.stage3_candidate_signature_name} on {new Date(record.stage3_candidate_signed_at).toLocaleString()}.
                      </p>
                    ) : !viewer?.signature_name ? (
                      <SetSignatureForm fullName={viewer?.full_name ?? ""} />
                    ) : (
                      <form action={signOffStage3}>
                        <p className="mb-2 text-sm text-ink">I have read and agree with the summarising comments above.</p>
                        <button type="submit" className="rounded-[6px] bg-primary px-4 py-2 font-medium text-primary-foreground">
                          Sign as {viewer.signature_name}
                        </button>
                      </form>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Deliberately no grade reveal here -- Ramy: trainees must never
                see the real grade in-app, at any point, even at course end.
                It needs assessor approval first; what a trainee eventually
                gets is a separate provisional grade report (not yet
                designed/built), not this record. get_my_celta5_record()
                already nulls final_recommended_grade/overall_notes for a
                trainee at the data layer (migration 0034) -- this is just
                the matching UI, not the only enforcement. */}
            <div className={`sheet ${nextSheetGarnet() ? "sheet-garnet" : ""}`}>
              <h3 className="font-serif text-lg text-ink">Final report</h3>
              {record.final_report_released_at ? (
                <>
                  <p className="mt-2 text-sm text-muted">
                    Your final report is ready.
                  </p>
                  <a
                    href={`/api/celta5/${traineeId}/final-report`}
                    className="mt-3 inline-flex rounded-[6px] border border-border px-3 py-1.5 text-sm text-ink trainee-hover-fill"
                  >
                    Download final report
                  </a>
                  <p className="mt-3 text-xs text-muted">
                    Questions about your grade? Start by emailing your tutor -- most questions are resolved there.
                    If you&apos;re still unsatisfied, your centre&apos;s Internal Complaints Procedure is the next
                    step.
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-muted">
                  Your final grade is confirmed after your tutor&apos;s recommendation is reviewed by Cambridge
                  Assessment English. Your final report will be released here once that&apos;s complete --
                  typically some time after the course ends.
                </p>
              )}
            </div>

            <div className={`sheet ${nextSheetGarnet() ? "sheet-garnet" : ""}`}>
              {record.trainee_signoff_final_at ? (
                <p className="text-sm text-muted">
                  Signed by {record.final_candidate_signature_name ?? "you"} on {new Date(record.trainee_signoff_final_at).toLocaleString()}.
                </p>
              ) : (
                <FinalChecklistForm signatureName={viewer?.signature_name ?? null} fullName={viewer?.full_name ?? ""} />
              )}
            </div>
          </>
        ) : null}

        <div className={`sheet ${nextSheetGarnet() ? "sheet-garnet" : ""}`}>
          <p className="text-sm text-muted">Teaching practice</p>
          <div className="mt-2">
            <AssessedTpStatsBadge stats={assessedTpStats} byMode={assessedHoursByMode} />
          </div>
        </div>

        {(obsTasks ?? []).length > 0 ? (
          <div>
            <h3 className="font-serif text-lg text-ink">Observation tasks</h3>
            <p className="mt-1 text-sm text-muted">
              Directed observations your tutor has assigned -- submitting one also counts toward your 6-hour
              requirement below.
            </p>
            <div className="mt-3 flex flex-col gap-3">
              {(obsTasks ?? []).map((task, i) => {
                const submission = submissionByTaskId.get(task.id);
                return (
                  // Decorative teal/garnet alternation -- no status meaning
                  // of its own, same rule as everywhere else.
                  <div key={task.id} className={`sheet ${i % 2 === 1 ? "sheet-garnet" : ""}`}>
                    <p className="font-medium text-ink">{task.title}</p>
                    <p className="mt-1 text-sm text-muted">{task.instructions}</p>
                    {submission ? (
                      <div className="mt-3 border-t border-border-faint pt-3">
                        <p className="text-xs text-muted">Submitted {new Date(submission.submitted_at).toLocaleString()}</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{submission.response}</p>
                      </div>
                    ) : (
                      <ObservationTaskForm taskId={task.id} deliveryMode={course?.delivery_mode ?? undefined} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <div>
          <h3 className="font-serif text-lg text-ink">Observations of experienced teachers</h3>
          <p className="mt-1 text-sm text-muted">Log the 6 hours you spend observing experienced teachers (up to 3 filmed).</p>
          {course?.delivery_mode === "mixed"
            ? (() => {
                const hasF2f = (observations ?? []).some((o) => o.mode === "f2f");
                const hasOnline = (observations ?? []).some((o) => o.mode === "online");
                const covered = hasF2f && hasOnline;
                return (
                  <p className={`mt-1 text-sm ${covered ? "text-primary" : "text-status-warning-text"}`}>
                    Mixed-mode course: your observations should cover both face-to-face and online teaching.{" "}
                    {covered
                      ? "Both modes logged."
                      : !hasF2f && !hasOnline
                        ? "Neither mode logged yet."
                        : !hasF2f
                          ? "Face-to-face not logged yet."
                          : "Online not logged yet."}
                  </p>
                );
              })()
            : null}
          <div className="mt-3 flex flex-col gap-3">
            {observations?.map((o) => (
              <ObservationForm key={`${o.id}-${o.updated_at}`} observation={o} deliveryMode={course?.delivery_mode ?? undefined} />
            ))}
            <ObservationForm deliveryMode={course?.delivery_mode ?? undefined} />
          </div>
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
    supabase.from("courses").select("name, start_date, end_date, delivery_mode, total_hours").eq("id", trainee.course_id ?? "").maybeSingle(),
    getCachedCenter(trainee.center_id),
    supabase.from("celta5_matrix").select("*").eq("trainee_id", traineeId),
    supabase.from("celta5_records").select("*").eq("trainee_id", traineeId).maybeSingle(),
    supabase.from("attendance_absences").select("*").eq("trainee_id", traineeId).order("session_date"),
    supabase.from("observations").select("*").eq("trainee_id", traineeId).order("observation_date"),
    supabase.from("tp_lessons").select("id").eq("trainee_id", traineeId),
    supabase
      .from("assignments")
      .select("id, assignment_type, first_status, resubmission_status, first_own_work_confirmed, resubmission_own_work_confirmed, first_outcome_signed_at, resubmission_outcome_signed_at, final_grade")
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
    return (
      <div className="flex flex-col gap-4">
        {headerBlock}

        <div className="sheet">
          <p className="text-sm text-muted">Trajectory (estimated, informal)</p>
          <div className="mt-3">
            <TrajectoryGradientBars byDimension={trajectoryByDimension} />
          </div>
        </div>

        <div className="sheet sheet-garnet">
          <p className="text-sm text-muted">Attendance</p>
          <p className="mt-1 text-ink">
            {record.hours_attended ?? 0} / {course?.total_hours ?? 120} hrs
          </p>
        </div>

        {tasksBlock}

        {observationsBlock}

        <AssessedTpStatsBadge stats={assessedTpStats} byMode={assessedHoursByMode} />

        <AssignmentsSummary traineeId={traineeId} assignments={assignments ?? []} />
        <TpFeedbackSummary traineeId={traineeId} feedbackRows={tpFeedbackRows ?? []} />

        {record.stage1_strengths || record.stage1_action_plan ? (
          <div className="sheet">
            <h3 className="font-serif text-lg text-ink">Progress Record — Stage 1</h3>
            <ReadOnlyField label="Strengths" value={record.stage1_strengths} />
            <ReadOnlyField label="Action plan" value={record.stage1_action_plan} />
          </div>
        ) : null}

        <div>
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-serif text-lg text-ink">Progress Record — Stage 2: criteria ratings</h3>
            <span className="rounded-[6px] bg-accent px-2.5 py-1 text-xs font-medium text-ink">
              Candidate: {stage2CandidateRatedCount} of {CELTA_CRITERIA_CODES.length} · Tutor: {stage2TutorRatedCount} of{" "}
              {CELTA_CRITERIA_CODES.length}
            </span>
          </div>
          <div className="sheet sheet-garnet mt-3 overflow-hidden !p-0">
            <div className="list-row">
              <p className="text-sm text-muted">Tutor&apos;s overall assessment</p>
              <StandardRatingPill rating={record.stage2_tutor_overall} />
              {record.stage2_tutor_notes ? <p className="mt-2 text-ink">{record.stage2_tutor_notes}</p> : null}
            </div>
            {CELTA_CRITERIA_SECTIONS.map(({ section, title, codes }) => (
              <div key={section} className="list-row">
                <h4 className="font-serif text-ink">
                  Topic {section} -- {title}
                </h4>
                <div className="mt-3 flex flex-col gap-2">
                  {codes.map((code) => {
                    const mRow = matrixByCode.get(code);
                    const disagrees =
                      !!mRow?.candidate_status && !!mRow?.tutor_status_stage2 && mRow.candidate_status !== mRow.tutor_status_stage2;
                    return (
                      <div key={code} className="flex items-center justify-between gap-3 border-b border-border-faint pb-2 last:border-none">
                        <p className="text-sm text-ink">
                          {code}
                          {CRITERIA_LABELS[code] ? ` -- ${CRITERIA_LABELS[code]}` : ""}
                          {disagrees ? (
                            <span className="ml-2 text-sm font-semibold text-status-warning-text" title="Candidate and tutor ratings differ">
                              &ne;
                            </span>
                          ) : null}
                        </p>
                        <div className="flex shrink-0 items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted">Candidate:</span>
                            <CriteriaRatingPill rating={mRow?.candidate_status ?? null} />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted">Tutor:</span>
                            <CriteriaRatingPill rating={mRow?.tutor_status_stage2 ?? null} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {record.stage3_required ? (
          <div>
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-serif text-lg text-ink">Stage Three -- criteria ratings</h3>
              <span className="rounded-[6px] bg-accent px-2.5 py-1 text-xs font-medium text-ink">
                Tutor: {stage3TutorRatedCount} of {CELTA_CRITERIA_CODES.length}
              </span>
            </div>
            <div className="sheet mt-3 overflow-hidden !p-0">
              <div className="list-row">
                <p className="text-sm text-muted">Tutor&apos;s overall assessment</p>
                <StandardRatingPill rating={record.stage3_tutor_overall} />
                {record.stage3_tutor_notes ? <p className="mt-2 text-ink">{record.stage3_tutor_notes}</p> : null}
              </div>
              {CELTA_CRITERIA_SECTIONS.map(({ section, title, codes }) => (
                <div key={section} className="list-row">
                  <h4 className="font-serif text-ink">
                    Topic {section} -- {title}
                  </h4>
                  <div className="mt-3 flex flex-col gap-2">
                    {codes.map((code) => (
                      <div key={code} className="flex items-center justify-between gap-3 border-b border-border-faint pb-2 last:border-none">
                        <p className="text-sm text-ink">
                          {code}
                          {CRITERIA_LABELS[code] ? ` -- ${CRITERIA_LABELS[code]}` : ""}
                        </p>
                        <CriteriaRatingPill rating={matrixByCode.get(code)?.tutor_status_stage3 ?? null} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="sheet">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-serif text-lg text-ink">Final recommended grade</h3>
            {record.final_recommended_grade && record.final_recommended_grade !== "Withdrawn" && record.final_recommended_grade !== "Extension" && record.final_recommended_grade !== "Deferred" && record.trainer_signoff_final_at ? (
              <a
                href={`/api/celta5/${traineeId}/final-report`}
                className="shrink-0 rounded-[6px] border border-border px-3 py-1.5 text-sm text-ink trainee-hover-fill"
              >
                Download final report
              </a>
            ) : null}
          </div>
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

        {record.stage3_required && record.grade_review_tutor_comments ? (
          <div className="sheet sheet-garnet">
            <h3 className="font-serif text-lg text-ink">Information for the CELTA grade review</h3>
            <p className="mt-2 whitespace-pre-wrap text-ink">{record.grade_review_tutor_comments}</p>
          </div>
        ) : null}

        <div className="sheet sheet-garnet">
          <h3 className="font-serif text-lg text-ink">Final-day sign-off</h3>
          {record.trainee_signoff_final_at ? (
            <p className="mt-2 text-sm text-ink">
              Candidate signed {new Date(record.trainee_signoff_final_at).toLocaleString()}, confirming teaching
              practice, observations, written assignments, own work, and complete records.
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted">Not yet signed off by the candidate.</p>
          )}
        </div>

        <AbsencePanel absences={absences ?? []} hoursAttended={record.hours_attended} totalHours={course?.total_hours ?? 120} />

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

      {stageFlagSuggestions.length > 0 && (!record.stage1_completed_at || !record.stage3_required) ? (
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

      {record.stage3_required ? (
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
