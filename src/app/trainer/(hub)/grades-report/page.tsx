import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { computeStrengthsAndActionPoints, applyGradesReportOverrides, criterionLine } from "@/lib/celta-criteria";
import { CriteriaList, CopyField } from "@/app/trainer/(hub)/grades-report/report-cards";
import { buildReleaseChecklist } from "@/lib/release-checklist";
import { computeAssessedTpStats } from "@/lib/course-progress";
import { mapTpFeedbackToGlyphRow } from "@/lib/tp-grades";
import { computeCohortRows } from "@/lib/grades-report";
import { ProvisionalGradeForm } from "@/app/trainer/(hub)/grades-report/provisional-grade-form";
import { assignmentGradeCeiling } from "@/lib/provisional-grade";
import { UpgradeConditionsForm } from "@/app/trainer/(hub)/grades-report/upgrade-conditions-form";
import { CohortSheet } from "@/app/trainer/(hub)/grades-report/cohort-sheet";
import { CloseOutCard } from "@/app/dashboard/admin/courses/[id]/close-out-card";
import { CertificateCheckCard, type CertificateCandidate } from "@/app/dashboard/admin/courses/[id]/certificate-check-card";
import { getCloseOutBlockingReasons } from "@/lib/course-close-out/blocking-rules";
import { StandardRatingGlyph } from "@/lib/status-pill";
import { LaptopOnlyGate } from "@/components/laptop-only-gate";
import type { CriteriaRating } from "@/lib/supabase/types";
import { FinalReportFields } from "@/app/trainer/(hub)/grades-report/final-report-fields";
import { appianHref } from "@/lib/appian";

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
  // The assessor's copy of the sheet shows only what the MCT has approved
  // and sent -- see computeCohortRows.
  // Ramy, 30 Aug 2026, on where the Appian link belongs: the pack has one
  // for the assessor and Course Admin has one for the entry form, but
  // neither serves the moment this page exists for -- an MCT working down
  // the cohort copying nine fields per candidate across. Same
  // centers.appian_url as the other two, so one setting lights them all.
  const { data: centreForAppian } = await createAdminClient()
    .from("courses")
    .select("centers(appian_url)")
    .eq("id", courseId)
    .maybeSingle();
  const appianUrl =
    (centreForAppian?.centers as unknown as { appian_url: string | null } | null)?.appian_url ?? null;

  // Course-level, read once rather than per candidate.
  const { data: visitRow } = await createAdminClient()
    .from("courses")
    .select("assessor_visit_date")
    .eq("id", courseId)
    .maybeSingle();
  const assessorVisitDateForCourse = visitRow?.assessor_visit_date ?? null;

  const { courseName, provisionalDueAt, provisionalDueDerived, rows: cohortRows } = await computeCohortRows(
    supabase,
    courseId,
    { approvedOnly: !trainer }
  );

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
  const [{ data: records }, { data: matrixRows }, { data: tpFeedbackRows }, { data: planAssignments }, { data: writtenAssignments }] =
    traineeIds.length > 0
      ? await Promise.all([
          supabase.from("celta5_records").select("*").eq("course_id", courseId),
          supabase
            .from("celta5_matrix")
            .select("trainee_id, criteria_code, tutor_status_stage2, tutor_status_stage3")
            .eq("course_id", courseId),
          supabase.from("tp_feedback").select("trainee_id, tp_number, grade, submitted_at").in("trainee_id", traineeIds),
          supabase.from("plan_assignments").select("trainee_id, tp_point_id, taught_at").eq("course_id", courseId),
          // The written assignments, for the release checklist's "four
          // assignments resolved". The page previously needed only
          // plan_assignments, which is a different table entirely.
          supabase.from("assignments").select("*").in("trainee_id", traineeIds),
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
    <LaptopOnlyGate task="The grade form" skip={!trainer}>
    <div className="flex flex-col gap-6">
      <CohortSheet
        courseId={courseId}
        courseName={courseName}
        rows={cohortRows}
        canRelease={Boolean(trainer)}
        provisionalDueAt={provisionalDueAt}
        provisionalDueDerived={provisionalDueDerived}
        appianUrl={appianUrl}
        isMct={isMct}
      />

      <div className="sheet sheet-garnet">
        {/* Rewritten 30 Aug 2026. Ramy: "provisional grades are submitted
            around the end of TP6... provisional grades are set by the trainer
            around stage two -- it's not correct. Final discussion is only
            needed for candidates who are marked in doubt -- that's all
            wrong."
            
            He is right on both, and the Handbook is explicit. 14.4: "The
            course tutor must contact the assessor to confirm the final
            recommended grade for EACH candidate, providing an update on
            strengths and areas for development for EACH candidate and a
            rationale for EACH final grade." Not only the slashed ones -- and
            C14_GREEN bears it out, where all five candidates carry an update,
            including the four straight passes.
            
            Timing: 11.4 has the centre complete the grade form and submit it
            via Appian BEFORE the assessment, which lands near the end of the
            course, not at Stage 2. */}
        <p className="mt-2 text-sm text-muted">
          Every candidate gets a provisional grade, proposed near the end of the teaching practice cycle and confirmed
          by the MCT before it goes to the assessor. A straight grade needs nothing further at this stage. A slashed
          grade &mdash; Fail/Pass, Pass/Pass B, Pass B/Pass A &mdash; means the last TPs decide it, and needs the box
          below saying what the candidate must do to reach the higher band.
        </p>
        <p className="mt-2 text-sm text-muted">
          At the final grade, every candidate gets a rationale: what they did to reach the higher band, or what they
          did not (Handbook 14.4).
        </p>
      </div>

      {(trainees ?? []).length === 0 ? (
        <div className="sheet text-sm text-muted">No candidates on this course yet.</div>
      ) : (
        <div className="flex flex-col gap-4">
          {(trainees ?? []).map((trainee, traineeIndex) => {
            const record = recordByTrainee.get(trainee.id) ?? null;
            const ratings = matrixByTrainee.get(trainee.id) ?? {};
            const derived = computeStrengthsAndActionPoints(ratings);
            const curated = applyGradesReportOverrides(
              derived,
              ((record as { grades_report_list_overrides?: unknown } | null)?.grades_report_list_overrides ?? {}) as never
            );
            const toLines = (labels: string[]) =>
              labels.map((label) => ({ code: (label.match(/\(([0-9a-z]+)\)\s*$/) ?? [])[1] ?? label, label }));
            const planningStrengths = toLines(curated.planningStrengths);
            const planningActionPoints = toLines(curated.planningActionPoints);
            const teachingStrengths = toLines(curated.teachingStrengths);
            const teachingActionPoints = toLines(curated.teachingActionPoints);
            const wasSlashed = Boolean(record?.provisional_grade_upper);
            // Handbook 15.2 asks for the evidence field on "any candidates
            // that were borderline (e.g., Pass/Fail, Pass/Pass B)". A paired
            // provisional IS that, and covers both of Cambridge's own
            // examples -- but it misses the other way a grade can be in
            // question: a straight provisional that the final recommendation
            // then departs from, which 14.4 requires the MCT and assessor to
            // discuss and the assessor to explain. Both are borderline in the
            // sense the field exists for, so both get it.
            const gradeMoved = Boolean(
              record?.final_recommended_grade &&
                record?.provisional_grade &&
                record.final_recommended_grade !== record.provisional_grade
            );
            const isBorderline = wasSlashed || gradeMoved;
            const traineeFeedback = (tpFeedbackRows ?? []).filter((f) => f.trainee_id === trainee.id);
            const taughtAssignments = (planAssignments ?? []).filter((p) => p.trainee_id === trainee.id && p.taught_at);
            const assessedTp = computeAssessedTpStats({ taughtAssignments, tpPointCoursebookById, coursebookLevelById });
            // Ramy, 30 Aug 2026: the proposed-by line carries "the level of
            // the group and the tutor name", not a group name -- "there's no
            // group ABC, it's half a group." Candidates teach two levels
            // across the course, so the one that matters here is the current
            // half's: the last level they taught at.
            const currentLevel = assessedTp.levels.length > 0 ? assessedTp.levels[assessedTp.levels.length - 1] : null;

            // "Before this grade can be released" -- Ramy's own four, from
            // his design file. I cut my version of this panel because it was
            // the wrong question; his asks whether the candidate has met the
            // course requirements, which is the one worth asking.
            const releaseChecks = buildReleaseChecklist({
              record,
              wasSlashed,
              assignments: (writtenAssignments ?? []).filter((a) => a.trainee_id === trainee.id),
              hoursAssessed: assessedTp.hoursAssessed,
              levels: assessedTp.levels,
              assessorVisitDate: assessorVisitDateForCourse,
            });

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

                {/* Ramy's Grades Report design, 1b: two columns, provisional
                    and everything supporting it on the left, recommended and
                    its justification on the right -- "because it's the same
                    thing on Appian, so it needs to look the same." He had to
                    tell me twice to use his file rather than a design of my
                    own; the panel padding, the bordered chip box and the
                    28px pills are all his values.

                    Deliberately NOT here: the release-gates panel and a
                    "copy all" button. Both were mine, and he cut them --
                    "I'm not sure what that is... let's just leave it clean,
                    basically what we agreed on." */}
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
                  <div className="flex flex-col gap-3.5 rounded-[6px] border border-border bg-card p-5">
                    {trainer ? (
                      <ProvisionalGradeForm
                        traineeId={trainee.id}
                        record={record}
                        proposedByName={record?.provisional_proposed_by ? (tutorNameById.get(record.provisional_proposed_by) ?? null) : null}
                        proposedByMeta={currentLevel}
                        isMct={isMct}
                        eligibility={assignmentGradeCeiling(
                          (writtenAssignments ?? []).filter((a) => a.trainee_id === trainee.id)
                        )}
                      />
                    ) : record?.provisional_grade && record.provisional_approved_at ? (
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[11px] font-bold tracking-[0.1em] text-muted uppercase">Provisional grade</span>
                        <span className="rounded-full bg-ink px-2.5 py-0.5 text-[11px] font-bold text-card">
                          {record.provisional_grade}
                          {record.provisional_grade_upper ? ` / ${record.provisional_grade_upper}` : ""}
                        </span>
                      </div>
                    ) : (
                      /* Unapproved, or nothing proposed. Either way the
                         assessor is told the state rather than shown a draft
                         -- the MCT approves and sends, and until then this
                         candidate's grade is the centre's business. */
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[11px] font-bold tracking-[0.1em] text-muted uppercase">Provisional grade</span>
                        <span className="text-[11.5px] text-muted italic">
                          {record?.provisional_grade ? "Grade not yet confirmed by the centre" : "No grade proposed yet"}
                        </span>
                      </div>
                    )}

                    <p className="text-[11px] text-muted italic">
                      All criteria not listed below is assumed to be &lsquo;To standard&rsquo;.
                    </p>

                    <CriteriaList
                      traineeId={trainee.id}
                      list="planningStrengths"
                      label="Strengths in planning"
                      labelClass="text-primary"
                      source="matrix · S+"
                      items={planningStrengths}
                      ratings={ratings}
                      editable={Boolean(trainer)}
                    />
                    <CriteriaList
                      traineeId={trainee.id}
                      list="planningActionPoints"
                      label="Action points in planning"
                      labelClass="text-status-warning-text"
                      source="matrix · N"
                      items={planningActionPoints}
                      ratings={ratings}
                      editable={Boolean(trainer)}
                    />
                    <CriteriaList
                      traineeId={trainee.id}
                      list="teachingStrengths"
                      label="Strengths in teaching"
                      labelClass="text-primary"
                      source="matrix · S+"
                      items={teachingStrengths}
                      ratings={ratings}
                      editable={Boolean(trainer)}
                    />
                    <CriteriaList
                      traineeId={trainee.id}
                      list="teachingActionPoints"
                      label="Action points in teaching"
                      labelClass="text-status-warning-text"
                      source="matrix · N"
                      items={teachingActionPoints}
                      ratings={ratings}
                      editable={Boolean(trainer)}
                    />

                    {/* Slash only. Ramy went back and forth on this within
                        one session, and landed here: "this whole box just
                        should not be there if it's a straightforward. It will
                        only appear if it's a slash candidate."

                        The middle position -- heading always shown, box left
                        empty on a straight grade -- came from his C10/2026
                        report, but that document only ever showed the empty
                        placeholder because nobody on it was slashed. The
                        heading itself says "(if applicable)", and applicable
                        means slashed.

                        The heading reads "pass/higher", not C14_GREEN's "a
                        higher grade", on his correction the same day: a slash
                        is not always Pass/Pass B. A Fail/Pass candidate needs
                        evidence for a PASS, and "higher grade" reads as
                        nonsense on their report. One heading covers both. */}
                    {wasSlashed ? (
                    <div className="flex flex-col gap-1.5 rounded-[6px] border border-border bg-card-inset p-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-[11px] font-bold tracking-[0.09em] text-muted uppercase">
                          Evidence needed for a pass/higher (if applicable)
                        </span>
                        {record?.provisional_upgrade_conditions ? (
                          <CopyField value={record.provisional_upgrade_conditions} label="Evidence needed" />
                        ) : null}
                      </div>
                      {trainer ? (
                        <UpgradeConditionsForm traineeId={trainee.id} record={record} />
                      ) : record?.provisional_upgrade_conditions && record.provisional_approved_at ? (
                        record.provisional_upgrade_conditions
                          .split("\n")
                          .map((linePart) => linePart.trim())
                          .filter(Boolean)
                          .map((linePart, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <span className="shrink-0 text-[11px] leading-[1.5] text-gold">&mdash;</span>
                              <span className="text-[12px] leading-[1.5] text-ink">{linePart}</span>
                            </div>
                          ))
                      ) : (
                        <p className="text-[12px] text-muted">Not yet set by the centre.</p>
                      )}
                    </div>
                    ) : null}
                  </div>

                  {/* Structurally identical to the assessor's right-hand
                      column -- same headings, same order, same three fields.
                      Ramy, 30 Aug 2026: "can we just make it look like the
                      same view as the assessor? Why the different from the
                      assessor view?"

                      He is right that there should be no difference. It is
                      one report; the only thing that changes between a tutor
                      and an assessor is whether the boxes are inputs. The
                      tutor-only furniture -- release state, the Appian link
                      -- now sits under the table rather than inside the
                      column, where it was making the two sides look like two
                      different screens.

                      The grade select moved in here too. It had its own
                      bordered card above with the descriptors, the teaching
                      and assignments selects and a second Save button, which
                      is what tipped the column over: "there's just too many
                      boxes... it's confusing even for me, and I've been doing
                      this for fifteen years." The teaching and assignments
                      grades belong to the CELTA 5 record, not to what the
                      assessor submits, and they are still on that page. */}
                  {record ? (
                    <FinalReportFields record={record} editable={Boolean(trainer)} isBorderline={isBorderline} />
                  ) : (
                    <div className="rounded-[6px] border border-border bg-card p-5 text-[12px] text-muted italic">
                      No CELTA 5 record for this candidate yet.
                    </div>
                  )}
                </div>

                  {/* Tutors only, and one line unless something is actually
                      outstanding. Ramy: "do we need this everywhere, like,
                      for every final recommended grade we need to have this?"
                      The checks do vary per candidate -- one can be short on
                      hours while another is not -- so the information is
                      per-candidate and has to stay. What does not have to
                      stay is five rows of "Met" on every card. */}
                  {trainer ? (
                    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border-faint pt-3">
                      {releaseChecks.every((c) => c.met) ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                          <span className="size-[5px] rounded-full bg-current" />
                          Ready to release
                        </span>
                      ) : (
                        <>
                          <span className="text-[11px] font-bold tracking-[0.1em] text-muted uppercase">
                            Outstanding before release
                          </span>
                          {releaseChecks
                            .filter((c) => !c.met)
                            .map((check) => (
                              <span
                                key={check.label}
                                className="inline-flex items-center gap-1.5 rounded-full bg-status-warning-bg px-2.5 py-0.5 text-[11px] font-semibold text-status-warning-text"
                              >
                                <span className="size-[5px] rounded-full bg-current" />
                                {check.label} &middot; {check.state}
                              </span>
                            ))}
                        </>
                      )}

                      {/* Copying happens candidate by candidate, so the link
                          stays per candidate rather than only at the top --
                          Ramy asked for both. */}
                      {/* Always a link. It used to be replaced by "no Appian
                          sign-in link set yet" whenever the centre had not
                          filled in appian_url -- which is both real centres,
                          so the MCT never saw a link at all. The platform
                          address is the same for everyone; a centre's own URL
                          just overrides it. */}
                      <a
                        href={appianHref(appianUrl)}
                        target="_blank"
                        rel="noreferrer"
                        className="trainer-hover-fill ml-auto rounded-[6px] border border-border px-3 py-1 text-[11.5px] font-medium text-ink"
                      >
                        Open Appian &rarr;
                      </a>
                    </div>
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
