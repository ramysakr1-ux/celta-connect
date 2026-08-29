import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import {
  computeCriteriaSuggestion,
  computeAttentionFlags,
  computeTrajectory,
  addTpFeedbackCriteriaTags,
  CELTA_CRITERIA_CODES,
} from "@/lib/celta-criteria";
import { computeCurrentTpRound } from "@/lib/course-progress";
import { toLocalIso, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";
import { getCachedCenter } from "@/lib/supabase/cached-queries";
import { AssignmentsSummary, TpFeedbackSummary } from "@/app/dashboard/trainer/trainees/[id]/celta5/linked-progress";
import { Stage1Form } from "@/app/dashboard/trainer/trainees/[id]/celta5/stage1-form";
import { Stage1ReleaseForm } from "@/app/dashboard/trainer/trainees/[id]/celta5/stage1-release-form";
import { StageRatingsForm } from "@/app/dashboard/trainer/trainees/[id]/celta5/stage-ratings-form";
import { Stage2OverallForm } from "@/app/dashboard/trainer/trainees/[id]/celta5/stage2-overall-form";
import { Stage3OverallForm } from "@/app/dashboard/trainer/trainees/[id]/celta5/stage3-overall-form";
import { GradeReviewCommentsForm } from "@/app/dashboard/trainer/trainees/[id]/celta5/grade-review-comments-form";
import { ReleaseFinalReportForm } from "@/app/dashboard/trainer/trainees/[id]/celta5/release-final-report-form";
import { FinalGradeForm } from "@/app/dashboard/trainer/trainees/[id]/celta5/final-grade-form";
import { AttendanceForm } from "@/app/dashboard/trainer/trainees/[id]/celta5/attendance-form";
import { BookletSection } from "@/app/portfolio/[traineeId]/celta5/booklet/shell";
import { ObservationsRecord, AssessedTpRecord } from "@/app/portfolio/[traineeId]/celta5/booklet/records";
import { AdminGrantForm } from "@/app/dashboard/trainer/trainees/[id]/celta5/admin-grant-form";
import { FinalizeRecordForm } from "@/app/dashboard/trainer/trainees/[id]/celta5/finalize-record-form";
import { isFailRiskTriggered, buildFailRiskDraft } from "@/lib/letters/fail-risk";
import { FailRiskLetterSection } from "@/app/dashboard/trainer/trainees/[id]/celta5/fail-risk-letter-section";
import { isReferenceLetterEligible, buildReferenceLetterDraft } from "@/lib/letters/reference";
import { ReferenceLetterSection } from "@/app/dashboard/trainer/trainees/[id]/celta5/reference-letter-section";
import { computeStage3MixedModeLock } from "@/lib/delivery-mode";

const TRAJECTORY_LABEL: Record<string, string> = {
  "Pass A": "Pass A",
  "Pass B": "Pass B",
  Pass: "Pass",
  Fail: "Fail",
  not_enough_data: "Not enough data yet",
};

export default async function Celta5RecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const trainer = await requireRole("trainer");
  const supabase = await createClient();

  const { data: trainee } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!trainee || trainee.course_id !== trainer.course_id || trainee.role !== "trainee") {
    notFound();
  }

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
    { data: tpEvents },
  ] = await Promise.all([
    supabase.from("courses").select("name, start_date, end_date, delivery_mode, total_hours").eq("id", trainer.course_id ?? "").maybeSingle(),
    getCachedCenter(trainer.center_id),
    supabase.from("celta5_matrix").select("*").eq("trainee_id", id),
    supabase.from("celta5_records").select("*").eq("trainee_id", id).maybeSingle(),
    supabase.from("attendance_absences").select("*").eq("trainee_id", id).order("session_date"),
    supabase.from("observations").select("*").eq("trainee_id", id).order("observation_date"),
    // Was select("id") -- enough for a count, not enough to print the
    // record of assessed teaching practice, which is Cambridge's Section 7
    // and now renders on this page too.
    supabase
      .from("tp_lessons")
      .select("id, lesson_date, length_minutes, level, learner_count, lesson_focus, tutor_assessment")
      .eq("trainee_id", id)
      .order("lesson_date"),
    supabase
      .from("assignments")
      .select("id, assignment_type, first_status, resubmission_status, first_own_work_confirmed, resubmission_own_work_confirmed, final_grade")
      .eq("trainee_id", id),
    supabase.from("tp_feedback").select("*").eq("trainee_id", id),
    supabase
      .from("course_timetable_events")
      .select("type, event_date, linked_tp_number, mode")
      .eq("course_id", trainer.course_id ?? "")
      .eq("type", "tp"),
  ]);

  // connect-spec-corrections-for-claude-code.md item 1 (Handbook 10.2):
  // mixed-mode + Stage 3 given + borderline Fail/Pass -- the final two
  // assessed TP lessons must share one mode. Same half -> halfTpDates ->
  // event.mode bridge computeAssessedHoursByMode already uses elsewhere.
  const [{ data: subgroupMember }, { data: planAssignments }] = await Promise.all([
    supabase.from("course_subgroup_members").select("subgroup_id").eq("trainee_id", id).maybeSingle(),
    supabase.from("plan_assignments").select("tp_number").eq("trainee_id", id),
  ]);
  const { data: subgroupForMode } = subgroupMember?.subgroup_id
    ? await supabase.from("course_subgroups").select("half_order").eq("id", subgroupMember.subgroup_id).maybeSingle()
    : { data: null };

  // assessment-model.md link 3: which TP round the COHORT has reached,
  // not this one trainee's own pace -- see computeCurrentTpRound().
  const currentTpRound = computeCurrentTpRound(tpEvents ?? [], toLocalIso(new Date(), center?.time_zone ?? DEFAULT_TIMEZONE));

  const lessonIds = (lessons ?? []).map((l) => l.id);
  const { data: criteriaTags } =
    lessonIds.length > 0
      ? await supabase
          .from("tp_lesson_criteria_tags")
          .select("*")
          .in("tp_lesson_id", lessonIds)
          .order("created_at")
      : { data: [] };

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
      <div className="card p-6">
        <p className="text-muted">
          No CELTA 5 record exists for this trainee yet. It&apos;s created automatically
          when they&apos;re invited -- if this trainee predates that, an admin will need
          to add it manually.
        </p>
      </div>
    );
  }

  const stage3MixedModeLock = computeStage3MixedModeLock({
    deliveryMode: course?.delivery_mode ?? null,
    stage3Required: record.stage3_tutorial_required,
    stage3FinalizedAt: record.stage3_finalized_at,
    provisionalGrade: record.provisional_grade,
    provisionalGradeUpper: record.provisional_grade_upper,
    totalAssessedTpCount: (planAssignments ?? []).length,
    halfOrder: subgroupForMode?.half_order === 1 || subgroupForMode?.half_order === 2 ? subgroupForMode.half_order : null,
    tpEvents: tpEvents ?? [],
  });

  const matrixRows = matrix ?? [];
  const matrixKey = matrixRows.map((m) => m.updated_at).join(",");
  const matrixByCode = new Map(matrixRows.map((m) => [m.criteria_code, m]));

  const trajectoryInputs = CELTA_CRITERIA_CODES.map(
    (code) => matrixByCode.get(code)?.tutor_status_stage2 ?? suggestions[code] ?? null
  );
  const trajectory = computeTrajectory(trajectoryInputs);

  return (
    <div className="flex flex-col gap-6">
      {/* Trainer-only working header. Deliberately outside the booklet: it
          is Connect's own chrome, and an assessor reading over a tutor's
          shoulder should be able to tell the document from the tools. */}
      <div className="card p-6">
        <h1 className="font-serif text-xl text-ink">{trainee.full_name}</h1>
        <p className="mt-1 text-muted">{trainee.email}</p>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
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
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={`/trainer/grade-query-reply/${id}`}
            className="inline-flex rounded-[6px] border border-border px-3 py-1.5 text-xs font-medium text-ink hover:border-primary"
          >
            Grade query reply →
          </Link>
        </div>
        <p className="mt-4 text-sm text-muted">
          Trajectory (trainer-only, estimated -- never shown to the trainee, never sets the real final grade)
        </p>
        <p className="mt-1 font-serif text-xl text-ink">{TRAJECTORY_LABEL[trajectory]}</p>
      </div>

      <AssignmentsSummary traineeId={id} assignments={assignments ?? []} />
      <TpFeedbackSummary traineeId={id} feedbackRows={tpFeedbackRows ?? []} />

      {/* The booklet. Same document the candidate and the assessor see, in
          Cambridge's order, with the tutor's own parts editable in the
          section they belong to rather than stacked in a separate list.
          Ramy, 29 Aug 2026: "let's fix the delta five for the trainer.
          It's very important." */}
      <div className="c5-doc">
        <BookletSection id="c5-attendance" title="Record of attendance">
          <AttendanceForm
            key={`attendance-${record.updated_at}`}
            record={record}
            totalHours={course?.total_hours ?? 120}
            absences={absences ?? []}
          />
        </BookletSection>

        <BookletSection
          id="c5-observations"
          title="Record of observations of experienced classroom teachers (including filmed observations)"
        >
          <ObservationsRecord
            rows={(observations ?? []).map((o) => ({
              date: o.observation_date ?? "",
              minutes: o.length_minutes,
              level: o.level ?? "",
              learners: o.learners_present,
              focus: o.lesson_focus ?? "",
              kind: o.filmed ? "Filmed" : "Experienced teacher",
            }))}
          />
          <p className="mt-2 text-[10px] text-muted">
            Self-reported by the candidate. Nothing here is editable by a tutor -- the hours count toward the six-hour
            requirement as logged.
          </p>
        </BookletSection>

        <BookletSection id="c5-tp" title="Record of assessed teaching practice">
          <AssessedTpRecord
            rows={(lessons ?? []).map((l) => ({
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
            }))}
          />
        </BookletSection>

        <BookletSection id="c5-stage1" num="Section 9" title="Stage One progress record">
          <Stage1Form
            key={`stage1-${record.updated_at}`}
            record={record}
            trainerFullName={trainer.full_name}
            trainerSignatureName={trainer.signature_name}
          />
          <div className="mt-4">
            <Stage1ReleaseForm
              key={`stage1-release-${record.updated_at}`}
              traineeId={id}
              completedAt={record.stage1_completed_at}
              releasedAt={record.stage1_released_at}
              candidateSignedAt={record.stage1_candidate_signed_at}
            />
          </div>
        </BookletSection>

        <BookletSection id="c5-stage2" num="Section 10" title="Stage Two progress record">
          <StageRatingsForm
            key={`s2-${matrixKey}`}
            stage={2}
            traineeId={id}
            rows={matrixRows}
            suggestions={suggestions}
            attentionFlags={attentionFlags}
            currentTpRound={currentTpRound}
          />
          <div className="mt-4">
            <Stage2OverallForm
              key={`stage2-${record.updated_at}`}
              record={record}
              trainerFullName={trainer.full_name}
              trainerSignatureName={trainer.signature_name}
            />
          </div>
        </BookletSection>

        <BookletSection id="c5-stage3" num="Section 11" title="Stage Three progress record">
          <p className="text-[10px] leading-relaxed text-muted" style={{ marginBottom: 10 }}>
            This record must be completed by tutors in the final third of the course for all candidates who: a) were
            not to standard at Stage 2; b) were at standard at Stage 2 but are not making the expected progress in the
            second half of the course; c) were above standard at Stage 2 but are not making the expected progress in
            the second half of the course. A tutorial must be given and the whole record completed.
          </p>
          <StageRatingsForm
            key={`s3-${matrixKey}`}
            stage={3}
            traineeId={id}
            rows={matrixRows}
            attentionFlags={attentionFlags}
            currentTpRound={currentTpRound}
          />
          <div className="mt-4">
            <Stage3OverallForm
              key={`stage3-${record.updated_at}`}
              record={record}
              trainerFullName={trainer.full_name}
              trainerSignatureName={trainer.signature_name}
            />
          </div>
          {stage3MixedModeLock ? (
            <div className={`card mt-4 p-4 ${stage3MixedModeLock.mismatched ? "card-red" : "card-amber"}`}>
              <p
                className={`text-sm font-semibold ${
                  stage3MixedModeLock.mismatched ? "text-destructive" : "text-status-warning-text"
                }`}
              >
                Handbook 10.2 -- borderline Pass/Fail on a mixed-mode course
              </p>
              <p className="mt-1 text-sm text-muted">
                The final two assessed lessons (TP{stage3MixedModeLock.lastTwoTpNumbers[0]} and TP
                {stage3MixedModeLock.lastTwoTpNumbers[1]}) must both be in the same mode.{" "}
                {stage3MixedModeLock.mismatched
                  ? `The timetable currently has them in different modes (${stage3MixedModeLock.modes.join(
                      " / "
                    )}) -- re-tag one round before they're taught.`
                  : stage3MixedModeLock.modes.every((m) => m)
                    ? `The timetable already has both in ${stage3MixedModeLock.modes[0]} -- no change needed.`
                    : "One or both rounds aren't tagged with a mode yet -- set it on the timetable before they're taught."}
              </p>
            </div>
          ) : null}
        </BookletSection>

        <BookletSection id="c5-final" num="Section 12" title="To be completed on the final day of the course">
          <FinalGradeForm key={`final-${record.updated_at}`} record={record} />
          <div className="mt-4">
            <FinalizeRecordForm
              key={`finalize-${record.updated_at}`}
              record={record}
              trainerFullName={trainer.full_name}
              trainerSignatureName={trainer.signature_name}
            />
          </div>
          {record.final_recommended_grade &&
          record.final_recommended_grade !== "Withdrawn" &&
          record.final_recommended_grade !== "Extension" &&
          record.final_recommended_grade !== "Deferred" &&
          record.trainer_signoff_final_at ? (
            <div className="mt-4">
              <ReleaseFinalReportForm key={`release-${record.updated_at}`} record={record} />
            </div>
          ) : null}

          {/* Cambridge prints the grade-review box on this page. Shown when a
              Stage Three tutorial applies, which is when a portfolio is most
              likely to go to Cambridge English. */}
          {record.stage3_tutorial_required ? (
            <div className="mt-6">
              <GradeReviewCommentsForm key={`grade-review-${record.updated_at}`} record={record} />
            </div>
          ) : null}
        </BookletSection>
      </div>

      {/* Trainer-only operational controls. No equivalent in Cambridge's
          document, so they sit outside it rather than inside a section. */}
      {isFailRiskTriggered(record) ? (
        <FailRiskLetterSection
          traineeId={id}
          draft={(await buildFailRiskDraft(supabase, trainer.course_id ?? "", id, trainer.full_name))?.input ?? null}
          existingLetters={
            (
              await supabase
                .from("formal_letters")
                .select("id, issued_at, acknowledged_at")
                .eq("trainee_id", id)
                .eq("letter_type", "fail_risk")
                .order("issued_at", { ascending: false })
            ).data ?? []
          }
        />
      ) : null}

      {isReferenceLetterEligible(record) ? (
        <ReferenceLetterSection
          traineeId={id}
          draft={(await buildReferenceLetterDraft(supabase, trainer.course_id ?? "", id, trainer.full_name))?.input ?? null}
          canGenerate={trainer.role === "admin" || trainer.tutor_role === "main_course_tutor"}
          existingLetters={
            (
              await supabase
                .from("formal_letters")
                .select("id, issued_at")
                .eq("trainee_id", id)
                .eq("letter_type", "reference")
                .order("issued_at", { ascending: false })
            ).data ?? []
          }
        />
      ) : null}

      <AdminGrantForm key={`admin-grant-${record.updated_at}`} record={record} />
    </div>
  );
}
