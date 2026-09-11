import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { ASSESSOR_COOKIE, getAssessorCourseId, getAssessorTermsStatus, isAssessorPreview } from "@/lib/auth/portfolio-access";
import { AssessorReadOnlyBanner } from "@/components/assessor-readonly-banner";
import { getCachedCenter } from "@/lib/supabase/cached-queries";
import { DEFAULT_TIMEZONE } from "@/lib/timetable-grid";
import { formatDate } from "@/lib/format-date";

const INK = "oklch(23.5% 0.017 65)";
const MUTED = "oklch(51% 0.017 70)";
const TEAL = "oklch(38% 0.072 195)";
const FAINT = "oklch(63% 0.012 82)";
const AMBER = "oklch(44% 0.095 68)";

// Handbook 14.1 puts "Application files / Including rejected applicants" in
// the pack the centre has ready, and 12.2 says what may be in them: "names
// only; no other identifying information". Until 12 Sep 2026 the pack row was
// an upload slot that read "Not uploaded" on every course whose selection had
// gone through Connect -- the files existed, in the pipeline, and the
// assessor had no way in. This is the way in: every applicant on the intake
// whose selection reached a decision, with the written task, the language
// awareness answer, the marks against the scheme, and the interview record.
// No email, no date of birth, no phone -- the applicant page has those and
// this page is not it.
//
// Decided stages only. Someone still between task and interview is not a
// file the assessor checks; they are a person the centre is still selecting.
const DECIDED_STAGES = ["accepted", "offer_sent", "rejected_before_interview", "rejected_after_interview", "waiting_list", "not_this_time"] as const;

const DECISION_LABEL: Record<string, string> = {
  accepted: "Accepted",
  offer_sent: "Offer sent",
  rejected_before_interview: "Rejected before interview",
  rejected_after_interview: "Rejected after interview",
  waiting_list: "Waiting list",
  not_this_time: "Not this time",
};

const MARK_ROWS = [
  ["language_awareness", "Language awareness"],
  ["accuracy", "Accuracy"],
  ["organisation", "Organisation"],
  ["range", "Range"],
  ["substance", "Substance"],
] as const;
const MARK_LABEL: Record<string, string> = { above: "Above standard", at: "At standard", below: "Below standard" };

const IDENTITY_DOCUMENT_LABEL: Record<string, string> = {
  passport: "passport",
  national_id: "national ID card",
  driving_licence: "driving licence",
  other: "another photo ID",
};

type InterviewRecordRow = {
  applicant_id: string;
  fixed_questions: { question_id: string; question_text: string; answer_text: string }[];
  drawn_questions: { question_text: string; answer_text: string; drawn_reason: string | null }[];
  interviewer_signature_name: string | null;
  interviewer_signed_at: string | null;
  applicant_signature_name: string | null;
  overall_notes: string | null;
  // Migration 0291; the generated types lag.
  identity_checked_at?: string | null;
  identity_document_type?: string | null;
};

