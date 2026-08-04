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
  computeTrajectory,
} from "@/lib/celta-criteria";
import { CriteriaRatingPill, StandardRatingPill } from "@/lib/status-pill";
import { computeProgressIssues } from "@/lib/course-progress";
import { SelfAssessmentForm } from "@/app/dashboard/trainee/celta5/self-assessment-form";
import { ObservationForm } from "@/app/dashboard/trainee/celta5/observation-form";
import { signOffStage2, signOffFinal } from "@/app/dashboard/trainee/actions";
import { Stage1Form } from "@/app/dashboard/trainer/trainees/[id]/celta5/stage1-form";
import { StageRatingsForm } from "@/app/dashboard/trainer/trainees/[id]/celta5/stage-ratings-form";
import { Stage2OverallForm } from "@/app/dashboard/trainer/trainees/[id]/celta5/stage2-overall-form";
import { Stage3OverallForm } from "@/app/dashboard/trainer/trainees/[id]/celta5/stage3-overall-form";
import { FinalGradeForm } from "@/app/dashboard/trainer/trainees/[id]/celta5/final-grade-form";
import { AttendanceForm } from "@/app/dashboard/trainer/trainees/[id]/celta5/attendance-form";
import { AdminGrantForm } from "@/app/dashboard/trainer/trainees/[id]/celta5/admin-grant-form";
import { FinalizeRecordForm } from "@/app/dashboard/trainer/trainees/[id]/celta5/finalize-record-form";

