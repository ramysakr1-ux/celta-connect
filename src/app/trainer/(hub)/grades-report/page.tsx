import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { computeStrengthsAndActionPoints } from "@/lib/celta-criteria";
import { computeAssessedTpStats } from "@/lib/course-progress";
import { computeSignatureLedger, isBookletExportReady } from "@/lib/celta5-signatures";
import { mapTpFeedbackToGlyphRow } from "@/lib/tp-grades";
import { ASSIGNMENT_INFO } from "@/lib/assignment-info";
import { ProvisionalGradeForm } from "@/app/trainer/(hub)/grades-report/provisional-grade-form";
import { UpgradeConditionsForm } from "@/app/trainer/(hub)/grades-report/upgrade-conditions-form";
import { CohortSheet, type CohortSheetRow } from "@/app/trainer/(hub)/grades-report/cohort-sheet";
import { FinalGradeForm } from "@/app/dashboard/trainer/trainees/[id]/celta5/final-grade-form";
import { StandardRatingGlyph } from "@/lib/status-pill";
import type { CriteriaRating, Database } from "@/lib/supabase/types";

type Celta5Record = Database["public"]["Tables"]["celta5_records"]["Row"];

// Assessor-facing compiled Grades Report -- the whole cohort in one
// continuous document, matching the shape of a real center's actual
// "Grades Report" (traced from a filled example, 5 Aug 2026), plus the
// design reference's own "grade review meeting view" (Grades Report.dc.html
// 1a): a compact cohort sheet up top -- TP1-8 trajectory, provisional,
// recommended, what's still outstanding -- with the existing per-candidate
// detail below it for the actual editing.
export default async function GradesReportPage() {
  const session = await getCurrentProfile();
  const trainer = session?.profile?.role === "trainer" || session?.profile?.role === "admin" ? session.profile : null;
  const assessorCourseId = !trainer ? await getAssessorCourseId() : null;
  if (!trainer && !assessorCourseId) redirect("/login");

  const supabase = assessorCourseId ? createAdminClient() : await createClient();
  const courseId = trainer?.course_id ?? assessorCourseId;
  if (!courseId) {
    return <div className="sheet p-6 text-sm text-muted">No course assigned.</div>;
  }

  const { data: course } = await supabase.from("courses").select("name").eq("id", courseId).maybeSingle();

  const { data: trainees } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("course_id", courseId)
    .eq("role", "trainee")
    .order("full_name");

  const traineeIds = (trainees ?? []).map((t) => t.id);
  const [{ data: records }, { data: matrixRows }, { data: tpFeedbackRows }, { data: assignments }, { data: planAssignments }] =
    traineeIds.length > 0
      ? await Promise.all([
          supabase.from("celta5_records").select("*").eq("course_id", courseId),
          supabase
            .from("celta5_matrix")
            .select("trainee_id, criteria_code, tutor_status_stage2, tutor_status_stage3")
            .eq("course_id", courseId),
          supabase.from("tp_feedback").select("trainee_id, tp_number, grade, submitted_at").in("trainee_id", traineeIds),
          supabase.from("assignments").select("*").in("trainee_id", traineeIds),
          supabase.from("plan_assignments").select("trainee_id, tp_point_id, taught_at").eq("course_id", courseId),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const tpPointIds = [
    ...new Set((planAssignments ?? []).filter((p) => p.taught_at).map((p) => p.tp_point_id).filter((id): id is string => !!id)),
  ];
  const { data: tpPoints } = tpPointIds.length > 0 ? await supabase.from("tp_points").select("id, tp_coursebook_id").in("id", tpPointIds) : { data: [] };
  const coursebookIds = [...new Set((tpPoints ?? []).map((p) => p.tp_coursebook_id))];
  const { data: coursebooks } =
    coursebookIds.length > 0 ? await supabase.from("tp_coursebooks").select("id, level").in("id", coursebookIds) : { data: [] };
  const tpPointCoursebookById = new Map((tpPoints ?? []).map((p) => [p.id, p.tp_coursebook_id]));
  const coursebookLevelById = new Map((coursebooks ?? []).map((c) => [c.id, c.level]));

  const recordByTrainee = new Map((records ?? []).map((r) => [r.trainee_id, r]));
  const matrixByTrainee = new Map<string, Record<string, CriteriaRating | null>>();
  for (const row of matrixRows ?? []) {
    const ratings = matrixByTrainee.get(row.trainee_id) ?? {};
    // Stage 3 supersedes Stage 2 once it exists -- it's the later, more
    // complete assessment of the same criterion.
    ratings[row.criteria_code] = row.tutor_status_stage3 ?? row.tutor_status_stage2;
    matrixByTrainee.set(row.trainee_id, ratings);
  }

  function provisionalLabel(record: Celta5Record | null | undefined): string {
    if (!record?.provisional_grade) return "Not set";
    return record.provisional_grade_upper ? `${record.provisional_grade} / ${record.provisional_grade_upper}` : record.provisional_grade;
  }

  const cohortRows: CohortSheetRow[] = (trainees ?? []).map((trainee) => {
    const record = recordByTrainee.get(trainee.id) ?? null;
    const traineeAssignments = (assignments ?? []).filter((a) => a.trainee_id === trainee.id);
    const traineeFeedback = (tpFeedbackRows ?? []).filter((f) => f.trainee_id === trainee.id);

    let outstanding = "";
    if (!record) {
      outstanding = "No CELTA 5 record";
    } else if (record.stage3_required && !record.stage3_finalized_at) {
      outstanding = "Stage 3 record open";
    } else {
      const unresolved = traineeAssignments.find((a) => {
        const isResubmissionRound = a.first_status === "resubmission_required" || a.resubmission_status !== "not_submitted";
        const status = isResubmissionRound ? a.resubmission_status : a.first_status;
        return status !== "approved";
      });
      if (unresolved) {
        outstanding = `${ASSIGNMENT_INFO[unresolved.assignment_type]?.title ?? unresolved.assignment_type} unresolved`;
      } else {
        const ledger = computeSignatureLedger(record, traineeAssignments);
        if (!isBookletExportReady(ledger)) {
          const outstandingCount = ledger.filter((r) => r.state !== "signed").length;
          outstanding = `${outstandingCount} signature${outstandingCount === 1 ? "" : "s"} outstanding`;
        }
      }
    }

    const taughtForTrainee = (planAssignments ?? []).filter((p) => p.trainee_id === trainee.id && p.taught_at).length;

    return {
      traineeId: trainee.id,
      name: trainee.full_name,
      tpGlyphs: mapTpFeedbackToGlyphRow(traineeFeedback),
      provisionalLabel: provisionalLabel(record),
      recommendedGrade: record?.final_recommended_grade ?? null,
      outstanding,
      // for-claude-code-trainer-remaining-screens.md's "Undecided/Settled"
      // split: undecided = slashed provisional with no justification typed
      // yet (same wasSlashed/overall_notes pairing the per-candidate detail
      // below already uses for its red warning text).
      wasSlashed: Boolean(record?.provisional_grade_upper),
      justified: Boolean(record?.overall_notes),
      stage3Status: !record?.stage3_required ? "not_required" : record.stage3_finalized_at ? "given" : "not_given",
      // TPs still to teach -- the closest real signal to the spec's "a Fail
      // letter must be issued with at least two lessons left to teach."
      // There's no letter-issuing feature in the app (confirmed absent, see
      // grade-query-reply build) so this stays informational context, not
      // an enforced gate.
      tpsRemaining: Math.max(8 - taughtForTrainee, 0),
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <CohortSheet courseId={courseId} courseName={course?.name ?? "Course"} rows={cohortRows} canRelease={Boolean(trainer)} />

      <div className="sheet">
        <p className="mt-2 text-sm text-muted">
          Provisional grades are set by the trainer around Stage 2 -- if a candidate is genuinely in
          doubt between two grades, mark them as such below. A final justification is only needed
          for candidates who were marked in doubt; anyone who simply maintained their provisional
          trajectory needs no extra comment.
        </p>
      </div>

      {(trainees ?? []).length === 0 ? (
        <div className="sheet text-sm text-muted">No candidates on this course yet.</div>
      ) : (
        <div className="flex flex-col gap-4">
          {(trainees ?? []).map((trainee) => {
            const record = recordByTrainee.get(trainee.id) ?? null;
            const ratings = matrixByTrainee.get(trainee.id) ?? {};
            const { planningStrengths, planningActionPoints, teachingStrengths, teachingActionPoints } =
              computeStrengthsAndActionPoints(ratings);
            const wasSlashed = Boolean(record?.provisional_grade_upper);
            const traineeFeedback = (tpFeedbackRows ?? []).filter((f) => f.trainee_id === trainee.id);
            const taughtAssignments = (planAssignments ?? []).filter((p) => p.trainee_id === trainee.id && p.taught_at);
            const assessedTp = computeAssessedTpStats({ taughtAssignments, tpPointCoursebookById, coursebookLevelById });

            return (
              <div key={trainee.id} id={`candidate-${trainee.id}`} className="sheet flex flex-col gap-4 scroll-mt-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs text-muted">
                      {assessedTp.tpsTaught} of 8 TPs taught · {assessedTp.hoursAssessed.toFixed(1)} hrs assessed
                    </p>
                    <h2 className="font-serif text-lg text-ink">{trainee.full_name}</h2>
                  </div>
                  <div className="flex items-center gap-1">
                    {mapTpFeedbackToGlyphRow(traineeFeedback).map((slot) => (
                      <StandardRatingGlyph key={slot.tpNumber} rating={slot.grade} title={`TP${slot.tpNumber}`} />
                    ))}
                  </div>
                </div>

                {trainer ? (
                  <>
                    <ProvisionalGradeForm traineeId={trainee.id} record={record} />
                    <UpgradeConditionsForm traineeId={trainee.id} record={record} />
                  </>
                ) : null}

                <p className="text-xs text-muted">
                  *All criteria not listed below are assumed to be &ldquo;to standard&rdquo;.
                </p>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <StrengthsColumn title="Planning Strengths" items={planningStrengths} />
                  <StrengthsColumn title="Planning Action Points" items={planningActionPoints} />
                  <StrengthsColumn title="Teaching Strengths" items={teachingStrengths} />
                  <StrengthsColumn title="Teaching Action Points" items={teachingActionPoints} />
                </div>

                {record?.overall_notes ? (
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      {wasSlashed ? "Final justification" : "Note"}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{record.overall_notes}</p>
                  </div>
                ) : wasSlashed ? (
                  <p className="text-sm text-destructive">
                    This candidate was marked in doubt at the provisional stage -- a final
                    justification is expected before this record is complete.
                  </p>
                ) : null}

                {trainer && record ? <FinalGradeForm record={record} /> : null}

                {record?.final_recommended_grade ? (
                  <p className="text-sm font-semibold text-ink">
                    Recommended Grade: {record.final_recommended_grade}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StrengthsColumn({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.04em] text-muted uppercase">{title}</p>
      {items.length > 0 ? (
        <p className="mt-1 text-sm text-ink">{items.join(", ")}</p>
      ) : (
        <p className="mt-1 text-sm text-muted">None</p>
      )}
    </div>
  );
}