export default async function AssessorApplicationFilesPage() {
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

  const { data: applicants } = await admin
    .from("applicants")
    // One literal, not a concatenation: the client types the row from the
    // select string and a joined expression types as an error.
    .select(
      "id, full_name, stage, writing_task_prompt_id, writing_task_submission, language_awareness_submission, marking_language_awareness, marking_language_awareness_note, marking_accuracy, marking_accuracy_note, marking_organisation, marking_organisation_note, marking_range, marking_range_note, marking_substance, marking_substance_note, marked_by, marked_at, task_feedback, rejection_reason, rejected_at, offer_sent_at, accepted_at, waiting_list_position"
    )
    .eq("intake_course_id", courseId)
    .in("stage", [...DECIDED_STAGES])
    .order("full_name");
  const files = applicants ?? [];
  const applicantIds = files.map((a) => a.id);
  const promptIds = [...new Set(files.map((a) => a.writing_task_prompt_id).filter((id): id is string => Boolean(id)))];

  const [{ data: recordRows }, { data: prompts }] = await Promise.all([
    applicantIds.length > 0
      ? admin.from("interview_records").select("*").in("applicant_id", applicantIds)
      : Promise.resolve({ data: null }),
    promptIds.length > 0
      ? admin.from("application_writing_prompts").select("id, prompt_type, prompt_text").in("id", promptIds)
      : Promise.resolve({ data: null }),
  ]);
  const records = (recordRows ?? []) as unknown as InterviewRecordRow[];
  const recordByApplicant = new Map(records.map((r) => [r.applicant_id, r]));
  const promptById = new Map((prompts ?? []).map((p) => [p.id, p]));

  const markerIds = [...new Set(files.map((a) => a.marked_by).filter((id): id is string => Boolean(id)))];
  const { data: markers } = markerIds.length > 0 ? await admin.from("profiles").select("id, full_name").in("id", markerIds) : { data: null };
  const markerName = new Map((markers ?? []).map((p) => [p.id, p.full_name]));

  const accepted = files.filter((a) => a.stage === "accepted" || a.stage === "offer_sent");
  const others = files.filter((a) => !(a.stage === "accepted" || a.stage === "offer_sent"));

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-background)" }}>
      <AssessorReadOnlyBanner subject="the course" />
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "34px 24px 60px" }}>
        <div className="frame" style={{ padding: 24 }}>
          {/* The banner above carries the one door back to the pack. */}
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED }}>
            Assessor access — read-only · application files
          </p>
          <h1 style={{ fontFamily: "Georgia, serif", fontSize: 26, fontWeight: 600, marginTop: 6, color: INK }}>
            Application files
          </h1>
          <p style={{ fontSize: 13, color: MUTED, marginTop: 8, maxWidth: 720, lineHeight: 1.6 }}>
            Selection on {course.name}: the written task, the language awareness answer, the marks against the scheme
            and the interview record for every applicant the centre decided on — {accepted.length} accepted,{" "}
            {others.length} not. Names only, as §12.2 asks; nothing else that identifies them is shown here.
          </p>

          {files.length === 0 ? (
            <p className="card" style={{ marginTop: 26, padding: "18px 20px", fontSize: 13, color: FAINT }}>
              No selection decisions for this course went through Connect, so there are no files to draw on here.
              A centre that selected on paper uploads its application files under centre documents.
            </p>
          ) : (
            <>
              {renderGroup("Accepted", accepted, true)}
              {renderGroup("Rejected, waiting and not this time", others, false)}
            </>
          )}
        </div>
      </div>
    </div>
  );

  // A plain render helper, not a nested component: it closes over the
  // lookups above and this is a server component that renders once.
  function renderGroup(title: string, files: typeof accepted, first: boolean) {
    if (files.length === 0) return null;
    return (
      <>
        <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED, marginTop: first ? 26 : 30 }}>
          {title} · {files.length}
        </p>
        {files.map((a) => {
          const record = recordByApplicant.get(a.id) ?? null;
          const prompt = a.writing_task_prompt_id ? promptById.get(a.writing_task_prompt_id) : null;
          const decisionDate =
            a.stage === "accepted" ? a.accepted_at : a.stage === "offer_sent" ? a.offer_sent_at : a.rejected_at;
          const languageAwareness = Array.isArray(a.language_awareness_submission)
            ? (a.language_awareness_submission as { question: string; answer: string }[])
            : [];
          const marked = Boolean(a.marked_at);
          return (
            <div key={a.id} className="card" style={{ marginTop: 14, padding: "18px 20px" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <h2 style={{ fontFamily: "Georgia, serif", fontSize: 19, fontWeight: 600, color: INK }}>{a.full_name}</h2>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: a.stage === "accepted" || a.stage === "offer_sent" ? TEAL : MUTED }}>
                  {DECISION_LABEL[a.stage] ?? a.stage}
                  {a.stage === "waiting_list" && a.waiting_list_position ? ` · position ${a.waiting_list_position}` : ""}
                  {decisionDate ? ` · ${formatDate(decisionDate, timeZone, { year: "numeric" })}` : ""}
                </span>
              </div>
              {a.rejection_reason ? (
                <p style={{ fontSize: 12.5, color: INK, marginTop: 6, lineHeight: 1.55 }}>
                  <span style={{ color: MUTED }}>Reason given: </span>
                  {a.rejection_reason}
                </p>
              ) : null}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18, marginTop: 14 }}>
                <div>
                  <SectionLabel text="Written task" />
                  {a.writing_task_submission ? (
                    <details>
                      <summary style={{ fontSize: 12.5, color: TEAL, cursor: "pointer", fontWeight: 600 }}>
                        {prompt ? `${prompt.prompt_type[0].toUpperCase()}${prompt.prompt_type.slice(1)} — read the task` : "Read the task"}
                      </summary>
                      {prompt ? <p style={{ fontSize: 11.5, color: MUTED, marginTop: 6, fontStyle: "italic" }}>{prompt.prompt_text}</p> : null}
                      <p style={{ fontSize: 12.5, color: INK, marginTop: 6, lineHeight: 1.6, whiteSpace: "pre-line" }}>{a.writing_task_submission}</p>
                    </details>
                  ) : (
                    <p style={{ fontSize: 12, color: AMBER }}>No written task on file.</p>
                  )}

                  {languageAwareness.length > 0 ? (
                    <details style={{ marginTop: 8 }}>
                      <summary style={{ fontSize: 12.5, color: TEAL, cursor: "pointer", fontWeight: 600 }}>Language awareness answer</summary>
                      {languageAwareness.map((qa, i) => (
                        <div key={i} style={{ marginTop: 6 }}>
                          <p style={{ fontSize: 11.5, color: MUTED, fontStyle: "italic" }}>{qa.question}</p>
                          <p style={{ fontSize: 12.5, color: INK, marginTop: 3, lineHeight: 1.55, whiteSpace: "pre-line" }}>{qa.answer}</p>
                        </div>
                      ))}
                    </details>
                  ) : null}

                  <SectionLabel text="Marks against the scheme" top={14} />
                  {marked ? (
                    <>
                      <table style={{ fontSize: 12.5, color: INK, borderCollapse: "collapse", width: "100%" }}>
                        <tbody>
                          {MARK_ROWS.map(([key, label]) => {
                            const value = a[`marking_${key}` as keyof typeof a] as string | null;
                            const note = a[`marking_${key}_note` as keyof typeof a] as string | null;
                            return (
                              <tr key={key}>
                                <td style={{ padding: "3px 0", color: MUTED, width: 150 }}>{label}</td>
                                <td style={{ padding: "3px 0", fontWeight: 600, color: value === "below" ? AMBER : INK }}>
                                  {value ? MARK_LABEL[value] : "—"}
                                  {note ? <span style={{ fontWeight: 400, color: MUTED }}> · {note}</span> : null}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {a.task_feedback ? (
                        <p style={{ fontSize: 12.5, color: INK, marginTop: 6, lineHeight: 1.55, whiteSpace: "pre-line" }}>
                          <span style={{ color: MUTED }}>Tutor feedback: </span>
                          {a.task_feedback}
                        </p>
                      ) : null}
                      <p style={{ fontSize: 11, color: FAINT, marginTop: 4 }}>
                        Marked {formatDate(a.marked_at, timeZone, { year: "numeric" })}
                        {a.marked_by && markerName.get(a.marked_by) ? ` by ${markerName.get(a.marked_by)}` : ""}
                      </p>
                    </>
                  ) : (
                    <p style={{ fontSize: 12, color: AMBER }}>Not marked.</p>
                  )}
                </div>

                <div>
                  <SectionLabel text="Interview record" />
                  {!record ? (
                    <p style={{ fontSize: 12, color: a.stage === "rejected_before_interview" ? FAINT : AMBER }}>
                      {a.stage === "rejected_before_interview" ? "Not interviewed — turned down on the task." : "No interview record saved."}
                    </p>
                  ) : (
                    <>
                      <p style={{ fontSize: 12, color: record.identity_checked_at ? MUTED : AMBER, lineHeight: 1.5 }}>
                        {record.identity_checked_at
                          ? `Identity checked — ${IDENTITY_DOCUMENT_LABEL[record.identity_document_type ?? ""] ?? "a document"} seen, ${formatDate(record.identity_checked_at, timeZone, { year: "numeric" })}.`
                          : "Identity not recorded as checked (Handbook §7.2)."}
                      </p>
                      {record.fixed_questions.map((q, i) => (
                        <div key={`f${i}`} style={{ marginTop: 8 }}>
                          <p style={{ fontSize: 11.5, color: MUTED, fontStyle: "italic" }}>{q.question_text}</p>
                          <p style={{ fontSize: 12.5, color: INK, marginTop: 2, lineHeight: 1.55, whiteSpace: "pre-line" }}>{q.answer_text || "—"}</p>
                        </div>
                      ))}
                      {record.drawn_questions.map((q, i) => (
                        <div key={`d${i}`} style={{ marginTop: 8 }}>
                          <p style={{ fontSize: 11.5, color: MUTED, fontStyle: "italic" }}>
                            {q.question_text}
                            {q.drawn_reason ? <span style={{ fontStyle: "normal" }}> · drawn because: {q.drawn_reason}</span> : null}
                          </p>
                          <p style={{ fontSize: 12.5, color: INK, marginTop: 2, lineHeight: 1.55, whiteSpace: "pre-line" }}>{q.answer_text || "—"}</p>
                        </div>
                      ))}
                      {record.overall_notes ? (
                        <p style={{ fontSize: 12.5, color: INK, marginTop: 10, lineHeight: 1.55, whiteSpace: "pre-line" }}>
                          <span style={{ color: MUTED }}>Overall: </span>
                          {record.overall_notes}
                        </p>
                      ) : null}
                      <p style={{ fontSize: 11, color: FAINT, marginTop: 6 }}>
                        {record.interviewer_signature_name ? `Signed ${record.interviewer_signature_name}` : "Unsigned"}
                        {record.interviewer_signed_at ? `, ${formatDate(record.interviewer_signed_at, timeZone, { year: "numeric" })}` : ""}
                        {record.applicant_signature_name ? ` · countersigned by the applicant` : ""}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </>
    );
  }
}

function SectionLabel({ text, top = 0 }: { text: string; top?: number }) {
  return (
    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED, marginTop: top, marginBottom: 4 }}>
      {text}
    </p>
  );
}
