import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { computeStrengthsAndActionPoints } from "@/lib/celta-criteria";
import { computeAssessedTpStats } from "@/lib/course-progress";
import { mapTpFeedbackToGlyphRow } from "@/lib/tp-grades";
import { computeCohortRows } from "@/lib/grades-report";
import { ProvisionalGradeForm } from "@/app/trainer/(hub)/grades-report/provisional-grade-form";
import { UpgradeConditionsForm } from "@/app/trainer/(hub)/grades-report/upgrade-conditions-form";
import { CohortSheet } from "@/app/trainer/(hub)/grades-report/cohort-sheet";
import { FinalGradeForm } from "@/app/dashboard/trainer/trainees/[id]/celta5/final-grade-form";
import { CloseOutCard } from "@/app/dashboard/admin/courses/[id]/close-out-card";
import { CertificateCheckCard, type CertificateCandidate } from "@/app/dashboard/admin/courses/[id]/certificate-check-card";
import { getCloseOutBlockingReasons } from "@/lib/course-close-out/blocking-rules";
import { StandardRatingGlyph } from "@/lib/status-pill";
import { LaptopOnlyGate } from "@/components/laptop-only-gate";
import type { CriteriaRating } from "@/lib/supabase/types";

// Assessor-facing compiled Grades Report -- the whole cohort in one
// continuous document, matching the shape of a real center's actual
// "Grades Report" (traced from a filled example, 5 Aug 2026), plus the
// design reference's own "grade review meeting view" (Grades Report.dc.html
// 1a): a compact cohort sheet up top -- TP1-8 trajectory, provisional,
// recommended, what's still outstanding -- with the existing per-candidate
// detail below it for the actual editing.
export default async function GradesReportPage() {
  const session = await getCurrentProfile();
  const trainer = session?.profile?.role === "trainer" || session?.profile?.role === "admin" || session?.profile?.role === "platform_owner" ? session.profile : null;
  const assessorCourseId = !trainer ? await getAssessorCourseId() : null;
  if (!trainer && !assessorCourseId) redirect("/login");

  const supabase = assessorCourseId ? createAdminClient() : await createClient();
  const courseId = trainer?.course_id ?? assessorCourseId;
  if (!courseId) {
    return <div className="sheet p-6 text-sm text-muted">No course assigned.</div>;
  }

  // Shared with the CSV export (export/route.ts) -- one computation, not two.
  const { courseName, provisionalDueAt, provisionalDueDerived, rows: cohortRows } = await computeCohortRows(supabase, courseId);

  const { data: trainees } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("course_id", courseId)
    .eq("role", "trainee")
    .order("full_name");

  // Proposer names for the "Proposed by X" tag, and whether the current
  // viewer is the one person who can approve.
  const { data: courseTutors } = await supabase
    .from("profiles")
    .select("id, full_name, tutor_role")
    .eq("course_id", courseId)
    .eq("role", "trainer");
  const tutorNameById = new Map((courseTutors ?? []).map((t) => [t.id, t.full_name]));
  const isMct = trainer ? (courseTutors ?? []).some((t) => t.id === trainer.id && t.tutor_role === "main_course_tutor") : false;

  // Close-out ("MCT territory once the course is running, not Course
  // Admin's" -- for-claude-code-course-admin-landing-and-admissions.md)
  // lives here, at the bottom of the same page where the MCT already does
  // every other end-of-course grade action -- close-out's own first
  // blocking rule is literally "Cambridge has confirmed final grades."
  // MCT-only fetch, same gate as the write actions themselves.
  const [{ data: courseRow }, { data: closeOut }, blockingReasons] = isMct
    ? await Promise.all([
        supabase.from("courses").select("cambridge_grades_confirmed_at").eq("id", courseId).maybeSingle(),
        createAdminClient().from("course_close_outs").select("*").eq("course_id", courseId).maybeSingle(),
        getCloseOutBlockingReasons(courseId),
      ])
    : [{ data: null }, { data: null }, []];

  const traineeIds = (trainees ?? []).map((t) => t.id);
  const [{ data: records }, { data: matrixRows }, { data: tpFeedbackRows }, { data: planAssignments }] =
    traineeIds.length > 0
      ? await Promise.all([
          supabase.from("celta5_records").select("*").eq("course_id", courseId),
          supabase
            .from("celta5_matrix")
            .select("trainee_id, criteria_code, tutor_status_stage2, tutor_status_stage3")
            .eq("course_id", courseId),
          supabase.from("tp_feedback").select("trainee_id, tp_number, grade, submitted_at").in("trainee_id", traineeIds),
          supabase.from("plan_assignments").select("trainee_id, tp_point_id, taught_at").eq("course_id", courseId),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

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

  // CertificateCheckCard only wants candidates who already have a final
  // recommended grade -- nothing to check a certificate against otherwise.
  const certificateCandidates: CertificateCandidate[] = (trainees ?? [])
    .map((t) => {
      const record = recordByTrainee.get(t.id);
      return {
        traineeId: t.id,
        fullName: t.full_name,
        recommendedGrade: record?.final_recommended_grade ?? null,
        certificateGrade: record?.certificate_grade ?? null,
      };
    })
    .filter((c) => c.recommendedGrade !== null);

  return (
    <LaptopOnlyGate task="The Grades Report" skip={!trainer}>
    <div className="flex flex-col gap-6">
      <CohortSheet
        courseId={courseId}
        courseName={courseName}
        rows={cohortRows}
        canRelease={Boolean(trainer)}
        provisionalDueAt={provisionalDueAt}
        provisionalDueDerived={provisionalDueDerived}
        isMct={isMct}
      />

      <div className="sheet sheet-garnet">
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
          {(trainees ?? []).map((trainee, traineeIndex) => {
            const record = recordByTrainee.get(trainee.id) ?? null;
            const ratings = matrixByTrainee.get(trainee.id) ?? {};
            const { planningStrengths, planningActionPoints, teachingStrengths, teachingActionPoints } =
              computeStrengthsAndActionPoints(ratings);
            const wasSlashed = Boolean(record?.provisional_grade_upper);
            const traineeFeedback = (tpFeedbackRows ?? []).filter((f) => f.trainee_id === trainee.id);
            const taughtAssignments = (planAssignments ?? []).filter((p) => p.trainee_id === trainee.id && p.taught_at);
            const assessedTp = computeAssessedTpStats({ taughtAssignments, tpPointCoursebookById, coursebookLevelById });

            return (
              <div
                key={trainee.id}
                id={`candidate-${trainee.id}`}
                className={`sheet flex flex-col gap-4 scroll-mt-6 ${traineeIndex % 2 === 1 ? "sheet-garnet" : ""}`}
              >
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
                    <ProvisionalGradeForm
                      traineeId={trainee.id}
                      record={record}
                      proposedByName={record?.provisional_proposed_by ? (tutorNameById.get(record.provisional_proposed_by) ?? null) : null}
                      isMct={isMct}
                    />
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

      {isMct ? (
        <>
          <CertificateCheckCard courseId={courseId} candidates={certificateCandidates} />
          <CloseOutCard
            courseId={courseId}
            cambridgeGradesConfirmedAt={courseRow?.cambridge_grades_confirmed_at ?? null}
            blockingReasons={blockingReasons}
            closeOut={closeOut}
          />
        </>
      ) : null}
    </div>
    </LaptopOnlyGate>
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
