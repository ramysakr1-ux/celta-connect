import { redirect } from "next/navigation";
import { DemoDayTag } from "@/components/demo-day-tag";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { ASSESSOR_COOKIE, getAssessorCourseId, getAssessorTermsStatus, isAssessorPreview } from "@/lib/auth/portfolio-access";
import { AssessorReadOnlyBanner } from "@/components/assessor-readonly-banner";
import { getCachedCenter } from "@/lib/supabase/cached-queries";
import { DEFAULT_TIMEZONE } from "@/lib/timetable-grid";
import { formatDate } from "@/lib/format-date";
import { doubleMarkingPerAssignment } from "@/lib/assessor-requirements";
import { ASSIGNMENT_INFO, ASSIGNMENT_ORDER, ASSIGNMENT_RESULT_LABEL, resolveAssignmentResult } from "@/lib/assignment-info";
import { AssessorHead, AssessorSubHead } from "@/components/assessor/assessor-head";
import { AMBER, FAINT, INK, MUTED, TEAL } from "@/components/assessor/tokens";


// Handbook 9.2.3: "Centres should keep a record of which assignments have
// been double-marked; course assessors may ask to see this record." The pack
// listed "Double-marking record" as an upload slot, and on a course marked
// through Connect it read "Not uploaded" while the record sat on the
// assignments themselves -- who first-marked, who second-marked, when. This
// is that record, per assignment, against the quota the Handbook sets for
// the cohort size (three / four / five of each), with the one rule it adds:
// "the sample checked should include any fail assignments."
//
// Names only (§12.2). Nothing here opens the work itself -- the portfolio
// does that, and the assessor already has it.
export default async function AssessorDoubleMarkingPage() {
  const cookieStore = await cookies();
  if (!cookieStore.get(ASSESSOR_COOKIE)?.value) redirect("/login");
  const termsStatus = await getAssessorTermsStatus();
  if (!termsStatus) redirect("/login?error=assessor_link_invalid");
  if (!termsStatus.accepted && !(await isAssessorPreview())) redirect("/assessor/gate");
  const courseId = await getAssessorCourseId();
  if (!courseId) redirect("/login?error=assessor_link_invalid");

  const admin = createAdminClient();
  const { data: course } = await admin.from("courses").select("name, center_id").eq("id", courseId).maybeSingle();
  if (!course) redirect("/login?error=assessor_link_invalid");
  const timeZone = (await getCachedCenter(course.center_id))?.time_zone ?? DEFAULT_TIMEZONE;

  const [{ data: trainees }, { data: assignments }] = await Promise.all([
    admin.from("profiles").select("id, full_name, course_status").eq("course_id", courseId).eq("role", "trainee"),
    admin
      .from("assignments")
      .select(
        "id, trainee_id, assignment_type, first_status, resubmission_status, resubmission_outcome, final_grade, marker_id, second_marker_id, second_marker_recorded_at"
      )
      .eq("course_id", courseId)
      .neq("assignment_type", "Plagiarism Reflection"),
  ]);
  const active = (trainees ?? []).filter((t) => t.course_status !== "withdrawn");
  const activeIds = new Set(active.map((t) => t.id));
  const traineeName = new Map((trainees ?? []).map((t) => [t.id, t.full_name]));
  const quota = doubleMarkingPerAssignment(active.length);

  const tutorIds = [
    ...new Set((assignments ?? []).flatMap((a) => [a.marker_id, a.second_marker_id]).filter((x): x is string => Boolean(x))),
  ];
  const { data: tutors } = tutorIds.length > 0 ? await admin.from("profiles").select("id, full_name").in("id", tutorIds) : { data: null };
  const tutorName = new Map((tutors ?? []).map((t) => [t.id, t.full_name]));

  const rows = (assignments ?? []).filter((a) => activeIds.has(a.trainee_id));
  const anyRecorded = rows.some((a) => a.second_marker_recorded_at);

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-background)" }}>
      <AssessorReadOnlyBanner subject="the course" />
      {/* The way back for a demo viewer (Ramy, 20 Sep 2026). */}
      <div style={{ display: "flex", justifyContent: "flex-end", maxWidth: 1040, margin: "0 auto", padding: "10px 24px 0" }}>
        <DemoDayTag courseId={courseId} />
      </div>
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "34px 24px 60px" }}>
        <div className="frame" style={{ padding: 24 }}>
          <AssessorHead
            eyebrow="Assessor access — read-only · double-marking record"
            title={<>Double-marking record</>}
            lede={
              <>
                Which written assignments on {course.name} a second tutor has checked, and when. Handbook §9.2.3 asks for{" "}
                {quota ? `${quota} of each assignment on a course of ${active.length}` : "a sample of each assignment"}, the sample to include
                any fails, and both tutors&apos; initials on the work — here, the first marker&apos;s decision and the second marker&apos;s
                own signature, each with its time.
              </>
            }
          />

          {!anyRecorded ? (
            <p className="card" style={{ marginTop: 26, padding: 16, fontSize: "var(--text-meta)", color: FAINT }}>
              No second marking has been recorded on this course yet. A centre that keeps its record on paper uploads it under
              centre documents.
            </p>
          ) : null}

          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 26 }}>
          {ASSIGNMENT_ORDER.map((type) => {
            const ofType = rows.filter((a) => a.assignment_type === type);
            const marked = ofType.filter((a) => {
              const r = resolveAssignmentResult(a);
              return r === "pass_first" || r === "pass_resub" || r === "resubmission_required" || r === "fail";
            });
            const doubleMarked = ofType.filter((a) => a.second_marker_recorded_at);
            const failsNotChecked = ofType.filter((a) => resolveAssignmentResult(a) === "fail" && !a.second_marker_recorded_at);
            const met = quota !== null && doubleMarked.length >= quota;
            return (
              <div key={type} className="card" style={{ padding: 16 }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <AssessorSubHead>{ASSIGNMENT_INFO[type].title}</AssessorSubHead>
                  <span style={{ fontSize: "var(--text-label)", fontWeight: 600, color: met ? TEAL : marked.length === 0 ? MUTED : AMBER }}>
                    {doubleMarked.length} double-marked
                    {quota ? ` of ${quota} needed` : ""} · {marked.length} of {ofType.length} marked
                  </span>
                </div>
                {failsNotChecked.length > 0 ? (
                  <p style={{ fontSize: "var(--text-meta)", color: AMBER, marginTop: 6, fontWeight: 500 }}>
                    {failsNotChecked.length === 1 ? "A fail is" : `${failsNotChecked.length} fails are`} not in the double-marked sample —
                    §9.2.3 says the sample must include any fails.
                  </p>
                ) : null}
                {doubleMarked.length === 0 ? (
                  <p style={{ fontSize: "var(--text-meta)", color: FAINT, marginTop: 10 }}>
                    {marked.length === 0 ? "Nothing marked yet." : "None double-marked yet."}
                  </p>
                ) : (
                  <div style={{ marginTop: 10, overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-meta)" }}>
                      <thead>
                        <tr style={{ color: MUTED, fontSize: "var(--text-micro)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                          <th style={{ textAlign: "left", padding: "6px 8px 6px 0", fontWeight: 700 }}>Candidate</th>
                          <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 700 }}>Result</th>
                          <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 700 }}>First marker</th>
                          <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 700 }}>Second marker</th>
                          <th style={{ textAlign: "left", padding: "6px 0 6px 8px", fontWeight: 700 }}>Checked</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...doubleMarked]
                          .sort((a, b) => (traineeName.get(a.trainee_id) ?? "").localeCompare(traineeName.get(b.trainee_id) ?? ""))
                          .map((a) => {
                            const r = resolveAssignmentResult(a);
                            return (
                              <tr key={a.id} style={{ borderTop: "1px solid color-mix(in srgb, oklch(88% 0.016 82) 45%, transparent)", color: INK }}>
                                <td style={{ padding: "7px 8px 7px 0", fontWeight: 600 }}>{traineeName.get(a.trainee_id) ?? "—"}</td>
                                <td style={{ padding: "7px 8px", color: r === "fail" ? AMBER : INK }}>{ASSIGNMENT_RESULT_LABEL[r]}</td>
                                <td style={{ padding: "7px 8px" }}>{(a.marker_id && tutorName.get(a.marker_id)) || "—"}</td>
                                <td style={{ padding: "7px 8px" }}>{(a.second_marker_id && tutorName.get(a.second_marker_id)) || "—"}</td>
                                <td style={{ padding: "7px 0 7px 8px", color: MUTED, whiteSpace: "nowrap" }}>
                                  {formatDate(a.second_marker_recorded_at, timeZone, { year: "numeric" })}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
          </div>
        </div>
      </div>
    </div>
  );
}
