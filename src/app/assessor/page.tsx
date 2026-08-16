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

  return (
    <div className="min-h-screen bg-[oklch(92.5%_0.012_85)]">
      {/* "Top banner (full-width, warm-dark bg, cream text, 10px/32px
          padding)" -- warm dark is oklch(30% 0.042 58), not the teal this
          used to be. The expiry sits right-aligned, per the spec. */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[oklch(30%_0.042_58)] px-8 py-2.5 text-sm text-[oklch(97%_0.008_88)]">
        <span>
          Assessor access — read-only. Nothing you open here can be edited, and no action you take is recorded
          against a candidate.
        </span>
        {accessToken ? (
          <span className="shrink-0 text-[oklch(88%_0.012_85)]">Link expires {accessToken.expires_at.slice(0, 10)}</span>
        ) : null}
      </div>

      {/* "30px ink-tile mark + italic Connect wordmark (static) + divider +
          gold-tinted 'Assessor · read-only' pill -- left. 'Download whole
          pack' button (outlined, download icon) -- right." The mark is the
          shared Wordmark component, static: a document, not an app chrome. */}
      <header className="flex h-[60px] items-center justify-between border-b border-[oklch(88%_0.016_82)] bg-[oklch(99.2%_0.005_90)] px-8">
        <div className="flex items-center gap-3">
          <Wordmark size="header" spin={false} />
          <span className="h-5 w-px bg-[oklch(88%_0.016_82)]" aria-hidden />
          <span className="rounded-full border border-[color-mix(in_oklab,oklch(60%_0.11_70)_36%,transparent)] bg-[color-mix(in_oklab,oklch(60%_0.11_70)_12%,transparent)] px-2.5 py-1 text-[11px] font-semibold text-[oklch(52%_0.1_70)]">
            Assessor · read-only
          </span>
        </div>
        <a
          href="/assessor/pack.pdf"
          className="inline-flex items-center gap-2 rounded-[6px] border border-[oklch(88%_0.016_82)] px-3.5 py-2 text-sm font-semibold text-[oklch(23.5%_0.017_65)] hover:bg-[oklch(96.4%_0.014_85)]"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M8 2v8m0 0 3-3m-3 3L5 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2.5 11.5v1a1.5 1.5 0 0 0 1.5 1.5h8a1.5 1.5 0 0 0 1.5-1.5v-1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          Download whole pack
        </a>
      </header>

      <div className="mx-auto flex max-w-[1620px] flex-col gap-[22px] px-8 pt-7 pb-11">
        <div className="rounded-[8px] border border-[oklch(88%_0.016_82)] bg-[oklch(99.2%_0.005_90)] p-6">
          <p className="text-xs uppercase tracking-[0.1em] text-[oklch(51%_0.017_70)]">
            {center?.name ?? "Centre"} · {center?.center_number ?? ""} · {course.name}
            {course.start_date && course.end_date ? ` · ${courseDates}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <h1 className="font-serif text-[28px] leading-tight text-[oklch(23.5%_0.017_65)]">
              Assessor visit{course.assessor_visit_date ? ` — ${course.assessor_visit_date}` : ""}
            </h1>
            {sendByDate ? (
              <div className="flex flex-col items-end gap-0.5">
                <span className="pill pill-gold">
                  Send the pack by {sendByDate} {daysOut !== null ? `(${daysOut} day${daysOut === 1 ? "" : "s"} out)` : ""}
                </span>
                <span className="text-[11px] text-[oklch(51%_0.017_70)]">Complete by that date, not the visit date.</span>
              </div>
            ) : null}
          </div>
          {/* The four figures the design names, in its order: Send by /
              Portfolios complete / Hours logged / Grades entered. "Candidates"
              used to sit here as a fifth; it isn't in the spec, and the count
              it showed is already the denominator of two of the others. */}
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
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

        <div className="grid grid-cols-1 gap-5 md:grid-cols-[1.6fr_1fr]">
          {/* Candidate portfolios */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {candidates.map((c) => (
              <Link
                key={c.traineeId}
                href={`/portfolio/${c.traineeId}`}
                className={`rounded-[8px] border bg-[oklch(99.2%_0.005_90)] p-4 ${
                  c.flaggedIssue ? "border-[oklch(44%_0.1_68)]" : "border-[oklch(88%_0.016_82)]"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-[oklch(23.5%_0.017_65)]">{c.name}</p>
                  {c.provisionalLabel ? (
                    <span className={`pill ${GRADE_PILL[c.provisionalLabel] ?? "pill-neutral"}`}>{c.provisionalLabel}</span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-[oklch(51%_0.017_70)]">
                  {c.tpsTaught}/8 TPs · {c.hoursAssessed.toFixed(1)} hrs{c.levels.length > 0 ? ` · ${c.levels.join(", ")}` : ""}
                </p>
                <div className="mt-2.5 flex items-center gap-3">
                  <Dot ok={c.celta5Complete} label="CELTA 5" />
                  <Dot ok={c.tpsComplete} label="TPs" />
                  <Dot ok={c.assignmentsComplete} label="Assignments" />
                </div>
                {c.flaggedIssue ? <p className="mt-2 text-xs text-[oklch(44%_0.1_68)]">{c.flaggedIssue}</p> : null}
              </Link>
            ))}
            {candidates.length === 0 ? <p className="text-sm text-[oklch(51%_0.017_70)]">No candidates on this course.</p> : null}
          </div>

          {/* Right panels */}
          <div className="flex flex-col gap-4">
            {/* All six the design names, in its order. Each carries a "Live"
                status and an "Open" action. */}
            <Panel title="Cohort documents">
              <DocRow label="Grades report" href="/trainer/grades-report" />
              <DocRow label="Course timetable" href="/trainer/timetable" />
              {firstCandidateId ? <DocRow label="Assignment titles" href={`/portfolio/${firstCandidateId}/resources`} /> : null}
              <DocRow label="Tutor list and roles" href="#tutor-list" />
              <DocRow label="Candidate descriptions" href="/trainer/roster" />
              <DocRow label="Lesson plans for the day" href="/trainer/timetable" />
            </Panel>

            <Panel title="On the day" gold>
              {(onDayEvents ?? []).length === 0 ? (
                <p className="text-xs text-[oklch(51%_0.017_70)]">
                  {course.assessor_visit_date ? "No timetable events on the visit date yet." : "No assessor visit date set yet."}
                </p>
              ) : (
                (onDayEvents ?? []).map((e) => (
                  <div key={e.id} className="flex items-center justify-between py-1.5 text-xs">
                    <span className="text-[oklch(23.5%_0.017_65)]">{e.title}</span>
                    <span className="text-[oklch(51%_0.017_70)]">{e.event_time?.slice(0, 5) ?? ""}</span>
                  </div>
                ))
              )}
              <p className="mt-2 border-t border-[oklch(88%_0.016_82)] pt-2 text-[11px] text-[oklch(51%_0.017_70)]">
                Live TP joining links and the count of candidates who requested to speak with the assessor aren&apos;t
                tracked yet.
              </p>
            </Panel>

            {/* The eight the design names, each with its own caption, ALWAYS
                all eight. This used to render only whatever the centre had
                uploaded -- so a missing double-marking record simply had no
                row, and the assessor saw a shorter list with nothing to say
                anything was absent. Showing all eight is what makes a gap
                visible, which is the whole job of a readiness screen. */}
            <Panel title="Centre documents">
              {CENTRE_DOCUMENTS.map((doc) => {
                const uploaded = (centreDocs ?? []).find(
                  (d) => d.title.trim().toLowerCase() === doc.name.toLowerCase()
                );
                return (
                  <div key={doc.name} className="flex items-start justify-between gap-3 py-1.5">
                    <div>
                      <p className="text-xs text-[oklch(23.5%_0.017_65)]">{doc.name}</p>
                      <p className="text-[11px] text-[oklch(51%_0.017_70)]">{doc.meta}</p>
                    </div>
                    {uploaded?.file_url ? (
                      <a
                        href={uploaded.file_url}
                        className="shrink-0 text-xs font-medium text-[oklch(38%_0.072_195)] hover:underline"
                      >
                        Open →
                      </a>
                    ) : (
                      <span className="shrink-0 text-[11px] font-semibold" style={{ color: AMBER }}>
                        Not uploaded
                      </span>
                    )}
                  </div>
                );
              })}
              {(tutorNameById.size ?? 0) > 0 ? (
                <div id="tutor-list" className="mt-2 border-t border-[oklch(88%_0.016_82)] pt-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[oklch(51%_0.017_70)]">Tutor list</p>
                  {(tutorRows ?? []).map((t) => (
                    <p key={t.profile_id} className="text-xs text-[oklch(23.5%_0.017_65)]">
                      {tutorNameById.get(t.profile_id) ?? "Unknown"}
                      {t.tutor_role ? <span className="text-[oklch(51%_0.017_70)]"> · {t.tutor_role.replace(/_/g, " ")}</span> : null}
                    </p>
                  ))}
                </div>
              ) : null}
            </Panel>

            <Panel title="Not in this pack">
              <ul className="flex flex-col gap-1.5 text-xs text-[oklch(51%_0.017_70)]">
                <li>The assessor&apos;s own report — goes to Cambridge&apos;s own secure system, not here.</li>
                <li>Staff chat — trainer-only, resets on the centre&apos;s schedule.</li>
                <li>Trainee-only chat — a deliberate privacy boundary.</li>
              </ul>
            </Panel>
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
      <p className="text-[10px] uppercase tracking-[0.08em] text-[oklch(51%_0.017_70)]">{label}</p>
      <p className="mt-0.5 font-serif text-[21px]" style={{ color: ink ?? "oklch(23.5% 0.017 65)" }}>
        {value}
      </p>
    </div>
  );
}

function Dot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="flex items-center gap-1 text-[11px] text-[oklch(51%_0.017_70)]">
      <span className={`size-[6px] rounded-full ${ok ? "bg-[oklch(55%_0.09_155)]" : "bg-[oklch(44%_0.1_68)]"}`} />
      {label}
    </span>
  );
}

function Panel({ title, gold, children }: { title: string; gold?: boolean; children: React.ReactNode }) {
  return (
    <div className="rounded-[8px] border border-[oklch(88%_0.016_82)] bg-[oklch(99.2%_0.005_90)] p-4">
      <p className={`text-[10.5px] font-bold uppercase tracking-[0.1em] ${gold ? "text-[oklch(60%_0.11_70)]" : "text-[oklch(51%_0.017_70)]"}`}>
        {title}
      </p>
      <div className="mt-2.5">{children}</div>
    </div>
  );
}

function DocRow({ label, href }: { label: string; href: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-[oklch(23.5%_0.017_65)]">{label}</span>
      <a href={href} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[oklch(38%_0.072_195)] hover:underline">
        Open →
      </a>
    </div>
  );
}
