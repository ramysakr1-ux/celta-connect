import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { ASSESSOR_COOKIE, getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { computeAssessorReadiness, buildCandidateCards } from "@/lib/assessor-pack";
import { toLocalIso } from "@/lib/timetable-grid";
import { DesignerCredit } from "@/components/designer-credit";
import { Wordmark } from "@/components/wordmark";

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

// The design file's own palette, so status colour is not re-invented here.
const GOLD = "oklch(60% 0.11 70)";
const GREEN = "oklch(48% 0.09 150)";
const AMBER = "oklch(44% 0.1 68)";

// Verbatim from Assessor Visit.dc.html -- names and captions both. Handbook
// terms, not paraphrases: "Application files / Including rejected applicants"
// and "The previous assessor's report" are the assessor pack's own wording.
const CENTRE_DOCUMENTS: { name: string; meta: string }[] = [
  { name: "Centre authorisation certificate", meta: "Cambridge centre number on file" },
  { name: "Candidate agreement & policies", meta: "Attendance, plagiarism, complaints, resubmission" },
  { name: "Application files", meta: "Including rejected applicants" },
  { name: "Volunteer attendance registers", meta: "All classes taught on this course" },
  { name: "Double-marking record", meta: "Blind second marks, all assignments" },
  { name: "Sample end-of-course report", meta: "Format only \u2014 the real one follows the grade meeting" },
  { name: "The previous assessor's report", meta: "The centre's most recent visit" },
  { name: "Marking guidance", meta: "Centre's standardisation evidence, dated" },
];

const GRADE_PILL: Record<string, string> = {
  "Pass A": "pill-gold",
  "Pass B": "pill-neutral",
  Pass: "pill-success",
  Fail: "pill-danger",
};

// for-claude-code-assessor-interface.md -- the real dedicated single
// screen, replacing what used to be a bare redirect into a trimmed slice
// of the trainer UI (roster/grades-report/attendance-register with fewer
// tabs -- src/app/trainer/(hub)/layout.tsx's isAssessor flag). No account,
// no tabs, nothing editable: everything here reads via the admin client,
// scoped only by the course_id the token resolves to.
//
// Three of the spec's own "ask, don't invent" questions are deliberately
// NOT resolved here -- see the memory note this build left behind:
// (1) whether the centre nominates a subset of candidates to show (this
// shows all active candidates), (2) live TP joining links for the
// assessor beyond the existing "Observable" status, (3) the exact centre-
// document list. For (3), this reuses the real `resources` table's
// existing `category = 'centre_documents'` rows (already a working
// concept on the trainer Resource Hub) rather than inventing a document
// taxonomy -- whatever the centre has actually uploaded shows here, no more.
export default async function AssessorPage() {
  const cookieStore = await cookies();
  if (!cookieStore.get(ASSESSOR_COOKIE)?.value) redirect("/login");
  const courseId = await getAssessorCourseId();
  if (!courseId) redirect("/login?error=assessor_link_invalid");

  const admin = createAdminClient();
  const today = toLocalIso(new Date());

  const [{ data: course }, { data: accessToken }, readiness, candidates] = await Promise.all([
    admin.from("courses").select("*, centers(name, center_number)").eq("id", courseId).maybeSingle(),
    admin.from("course_access_tokens").select("expires_at").eq("course_id", courseId).eq("role", "assessor").maybeSingle(),
    computeAssessorReadiness(admin, courseId),
    buildCandidateCards(admin, courseId),
  ]);

  if (!course) redirect("/login?error=assessor_link_invalid");

  const center = course.centers as unknown as { name: string; center_number: string } | null;

  const sendByDate = course.assessor_visit_date ? addDays(course.assessor_visit_date, -2) : null;
  const daysOut = sendByDate ? Math.ceil((new Date(`${sendByDate}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000) : null;

  const [{ data: tutorRows }, { data: onDayEvents }, { data: centreDocs }] = await Promise.all([
    admin.from("course_tutors").select("profile_id, tutor_role").eq("course_id", courseId).is("left_at", null),
    course.assessor_visit_date
      ? admin.from("course_timetable_events").select("*").eq("course_id", courseId).eq("event_date", course.assessor_visit_date).order("event_time")
      : Promise.resolve({ data: [] }),
    admin.from("resources").select("id, title, file_url").eq("center_id", course.center_id).eq("category", "centre_documents"),
  ]);

  const tutorProfileIds = (tutorRows ?? []).map((t) => t.profile_id);
  const { data: tutorProfiles } =
    tutorProfileIds.length > 0 ? await admin.from("profiles").select("id, full_name").in("id", tutorProfileIds) : { data: [] };
  const tutorNameById = new Map((tutorProfiles ?? []).map((p) => [p.id, p.full_name]));

  // "Assignment briefs" cohort document -- reuses an existing, already
  // assessor-safe candidate resources page (portfolio/[traineeId]/resources
  // already checks getAssessorCourseId) rather than a course-level page,
  // since briefs are identical for the whole cohort.
  const firstCandidateId = candidates[0]?.traineeId ?? null;

  const courseDates =
    course.start_date && course.end_date
      ? `${new Date(`${course.start_date}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} \u2013 ${new Date(`${course.end_date}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
      : "";

  const CARD = "oklch(99.2% 0.005 90)";
  const BORDER = "oklch(88% 0.016 82)";
  const INK = "oklch(23.5% 0.017 65)";
  const MUTED = "oklch(51% 0.017 70)";
  const WARM = "oklch(30% 0.042 58)";
  const TEAL = "oklch(38% 0.072 195)";
  const CREAM = "oklch(97% 0.008 88)";

  return (
    <div style={{ minHeight: "100vh", background: "oklch(92.5% 0.012 85)" }}>
      <div
        style={{
          background: WARM, color: CREAM, padding: "10px 32px", display: "flex",
          alignItems: "center", justifyContent: "space-between", gap: 16,
        }}
      >
        <span style={{ fontSize: 12.5, fontWeight: 500 }}>
          Assessor access — read-only. Nothing you open here can be edited, and no action you take is recorded
          against a candidate.
        </span>
        {accessToken ? (
          <span style={{ fontSize: 11.5, color: "oklch(76% 0.02 80)", flex: "none" }}>
            Link expires {accessToken.expires_at.slice(0, 10)}
          </span>
        ) : null}
      </div>

      <header
        style={{
          height: 60, background: CARD, borderBottom: `1px solid ${BORDER}`, display: "flex",
          alignItems: "center", justifyContent: "space-between", padding: "0 32px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              width: 30, height: 30, borderRadius: 7, background: WARM, display: "flex",
              alignItems: "center", justifyContent: "center", flex: "none",
            }}
          >
            <svg viewBox="8 30 104 60" width={19} height={11} fill="none" aria-label="Connect" role="img">
              <path d="M56.1 42.2 A 24 24 0 1 0 56.1 77.8" stroke="oklch(70% 0.12 72)" strokeWidth={15} strokeLinecap="round" />
              <path d="M96.1 42.2 A 24 24 0 1 0 96.1 77.8" stroke={CARD} strokeWidth={15} strokeLinecap="round" />
            </svg>
          </span>
          <span style={{ fontFamily: "var(--font-instrument-serif), Newsreader, Georgia, serif", fontStyle: "italic", fontSize: 18, color: INK }}>
            Connect
          </span>
          <span style={{ width: 1, height: 20, background: BORDER }} aria-hidden />
          <span
            style={{
              fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
              color: "oklch(60% 0.11 70)", background: "color-mix(in oklab, oklch(60% 0.11 70) 10%, oklch(99.2% 0.005 90))",
              border: "1px solid color-mix(in oklab, oklch(60% 0.11 70) 26%, transparent)",
              borderRadius: 99, padding: "4px 10px",
            }}
          >
            Assessor · read-only
          </span>
        </div>
        <a
          href="/assessor/pack.pdf"
          style={{
            height: 34, padding: "0 15px", borderRadius: 6, border: `1px solid ${BORDER}`, background: CARD,
            color: INK, fontSize: 12.5, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 8,
            textDecoration: "none",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M8 2v8m0 0 3-3m-3 3L5 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2.5 11.5v1a1.5 1.5 0 0 0 1.5 1.5h8a1.5 1.5 0 0 0 1.5-1.5v-1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          Download whole pack
        </a>
      </header>

      <div style={{ padding: "28px 32px 44px", display: "flex", flexDirection: "column", gap: 22 }}>
        <div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 20 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED }}>
                {center?.name ?? "Centre"} · {center?.center_number ?? ""} · {course.name}
                {courseDates ? ` · ${courseDates}` : ""}
              </p>
              <h1 style={{ fontFamily: "Newsreader, Georgia, serif", fontSize: 28, fontWeight: 600, color: INK, marginTop: 6 }}>
                Assessor visit{course.assessor_visit_date ? ` — ${course.assessor_visit_date}` : ""}
              </h1>
            </div>
            <div style={{ display: "flex", gap: 34 }}>
              <Figure label="Send by" value={sendByDate ?? "Not set"} ink={GOLD} />
              <Figure
                label="Portfolios complete"
                value={`${readiness.portfoliosCompleteCount} of ${readiness.totalCandidates}`}
                ink={readiness.portfoliosCompleteCount >= readiness.totalCandidates ? GREEN : AMBER}
              />
              <Figure label="Hours logged" value={readiness.hoursAssessedTotal.toFixed(1)} ink={GREEN} />
              <Figure
                label="Grades entered"
                value={`${readiness.gradesEnteredCount} of ${readiness.totalCandidates}`}
                ink={readiness.gradesEnteredCount >= readiness.totalCandidates ? GREEN : AMBER}
              />
            </div>
          </div>
        </div>

        {sendByDate ? (
          <div
            style={{
              display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 7,
              background: "color-mix(in oklab, oklch(60% 0.11 70) 8%, oklch(99.2% 0.005 90))",
              border: "1px solid color-mix(in oklab, oklch(60% 0.11 70) 26%, transparent)",
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: GOLD }}>
              Send the pack by {sendByDate}
              {daysOut !== null ? ` · ${daysOut} day${daysOut === 1 ? "" : "s"} out` : ""}
            </span>
            <span style={{ fontSize: 12, color: INK }}>Everything below must be complete by that date, not the visit date.</span>
          </div>
        ) : null}

        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 20, alignItems: "start" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
            {candidates.map((c) => (
              <Link
                key={c.traineeId}
                href={`/portfolio/${c.traineeId}`}
                style={{
                  background: CARD,
                  border: `1px solid ${c.flaggedIssue ? "color-mix(in oklab, oklch(44% 0.1 68) 45%, transparent)" : BORDER}`,
                  borderRadius: 8, padding: "15px 16px", display: "flex", flexDirection: "column", gap: 10,
                  textDecoration: "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: INK }}>{c.name}</span>
                  {c.provisionalLabel ? (
                    <span className={`pill ${GRADE_PILL[c.provisionalLabel] ?? "pill-neutral"}`} style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 99 }}>
                      {c.provisionalLabel}
                    </span>
                  ) : null}
                </div>
                <span style={{ fontSize: 11, color: MUTED }}>
                  {c.tpsTaught}/8 TPs · {c.hoursAssessed.toFixed(1)} hrs{c.levels.length > 0 ? ` · ${c.levels.join(", ")}` : ""}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Dot ok={c.celta5Complete} label="CELTA 5" />
                  <Dot ok={c.tpsComplete} label="TPs" />
                  <Dot ok={c.assignmentsComplete} label="Assignments" />
                </div>
                {c.flaggedIssue ? (
                  <span
                    style={{
                      fontSize: 11, lineHeight: 1.4, color: AMBER, borderRadius: 5, padding: "6px 9px",
                      background: "color-mix(in oklab, oklch(44% 0.1 68) 10%, oklch(99.2% 0.005 90))",
                    }}
                  >
                    {c.flaggedIssue}
                  </span>
                ) : null}
              </Link>
            ))}
            {candidates.length === 0 ? <p style={{ fontSize: 12.5, color: MUTED }}>No candidates on this course.</p> : null}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <Panel title="Cohort documents">
              <DocRow label="Grades report" href="/trainer/grades-report" status="Live" />
              <DocRow label="Course timetable" href="/trainer/timetable" status="Live" />
              {firstCandidateId ? <DocRow label="Assignment titles" href={`/portfolio/${firstCandidateId}/resources`} status="Live" /> : null}
              <DocRow label="Tutor list and roles" href="#tutor-list" status="Live" />
              <DocRow label="Candidate descriptions" href="/trainer/roster" status="Live" />
              <DocRow label="Lesson plans for the day" href="/trainer/timetable" status="Live" />
            </Panel>

            <div>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: GOLD, marginBottom: 8 }}>
                On the day
              </p>
              <div
                style={{
                  background: CARD, border: "1px solid color-mix(in oklab, oklch(60% 0.11 70) 26%, transparent)",
                  borderRadius: 7, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 9,
                }}
              >
                {(onDayEvents ?? []).length === 0 ? (
                  <span style={{ fontSize: 12, color: MUTED }}>
                    {course.assessor_visit_date ? "No timetable events on the visit date yet." : "No assessor visit date set yet."}
                  </span>
                ) : (
                  (onDayEvents ?? []).map((e) => (
                    <div key={e.id} style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: MUTED, width: 58, flex: "none", fontVariantNumeric: "tabular-nums" }}>
                        {e.event_time?.slice(0, 5) ?? ""}
                      </span>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: INK }}>{e.title}</span>
                    </div>
                  ))
                )}
                <span style={{ fontSize: 11.5, lineHeight: 1.5, color: MUTED, paddingTop: 4, borderTop: "1px solid oklch(90% 0.012 85)" }}>
                  Live TP joining links and the count of candidates who requested to speak with the assessor aren&apos;t tracked yet.
                </span>
              </div>
            </div>

            <Panel title="Centre documents">
              {CENTRE_DOCUMENTS.map((doc) => {
                const uploaded = (centreDocs ?? []).find((d) => d.title.trim().toLowerCase() === doc.name.toLowerCase());
                return (
                  <div
                    key={doc.name}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                      padding: "11px 15px", borderBottom: "1px solid color-mix(in srgb, oklch(88% 0.016 82) 45%, transparent)",
                    }}
                  >
                    <div>
                      <p style={{ fontSize: 12.5, fontWeight: 600, color: INK }}>{doc.name}</p>
                      <p style={{ fontSize: 10.5, color: MUTED }}>{doc.meta}</p>
                    </div>
                    {uploaded?.file_url ? (
                      <a href={uploaded.file_url} style={{ fontSize: 11, fontWeight: 600, color: TEAL, flex: "none", textDecoration: "none" }}>
                        Open →
                      </a>
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 600, color: AMBER, flex: "none" }}>Not uploaded</span>
                    )}
                  </div>
                );
              })}
              {tutorNameById.size > 0 ? (
                <div id="tutor-list" style={{ padding: "11px 15px" }}>
                  <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED }}>Tutor list</p>
                  {(tutorRows ?? []).map((t) => (
                    <p key={t.profile_id} style={{ fontSize: 12, color: INK }}>
                      {tutorNameById.get(t.profile_id) ?? "Unknown"}
                      {t.tutor_role ? <span style={{ color: MUTED }}> · {t.tutor_role.replace(/_/g, " ")}</span> : null}
                    </p>
                  ))}
                </div>
              ) : null}
            </Panel>

            <div>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED, marginBottom: 8 }}>
                Not in this pack
              </p>
              <div style={{ background: "oklch(96.4% 0.014 85)", border: `1px solid ${BORDER}`, borderRadius: 7, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 9 }}>
                {[
                  { title: "The assessor's own report", why: "Goes to Cambridge's own secure system, not here." },
                  { title: "Staff chat", why: "Trainer-only, resets on the centre's schedule." },
                  { title: "Trainee-only chat", why: "A deliberate privacy boundary." },
                ].map((x) => (
                  <div key={x.title}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: INK }}>{x.title}</p>
                    <p style={{ fontSize: 11.5, lineHeight: 1.5, color: MUTED }}>{x.why}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <DesignerCredit />
    </div>
  );
}

