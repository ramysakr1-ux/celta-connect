import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { computeStrengthsAndActionPoints } from "@/lib/celta-criteria";
import { ProvisionalGradeForm } from "@/app/trainer/(hub)/grades-report/provisional-grade-form";
import type { CriteriaRating } from "@/lib/supabase/types";

// Assessor-facing compiled Grades Report -- the whole cohort in one
// continuous document, matching the shape of a real center's actual
// "Grades Report" (traced from a filled example, 5 Aug 2026): provisional
// grade (set by the trainer ~Stage 2, "slashed" between two grades when
// genuinely unsure), Planning/Teaching Strengths & Action Points derived
// from the same criteria matrix the rest of the app already tracks, and a
// recommended final grade + justification -- required only for candidates
// who were slashed; a candidate who simply maintained their provisional
// trajectory needs no extra comment.
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

  const { data: trainees } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("course_id", courseId)
    .eq("role", "trainee")
    .order("full_name");

  const traineeIds = (trainees ?? []).map((t) => t.id);
  const [{ data: records }, { data: matrixRows }] =
    traineeIds.length > 0
      ? await Promise.all([
          supabase.from("celta5_records").select("*").eq("course_id", courseId),
          supabase
            .from("celta5_matrix")
            .select("trainee_id, criteria_code, tutor_status_stage2, tutor_status_stage3")
            .eq("course_id", courseId),
        ])
      : [{ data: [] }, { data: [] }];

  const recordByTrainee = new Map((records ?? []).map((r) => [r.trainee_id, r]));
  const matrixByTrainee = new Map<string, Record<string, CriteriaRating | null>>();
  for (const row of matrixRows ?? []) {
    const ratings = matrixByTrainee.get(row.trainee_id) ?? {};
    // Stage 3 supersedes Stage 2 once it exists -- it's the later, more
    // complete assessment of the same criterion.
    ratings[row.criteria_code] = row.tutor_status_stage3 ?? row.tutor_status_stage2;
    matrixByTrainee.set(row.trainee_id, ratings);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="sheet">
        <h1 className="font-serif text-xl text-ink">Grades Report</h1>
        <p className="mt-2 text-sm text-muted">
          The whole cohort's provisional and final grades, for review with the external assessor.
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

            return (
              <div key={trainee.id} className="sheet flex flex-col gap-4">
                <div className="flex items-start justify-between gap-4">
                  <h2 className="font-serif text-lg text-ink">{trainee.full_name}</h2>
                  {record?.provisional_grade ? (
                    <span className="pill pill-info shrink-0">
                      Provisional: {record.provisional_grade}
                      {record.provisional_grade_upper ? ` / ${record.provisional_grade_upper}` : ""}
                    </span>
                  ) : (
                    <span className="pill pill-neutral shrink-0">Provisional: not set</span>
                  )}
                </div>

                {trainer ? (
                  <ProvisionalGradeForm traineeId={trainee.id} record={record} />
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