const TRAJECTORY_LABEL: Record<string, string> = {
  "Pass A": "Pass A",
  "Pass B": "Pass B",
  Pass: "Pass",
  Fail: "Fail",
  not_enough_data: "Not enough data yet",
};

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
export default async function PortfolioCelta5Page({ params }: { params: Promise<{ traineeId: string }> }) {
  const { traineeId } = await params;
  const session = await getCurrentProfile();
  const viewer = session?.profile ?? null;
  const isStaff = viewer?.role === "trainer" || viewer?.role === "admin";
  const assessorCourseId = !viewer ? await getAssessorCourseId() : null;
  if (!viewer && !assessorCourseId) notFound();
  if (viewer && !isStaff && viewer.id !== traineeId) notFound();

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
        supabase.from("plan_assignments").select("tp_number, taught_at").eq("trainee_id", traineeId),
        supabase.from("assignments").select("assignment_type, first_status, resubmission_status").eq("trainee_id", traineeId),
      ]);
    const record = recordRows?.[0];

    if (!record) {
      return <div className="sheet p-6 text-sm text-muted">No CELTA 5 record found yet. Check with your trainer.</div>;
    }

    const byCode = new Map((matrix ?? []).map((m) => [m.criteria_code, m]));
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
              <h3 className="font-serif text-lg text-ink">Stage Two</h3>
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
                        return (
                          <div key={code} className="border-b border-border-faint pb-3 last:border-none">
                            <p className="text-sm text-ink">
                              {code}
                              {CRITERIA_LABELS[code] ? ` -- ${CRITERIA_LABELS[code]}` : ""}
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
              <h3 className="font-serif text-lg text-ink">Final grade</h3>
              <p className="mt-2 text-sm text-muted">
                Your final grade is confirmed after your tutor&apos;s recommendation is reviewed. You&apos;ll
                receive it separately once that&apos;s complete.
              </p>
            </div>

            <div className="sheet">
              {record.trainee_signoff_final_at ? (
                <p className="text-sm text-muted">
                  You signed off on this on {new Date(record.trainee_signoff_final_at).toLocaleString()}.
                </p>
              ) : (
                <form action={signOffFinal}>
                  <button type="submit" className="rounded-[6px] bg-primary px-4 py-2 font-medium text-primary-foreground">
                    I&apos;ve reviewed my final record and sign off
                  </button>
                </form>
              )}
            </div>
          </>
        ) : null}

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
  ] = await Promise.all([
    supabase.from("courses").select("*").eq("id", trainee.course_id ?? "").maybeSingle(),
    supabase.from("centers").select("*").eq("id", trainee.center_id).maybeSingle(),
    supabase.from("celta5_matrix").select("*").eq("trainee_id", traineeId),
    supabase.from("celta5_records").select("*").eq("trainee_id", traineeId).maybeSingle(),
    supabase.from("attendance_absences").select("*").eq("trainee_id", traineeId).order("session_date"),
    supabase.from("observations").select("*").eq("trainee_id", traineeId).order("observation_date"),
    supabase.from("tp_lessons").select("id").eq("trainee_id", traineeId),
  ]);

  const lessonIds = (lessons ?? []).map((l) => l.id);
  const { data: criteriaTags } =
    lessonIds.length > 0
      ? await supabase.from("tp_lesson_criteria_tags").select("*").in("tp_lesson_id", lessonIds).order("created_at")
      : { data: [] };

  const tagsByCriteria = new Map<string, { tag_type: "strength" | "action_point"; created_at: string }[]>();
  for (const tag of criteriaTags ?? []) {
    const list = tagsByCriteria.get(tag.criteria_code) ?? [];
    list.push({ tag_type: tag.tag_type, created_at: tag.created_at });
    tagsByCriteria.set(tag.criteria_code, list);
  }

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

  const matrixRows = matrix ?? [];
  const matrixKey = matrixRows.map((m) => m.updated_at).join(",");
  const matrixByCode = new Map(matrixRows.map((m) => [m.criteria_code, m]));

  const trajectoryInputs = CELTA_CRITERIA_CODES.map((code) => matrixByCode.get(code)?.tutor_status_stage2 ?? suggestions[code] ?? null);
  const trajectory = computeTrajectory(trajectoryInputs);

  const headerBlock = (
    <div>
      <h2 className="font-serif text-xl text-ink">CELTA 5 record</h2>
      <div className="mt-3 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
        <div>
          <p className="text-muted">Center</p>
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

  const observationsBlock = (
    <div>
      <h3 className="font-serif text-lg text-ink">Observations of experienced teachers (self-reported)</h3>
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
          <p className="mt-1 font-serif text-xl text-ink">{TRAJECTORY_LABEL[trajectory]}</p>
        </div>

        <div className="sheet">
          <p className="text-sm text-muted">Attendance</p>
          <p className="mt-1 text-ink">
            {record.hours_attended ?? 0} / {course?.total_hours ?? 120} hrs
          </p>
        </div>

        {observationsBlock}

        {record.stage1_strengths || record.stage1_action_plan ? (
          <div className="sheet">
            <h3 className="font-serif text-lg text-ink">Stage One</h3>
            <ReadOnlyField label="Strengths" value={record.stage1_strengths} />
            <ReadOnlyField label="Action plan" value={record.stage1_action_plan} />
          </div>
        ) : null}

        <div>
          <h3 className="font-serif text-lg text-ink">Stage Two -- criteria ratings</h3>
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
                  {codes.map((code) => (
                    <div key={code} className="flex items-center justify-between gap-3 border-b border-border-faint pb-2 last:border-none">
                      <p className="text-sm text-ink">
                        {code}
                        {CRITERIA_LABELS[code] ? ` -- ${CRITERIA_LABELS[code]}` : ""}
                      </p>
                      <CriteriaRatingPill rating={matrixByCode.get(code)?.tutor_status_stage2 ?? null} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {record.stage3_required ? (
          <div>
            <h3 className="font-serif text-lg text-ink">Stage Three -- criteria ratings</h3>
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
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {headerBlock}

      <div className="sheet">
        <p className="text-sm text-muted">Trajectory (trainer-only, estimated -- never shown to the trainee, never sets the real final grade)</p>
        <p className="mt-1 font-serif text-xl text-ink">{TRAJECTORY_LABEL[trajectory]}</p>
      </div>

      <AttendanceForm key={`attendance-${record.updated_at}`} record={record} totalHours={course?.total_hours ?? 120} absences={absences ?? []} />

      {observationsBlock}

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

      <AdminGrantForm key={`admin-grant-${record.updated_at}`} record={record} />
    </div>
  );
}
