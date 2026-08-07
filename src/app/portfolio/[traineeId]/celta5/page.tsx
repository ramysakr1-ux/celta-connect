import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import {
  CELTA_CRITERIA_SECTIONS,
  CRITERIA_LABELS,
  CRITERIA_GUIDANCE,
  CELTA_CRITERIA_CODES,
  computeCriteriaSuggestion,
  computeTrajectoryByDimension,
  addTpFeedbackCriteriaTags,
} from "@/lib/celta-criteria";
import { TrajectoryGradientBars } from "@/components/trajectory-gradient-bar";
import { AssignmentsSummary, TpFeedbackSummary, AssessedTpStatsBadge } from "@/app/dashboard/trainer/trainees/[id]/celta5/linked-progress";
import { CriteriaRatingPill, StandardRatingPill } from "@/lib/status-pill";
import { computeProgressIssues, computeAssessedTpStats } from "@/lib/course-progress";
import { SelfAssessmentForm } from "@/app/dashboard/trainee/celta5/self-assessment-form";
import { ObservationForm } from "@/app/dashboard/trainee/celta5/observation-form";
import { FinalChecklistForm } from "@/app/dashboard/trainee/celta5/final-checklist-form";
import { signOffStage2 } from "@/app/dashboard/trainee/actions";
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
import { computeSignatureLedger } from "@/lib/celta5-signatures";

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
// booklet-verified CELTA_CRITERIA_SECTIONS (41 codes) -- not the shorter
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
    const [{ data: recordRows }, { data: matrix }, { data: observations }, { data: timetableEvents }, { data: plans }, { data: assignments }] =
      await Promise.all([
        supabase.rpc("get_my_celta5_record"),
        supabase.rpc("get_my_celta5_matrix"),
        supabase.from("observations").select("*").eq("trainee_id", traineeId).order("observation_date"),
        viewer?.course_id
          ? supabase
              .from("course_timetable_events")
              .select("type, event_date, linked_tp_number, linked_assignment_type, title")
              .eq("course_id", viewer.course_id)
              .in("type", ["tp", "assignment_due", "resubmission_due"])
          : Promise.resolve({ data: [] }),
        supabase.from("plan_assignments").select("tp_number, tp_point_id, taught_at").eq("trainee_id", traineeId),
        supabase.from("assignments").select("assignment_type, first_status, resubmission_status").eq("trainee_id", traineeId),
      ]);
    const record = recordRows?.[0];

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

    const byCode = new Map((matrix ?? []).map((m) => [m.criteria_code, m]));
    const candidateRatedCount = CELTA_CRITERIA_CODES.filter((c) => byCode.get(c)?.candidate_status).length;
    const tutorRatedCount = CELTA_CRITERIA_CODES.filter((c) => byCode.get(c)?.tutor_status_stage2).length;
    const stage2Submitted = !!record.stage2_candidate_submitted_at;
    const stage1And2Released = !!record.stage2_completed_at;
    const finalReleased = !!record.trainer_signoff_final_at;

    const taughtTpNumbers = new Set((plans ?? []).filter((p) => p.taught_at).map((p) => p.tp_number));
    const assignmentStatusByType = new Map((assignments ?? []).map((a) => [a.assignment_type, a]));
    const progressIssues = computeProgressIssues({
      today: new Date().toISOString().slice(0, 10),
      timetableEvents: timetableEvents ?? [],
      taughtTpNumbers,
      assignmentStatusByType,
    });

    return (
      <div className="flex flex-col gap-4">
        <h2 className="font-serif text-xl text-ink">CELTA 5 record</h2>

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
            <h3 className="font-serif text-lg text-ink">Stage Two self-assessment</h3>
            <div className="mt-3">
              <SelfAssessmentForm />
            </div>
          </div>
        ) : !stage1And2Released ? (
          <div className="sheet">
            <h3 className="font-serif text-lg text-ink">Stage Two</h3>
            <p className="mt-2 text-muted">
              Your self-assessment was submitted {new Date(record.stage2_candidate_submitted_at!).toLocaleString()}.
              Your tutor is reviewing it -- your Stage One and Two record will appear here once they release it.
            </p>
          </div>
        ) : (
          <>
            {record.stage1_strengths || record.stage1_action_plan ? (
              <div className="sheet">
                <h3 className="font-serif text-lg text-ink">Stage One</h3>
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
              </div>
            ) : null}

            <div>
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-serif text-lg text-ink">Stage Two</h3>
                <span className="rounded-[6px] bg-accent px-2.5 py-1 text-xs font-medium text-ink">
                  You: {candidateRatedCount} of {CELTA_CRITERIA_CODES.length} · Tutor: {tutorRatedCount} of{" "}
                  {CELTA_CRITERIA_CODES.length}
                </span>
              </div>
              <div className="sheet mt-3 overflow-hidden !p-0">
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
                                <span className="ml-2 text-sm font-semibold text-gold" title="You and your tutor rated this differently">
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
                      You signed off on this on {new Date(record.trainee_signoff_stage2_at).toLocaleString()}.
                    </p>
                  ) : (
                    <form action={signOffStage2}>
                      <button type="submit" className="rounded-[6px] bg-primary px-4 py-2 font-medium text-primary-foreground">
                        I&apos;ve reviewed this and sign off
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
              <div className="sheet">
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
            <div className="sheet">
              <h3 className="font-serif text-lg text-ink">Final report</h3>
              {record.final_report_released_at ? (
                <>
                  <p className="mt-2 text-sm text-muted">
                    Your final report is ready.
                  </p>
                  <a
                    href={`/api/celta5/${traineeId}/final-report`}
                    className="mt-3 inline-flex rounded-[6px] border border-border px-3 py-1.5 text-sm text-ink hover:border-primary"
                  >
                    Download final report
                  </a>
                </>
              ) : (
                <p className="mt-2 text-sm text-muted">
                  Your final grade is confirmed after your tutor&apos;s recommendation is reviewed by Cambridge
                  Assessment English. Your final report will be released here once that&apos;s complete --
                  typically some time after the course ends.
                </p>
              )}
            </div>

            <div className="sheet">
              {record.trainee_signoff_final_at ? (
                <p className="text-sm text-muted">
                  You signed off on this on {new Date(record.trainee_signoff_final_at).toLocaleString()}.
                </p>
              ) : (
                <FinalChecklistForm />
              )}
            </div>
          </>
        ) : null}

        <div className="sheet">
          <p className="text-sm text-muted">Teaching practice</p>
          <div className="mt-2">
            <AssessedTpStatsBadge stats={assessedTpStats} />
          </div>
        </div>

        <div>
          <h3 className="font-serif text-lg text-ink">Observations of experienced teachers</h3>
          <p className="mt-1 text-sm text-muted">Log the 6 hours you spend observing experienced teachers (up to 3 filmed).</p>
          <div className="mt-3 flex flex-col gap-3">
            {observations?.map((o) => (
              <ObservationForm key={`${o.id}-${o.updated_at}`} observation={o} />
            ))}
            <ObservationForm />
          </div>
        </div>
      </div>
    );
  }

  // -- Staff / assessor view --
  const isEditableStaff = isStaff; // real trainer/admin session; assessor is view-only
  const { data: trainee } = await supabase.from("profiles").select("*").eq("id", traineeId).maybeSingle();
  if (!trainee || trainee.role !== "trainee") notFound();
  if (viewer?.role === "trainer" && trainee.course_id !== viewer.course_id) notFound();
  if (assessorCourseId && trainee.course_id !== assessorCourseId) notFound();

  const [
    { data: course },
    { data: center },
    { data: matrix },
    { data: record },
    { data: absences },
    { data: observations },
    { data: lessons },
    { data: assignments },
    { data: tpFeedbackRows },
    { data: planAssignments },
  ] = await Promise.all([
    supabase.from("courses").select("*").eq("id", trainee.course_id ?? "").maybeSingle(),
    supabase.from("centers").select("*").eq("id", trainee.center_id).maybeSingle(),
    supabase.from("celta5_matrix").select("*").eq("trainee_id", traineeId),
    supabase.from("celta5_records").select("*").eq("trainee_id", traineeId).maybeSingle(),
    supabase.from("attendance_absences").select("*").eq("trainee_id", traineeId).order("session_date"),
    supabase.from("observations").select("*").eq("trainee_id", traineeId).order("observation_date"),
    supabase.from("tp_lessons").select("id").eq("trainee_id", traineeId),
    supabase.from("assignments").select("*").eq("trainee_id", traineeId),
    supabase.from("tp_feedback").select("*").eq("trainee_id", traineeId),
    supabase.from("plan_assignments").select("tp_point_id, taught_at").eq("trainee_id", traineeId),
  ]);

  const lessonIds = (lessons ?? []).map((l) => l.id);
  const { data: criteriaTags } =
    lessonIds.length > 0
      ? await supabase.from("tp_lesson_criteria_tags").select("*").in("tp_lesson_id", lessonIds).order("created_at")
      : { data: [] };

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

  const tagsByCriteria = new Map<string, { tag_type: "strength" | "action_point"; created_at: string }[]>();
  for (const tag of criteriaTags ?? []) {
    const list = tagsByCriteria.get(tag.criteria_code) ?? [];
    list.push({ tag_type: tag.tag_type, created_at: tag.created_at });
    tagsByCriteria.set(tag.criteria_code, list);
  }
  addTpFeedbackCriteriaTags(tagsByCriteria, tpFeedbackRows ?? []);

  const suggestions: Record<string, "S+" | "S" | "N"> = {};
  for (const code of CELTA_CRITERIA_CODES) {
    const suggestion = computeCriteriaSuggestion(tagsByCriteria.get(code) ?? []);
    if (suggestion) suggestions[code] = suggestion;
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

  const headerBlock = (
    <div>
      <h2 className="font-serif text-xl text-ink">CELTA 5 record</h2>
      <div className="mt-3 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
        <div>
          <p className="text-muted">Centre</p>
          <p className="text-ink">{center?.name ?? "--"}</p>
        </div>
        <div>
          <p className="text-muted">Course</p>
          <p className="text-ink">{course?.name ?? "--"}</p>
        </div>
        <div>
          <p className="text-muted">Dates</p>
          <p className="text-ink">{course ? `${course.start_date} → ${course.end_date}` : "--"}</p>
        </div>
      </div>
    </div>
  );

  // Section 5 requirement: 6 hours total, but filmed observations only ever
  // count for up to 3 of those 6 -- the remaining hours must be live.
  const OBSERVATION_HOURS_REQUIRED = 6;
  const OBSERVATION_FILMED_CAP_MINUTES = 3 * 60;
  const liveMinutes = (observations ?? []).filter((o) => !o.filmed).reduce((sum, o) => sum + (o.length_minutes ?? 0), 0);
  const filmedMinutes = (observations ?? []).filter((o) => o.filmed).reduce((sum, o) => sum + (o.length_minutes ?? 0), 0);
  const filmedCountedMinutes = Math.min(filmedMinutes, OBSERVATION_FILMED_CAP_MINUTES);
  const observationHoursCounted = (liveMinutes + filmedCountedMinutes) / 60;
  const observationLivePct = Math.min(100, (liveMinutes / 60 / OBSERVATION_HOURS_REQUIRED) * 100);
  const observationFilmedPct = Math.min(100 - observationLivePct, (filmedCountedMinutes / 60 / OBSERVATION_HOURS_REQUIRED) * 100);

  const observationsBlock = (
    <div>
      <h3 className="font-serif text-lg text-ink">Observations of experienced teachers (self-reported)</h3>
      <div className="mt-2">
        <p className="text-sm text-ink">
          {observationHoursCounted.toFixed(1)} of {OBSERVATION_HOURS_REQUIRED} hrs counted · {(liveMinutes / 60).toFixed(1)} hrs live
          {filmedMinutes > 0 ? ` · ${(filmedMinutes / 60).toFixed(1)} hrs filmed (capped at 3)` : ""}
        </p>
        <div className="mt-1.5 flex h-1.5 w-full overflow-hidden rounded-full bg-accent">
          <div className="h-full bg-primary" style={{ width: `${observationLivePct}%` }} />
          <div className="h-full bg-gold" style={{ width: `${observationFilmedPct}%` }} />
        </div>
      </div>
      <div className="sheet mt-3 overflow-hidden !p-0">
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

        <div className="sheet">
          <p className="text-sm text-muted">Attendance</p>
          <p className="mt-1 text-ink">
            {record.hours_attended ?? 0} / {course?.total_hours ?? 120} hrs
          </p>
        </div>

        {observationsBlock}

        <AssessedTpStatsBadge stats={assessedTpStats} />

        <AssignmentsSummary traineeId={traineeId} assignments={assignments ?? []} />
        <TpFeedbackSummary traineeId={traineeId} feedbackRows={tpFeedbackRows ?? []} />

        {record.stage1_strengths || record.stage1_action_plan ? (
          <div className="sheet">
            <h3 className="font-serif text-lg text-ink">Stage One</h3>
            <ReadOnlyField label="Strengths" value={record.stage1_strengths} />
            <ReadOnlyField label="Action plan" value={record.stage1_action_plan} />
          </div>
        ) : null}

        <div>
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-serif text-lg text-ink">Stage Two -- criteria ratings</h3>
            <span className="rounded-[6px] bg-accent px-2.5 py-1 text-xs font-medium text-ink">
              Candidate: {stage2CandidateRatedCount} of {CELTA_CRITERIA_CODES.length} · Tutor: {stage2TutorRatedCount} of{" "}
              {CELTA_CRITERIA_CODES.length}
            </span>
          </div>
          <div className="sheet mt-3 overflow-hidden !p-0">
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
                            <span className="ml-2 text-sm font-semibold text-gold" title="Candidate and tutor ratings differ">
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
            {record.final_recommended_grade && record.final_recommended_grade !== "Withdrawn" && record.trainer_signoff_final_at ? (
              <a
                href={`/api/celta5/${traineeId}/final-report`}
                className="shrink-0 rounded-[6px] border border-border px-3 py-1.5 text-sm text-ink hover:border-primary"
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
          <div className="sheet">
            <h3 className="font-serif text-lg text-ink">Information for the CELTA grade review</h3>
            <p className="mt-2 whitespace-pre-wrap text-ink">{record.grade_review_tutor_comments}</p>
          </div>
        ) : null}

        <div className="sheet">
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

      {observationsBlock}

      <AssessedTpStatsBadge stats={assessedTpStats} />

      <AssignmentsSummary traineeId={traineeId} assignments={assignments ?? []} />
      <TpFeedbackSummary traineeId={traineeId} feedbackRows={tpFeedbackRows ?? []} />

      <Stage1Form key={`stage1-${record.updated_at}`} record={record} />

      <div>
        <h3 className="font-serif text-lg text-ink">Stage Two -- criteria ratings</h3>
        <div className="mt-3">
          <StageRatingsForm key={`s2-${matrixKey}`} stage={2} traineeId={traineeId} rows={matrixRows} suggestions={suggestions} />
        </div>
      </div>

      <Stage2OverallForm key={`stage2-${record.updated_at}`} record={record} />

      <div>
        <h3 className="font-serif text-lg text-ink">Stage Three -- criteria ratings</h3>
        <div className="mt-3">
          <StageRatingsForm key={`s3-${matrixKey}`} stage={3} traineeId={traineeId} rows={matrixRows} />
        </div>
      </div>

      <Stage3OverallForm key={`stage3-${record.updated_at}`} record={record} />

      {record.stage3_required ? (
        <GradeReviewCommentsForm key={`grade-review-${record.updated_at}`} record={record} />
      ) : null}

      {record.final_recommended_grade && record.final_recommended_grade !== "Withdrawn" && record.trainer_signoff_final_at ? (
        <div className="sheet flex items-center justify-between gap-3">
          <p className="text-ink">Final report ready to download.</p>
          <a
            href={`/api/celta5/${traineeId}/final-report`}
            className="shrink-0 rounded-[6px] border border-border px-3 py-1.5 text-sm text-ink hover:border-primary"
          >
            Download final report
          </a>
        </div>
      ) : null}

      <FinalGradeForm key={`final-${record.updated_at}`} record={record} />

      <FinalizeRecordForm key={`finalize-${record.updated_at}`} record={record} />

      {record.final_recommended_grade && record.final_recommended_grade !== "Withdrawn" && record.trainer_signoff_final_at ? (
        <ReleaseFinalReportForm key={`release-${record.updated_at}`} record={record} />
      ) : null}

      <AdminGrantForm key={`admin-grant-${record.updated_at}`} record={record} />

      <SignatureLedger rows={signatureLedger} traineeId={traineeId} />
    </div>
  );
}
