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
import { toLocalIso } from "@/lib/timetable-grid";
import { AssignmentsSummary, TpFeedbackSummary } from "@/app/dashboard/trainer/trainees/[id]/celta5/linked-progress";
import { Stage1Form } from "@/app/dashboard/trainer/trainees/[id]/celta5/stage1-form";
import { StageRatingsForm } from "@/app/dashboard/trainer/trainees/[id]/celta5/stage-ratings-form";
import { Stage2OverallForm } from "@/app/dashboard/trainer/trainees/[id]/celta5/stage2-overall-form";
import { Stage3OverallForm } from "@/app/dashboard/trainer/trainees/[id]/celta5/stage3-overall-form";
import { GradeReviewCommentsForm } from "@/app/dashboard/trainer/trainees/[id]/celta5/grade-review-comments-form";
import { ReleaseFinalReportForm } from "@/app/dashboard/trainer/trainees/[id]/celta5/release-final-report-form";
import { FinalGradeForm } from "@/app/dashboard/trainer/trainees/[id]/celta5/final-grade-form";
import { AttendanceForm } from "@/app/dashboard/trainer/trainees/[id]/celta5/attendance-form";
import { AdminGrantForm } from "@/app/dashboard/trainer/trainees/[id]/celta5/admin-grant-form";
import { FinalizeRecordForm } from "@/app/dashboard/trainer/trainees/[id]/celta5/finalize-record-form";
import { isFailRiskTriggered, buildFailRiskDraft } from "@/lib/letters/fail-risk";
import { FailRiskLetterSection } from "@/app/dashboard/trainer/trainees/[id]/celta5/fail-risk-letter-section";
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
    { data: center },
    { data: matrix },
    { data: record },
    { data: absences },
    { data: observations },
    { data: lessons },
    { data: assignments },
    { data: tpFeedbackRows },
    { data: tpEvents },
  ] = await Promise.all([
    supabase.from("courses").select("*").eq("id", trainer.course_id ?? "").maybeSingle(),
    supabase.from("centers").select("*").eq("id", trainer.center_id).maybeSingle(),
    supabase.from("celta5_matrix").select("*").eq("trainee_id", id),
    supabase.from("celta5_records").select("*").eq("trainee_id", id).maybeSingle(),
    supabase.from("attendance_absences").select("*").eq("trainee_id", id).order("session_date"),
    supabase.from("observations").select("*").eq("trainee_id", id).order("observation_date"),
    supabase.from("tp_lessons").select("id").eq("trainee_id", id),
    supabase.from("assignments").select("*").eq("trainee_id", id),
    supabase.from("tp_feedback").select("*").eq("trainee_id", id),
    supabase
      .from("course_timetable_events")
      .select("type, event_date, linked_tp_number, mode")
      .eq("course_id", trainer.course_id ?? "")
      .eq("type", "tp"),
  ]);

  // connect-spec-corrections-for-claude-code.md item 1 (Handbook 9.2):
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
  const currentTpRound = computeCurrentTpRound(tpEvents ?? [], toLocalIso(new Date()));

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
    stage3Required: record.stage3_required,
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
            <p className="text-ink">
              {course ? `${course.start_date} → ${course.end_date}` : "--"}
            </p>
          </div>
        </div>
        <Link
          href={`/trainer/grade-query-reply/${id}`}
          className="mt-4 inline-flex self-start rounded-[6px] border border-border px-3 py-1.5 text-xs font-medium text-ink hover:border-primary"
        >
          Grade query reply →
        </Link>
      </div>

      <div className="card p-6">
        <p className="text-sm text-muted">
          Trajectory (trainer-only, estimated -- never shown to the trainee, never sets the
          real final grade)
        </p>
        <p className="mt-1 font-serif text-xl text-ink">{TRAJECTORY_LABEL[trajectory]}</p>
      </div>

      <AttendanceForm
        key={`attendance-${record.updated_at}`}
        record={record}
        totalHours={course?.total_hours ?? 120}
        absences={absences ?? []}
      />

      <div>
        <h2 className="font-serif text-lg text-ink">
          Observations of experienced teachers (self-reported)
        </h2>
        <div className="card mt-3 overflow-hidden">
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
                    <td className="text-muted">
                      {o.length_minutes ? `${o.length_minutes} min` : "--"}
                    </td>
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

      <AssignmentsSummary traineeId={id} assignments={assignments ?? []} />
      <TpFeedbackSummary traineeId={id} feedbackRows={tpFeedbackRows ?? []} />

      <Stage1Form key={`stage1-${record.updated_at}`} record={record} />

      <div>
        <h2 className="font-serif text-lg text-ink">Progress Record — Stage 2: criteria ratings</h2>
        <div className="mt-3">
          <StageRatingsForm
            key={`s2-${matrixKey}`}
            stage={2}
            traineeId={id}
            rows={matrixRows}
            suggestions={suggestions}
            attentionFlags={attentionFlags}
            currentTpRound={currentTpRound}
          />
        </div>
      </div>

      <Stage2OverallForm key={`stage2-${record.updated_at}`} record={record} />

      <div>
        <h2 className="font-serif text-lg text-ink">Stage Three -- criteria ratings</h2>
        <div className="mt-3">
          <StageRatingsForm
            key={`s3-${matrixKey}`}
            stage={3}
            traineeId={id}
            rows={matrixRows}
            attentionFlags={attentionFlags}
            currentTpRound={currentTpRound}
          />
        </div>
      </div>

      <Stage3OverallForm key={`stage3-${record.updated_at}`} record={record} />

      {stage3MixedModeLock ? (
        <div className={`card p-4 ${stage3MixedModeLock.mismatched ? "border-destructive" : "border-gold"}`}>
          <p className={`text-sm font-semibold ${stage3MixedModeLock.mismatched ? "text-destructive" : "text-gold"}`}>
            Handbook 9.2 -- borderline Pass/Fail on a mixed-mode course
          </p>
          <p className="mt-1 text-sm text-muted">
            The final two assessed lessons (TP{stage3MixedModeLock.lastTwoTpNumbers[0]} and TP
            {stage3MixedModeLock.lastTwoTpNumbers[1]}) must both be in the same mode.{" "}
            {stage3MixedModeLock.mismatched
              ? `The timetable currently has them in different modes (${stage3MixedModeLock.modes.join(" / ")}) -- re-tag one round before they're taught.`
              : stage3MixedModeLock.modes.every((m) => m)
                ? `The timetable already has both in ${stage3MixedModeLock.modes[0]} -- no change needed.`
                : "One or both rounds aren't tagged with a mode yet -- set it on the timetable before they're taught."}
          </p>
        </div>
      ) : null}

      {record.stage3_required ? (
        <GradeReviewCommentsForm key={`grade-review-${record.updated_at}`} record={record} />
      ) : null}

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

      <FinalGradeForm key={`final-${record.updated_at}`} record={record} />

      <FinalizeRecordForm key={`finalize-${record.updated_at}`} record={record} />

      {record.final_recommended_grade && record.final_recommended_grade !== "Withdrawn" && record.final_recommended_grade !== "Extension" && record.final_recommended_grade !== "Deferred" && record.trainer_signoff_final_at ? (
        <ReleaseFinalReportForm key={`release-${record.updated_at}`} record={record} />
      ) : null}

      <AdminGrantForm key={`admin-grant-${record.updated_at}`} record={record} />
    </div>
  );
}
