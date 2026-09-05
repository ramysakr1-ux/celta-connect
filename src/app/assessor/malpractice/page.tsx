import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { ASSESSOR_COOKIE, getAssessorCourseId, getAssessorTermsStatus, isAssessorPreview } from "@/lib/auth/portfolio-access";
import { AssessorReadOnlyBanner } from "@/components/assessor-readonly-banner";

const INK = "oklch(23.5% 0.017 65)";
const MUTED = "oklch(51% 0.017 70)";
const AMBER = "oklch(44% 0.1 68)";

// for-claude-code-malpractice-outcomes.md / Malpractice.dc.html's own case
// note: "It goes in the assessor pack. Every case, upheld or not, with the
// full timeline."
//
// This used to be a panel on the landing page. The v2 landing
// (design_handoff_assessor_landing_v2) carries candidates and a rail and
// nothing else, so the cases move here and the rail's "Also on file" row
// opens them -- the same content, one click further out, instead of a block
// of case notes sitting between the reading list and the pack.
//
// No case-detail route exists for a token-only assessor to click into
// (/trainer/malpractice/[caseId] wants a real trainer session), so every
// field is shown inline here rather than linked.
export default async function AssessorMalpracticePage() {
  const cookieStore = await cookies();
  if (!cookieStore.get(ASSESSOR_COOKIE)?.value) redirect("/login");
  const termsStatus = await getAssessorTermsStatus();
  if (!termsStatus) redirect("/login?error=assessor_link_invalid");
  if (!termsStatus.accepted && !(await isAssessorPreview())) redirect("/assessor/gate");
  const courseId = await getAssessorCourseId();
  if (!courseId) redirect("/login?error=assessor_link_invalid");

  const admin = createAdminClient();
  const [{ data: course }, { data: cases }] = await Promise.all([
    admin.from("courses").select("name").eq("id", courseId).maybeSingle(),
    admin
      .from("malpractice_cases")
      .select(
        "id, trainee_id, assignment_id, status, outcome, flagged_for_referral, decision_notes, opened_at, candidate_account, candidate_account_recorded_at, decided_at"
      )
      .eq("course_id", courseId)
      .order("opened_at", { ascending: false }),
  ]);
  if (!course) redirect("/login?error=assessor_link_invalid");

  const traineeIds = [...new Set((cases ?? []).map((c) => c.trainee_id))];
  const assignmentIds = [...new Set((cases ?? []).map((c) => c.assignment_id))];
  const [{ data: trainees }, { data: assignments }] = await Promise.all([
    traineeIds.length > 0 ? admin.from("profiles").select("id, full_name").in("id", traineeIds) : Promise.resolve({ data: [] }),
    assignmentIds.length > 0 ? admin.from("assignments").select("id, assignment_type").in("id", assignmentIds) : Promise.resolve({ data: [] }),
  ]);
  const traineeNameById = new Map((trainees ?? []).map((t) => [t.id, t.full_name]));
  const assignmentTypeById = new Map((assignments ?? []).map((a) => [a.id, a.assignment_type]));

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-background)" }}>
      <AssessorReadOnlyBanner subject="the course" />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "34px 24px 60px" }}>
        <div className="frame" style={{ padding: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED }}>
            Assessor access — read-only · malpractice
          </p>
          <h1 style={{ fontFamily: "var(--font-newsreader), Georgia, serif", fontSize: 26, fontWeight: 600, marginTop: 6, color: INK }}>
            Plagiarism and malpractice on {course.name}
          </h1>
          <p style={{ fontSize: 13, color: MUTED, marginTop: 8, maxWidth: 640, lineHeight: 1.6 }}>
            Every case raised on this course, upheld or not, with its full timeline — including the candidate&apos;s own
            account of it, which the centre must record before deciding.
          </p>

          {(cases ?? []).length === 0 ? (
            <p style={{ fontSize: 13, color: MUTED, marginTop: 22 }}>
              No plagiarism or malpractice case has been raised on this course.
            </p>
          ) : (
            (cases ?? []).map((c) => (
              <div key={c.id} className="card" style={{ marginTop: 16, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: INK }}>
                    {traineeNameById.get(c.trainee_id) ?? "Candidate"} · {assignmentTypeById.get(c.assignment_id) ?? "Assignment"}
                  </span>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: c.status === "open" ? AMBER : MUTED, flex: "none" }}>
                    {c.status === "open" ? "Open" : `Closed · ${c.outcome ?? "decided"}`}
                  </span>
                </div>
                {c.flagged_for_referral ? (
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: "oklch(45% 0.16 27)" }}>
                    Referred to the centre&apos;s malpractice procedure
                  </span>
                ) : null}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 16px", fontSize: 11.5, color: MUTED }}>
                  <span>Opened {new Date(c.opened_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span>
                  {c.candidate_account_recorded_at ? (
                    <span>
                      Candidate&apos;s account recorded{" "}
                      {new Date(c.candidate_account_recorded_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                    </span>
                  ) : null}
                  {c.decided_at ? (
                    <span>Decided {new Date(c.decided_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span>
                  ) : null}
                </div>
                {c.candidate_account ? (
                  <div>
                    <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: MUTED }}>
                      Candidate&apos;s account
                    </p>
                    <p style={{ fontSize: 12.5, color: INK, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{c.candidate_account}</p>
                  </div>
                ) : null}
                {c.decision_notes ? (
                  <div>
                    <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: MUTED }}>
                      Decision notes
                    </p>
                    <p style={{ fontSize: 12.5, color: INK, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{c.decision_notes}</p>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