function Figure({ label, value, ink }: { label: string; value: string; ink?: string }) {
  return (
    <div>
      <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "oklch(51% 0.017 70)" }}>
        {label}
      </p>
      <p style={{ fontFamily: "Newsreader, Georgia, serif", fontSize: 21, lineHeight: 1, color: ink ?? "oklch(23.5% 0.017 65)", marginTop: 5 }}>
        {value}
      </p>
    </div>
  );
}

function Dot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: ok ? GREEN : AMBER }} />
      <span style={{ fontSize: 10.5, color: "oklch(51% 0.017 70)" }}>{label}</span>
    </span>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "oklch(51% 0.017 70)", marginBottom: 8 }}>
        {title}
      </p>
      <div style={{ background: "oklch(99.2% 0.005 90)", border: "1px solid oklch(88% 0.016 82)", borderRadius: 7, overflow: "hidden" }}>
        {children}
      </div>
    </div>
  );
}

function DocRow({ label, href, status }: { label: string; href: string; status: string }) {
  return (
    <div
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        padding: "11px 15px", borderBottom: "1px solid color-mix(in srgb, oklch(88% 0.016 82) 45%, transparent)",
      }}
    >
      <div>
        <p style={{ fontSize: 12.5, fontWeight: 600, color: "oklch(23.5% 0.017 65)" }}>{label}</p>
        <p style={{ fontSize: 10.5, color: GREEN }}>{status}</p>
      </div>
      <a href={href} style={{ fontSize: 11, fontWeight: 600, color: "oklch(38% 0.072 195)", flex: "none", textDecoration: "none" }}>
        Open →
      </a>
    </div>
  );
}
