import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { ASSESSOR_COOKIE, getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { computeAssessorReadiness, buildCandidateCards } from "@/lib/assessor-pack";
import { toLocalIso } from "@/lib/timetable-grid";
import { DesignerCredit } from "@/components/designer-credit";

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

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

  return (
    <div className="min-h-screen bg-[oklch(92.5%_0.012_85)]">
      <div className="bg-[oklch(38%_0.072_195)] px-6 py-2.5 text-center text-sm text-white">
        Assessor access — read-only. Nothing you open here can be edited, and no action you take is recorded
        against a candidate.
        {accessToken ? ` · Link expires ${accessToken.expires_at.slice(0, 10)}` : null}
      </div>

      <header className="flex items-center justify-between border-b border-[oklch(88%_0.016_82)] bg-[oklch(99.2%_0.005_90)] px-6 py-3">
        <div className="flex items-center gap-3">
          <span className="font-serif text-lg italic text-[oklch(60%_0.11_70)]">Connect</span>
          <span className="pill pill-neutral">Assessor · read-only</span>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-6 py-6">
        <div className="rounded-[8px] border border-[oklch(88%_0.016_82)] bg-[oklch(99.2%_0.005_90)] p-6">
          <p className="text-xs uppercase tracking-[0.1em] text-[oklch(51%_0.017_70)]">
            {center?.name ?? "Centre"} · {center?.center_number ?? ""} · {course.name}
          </p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <h1 className="font-serif text-2xl text-[oklch(23.5%_0.017_65)]">
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
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Figure label="Portfolios complete" value={`${readiness.portfoliosCompleteCount} / ${readiness.totalCandidates}`} />
            <Figure label="Assessed hours logged" value={readiness.hoursAssessedTotal.toFixed(1)} />
            <Figure label="Grades entered" value={`${readiness.gradesEnteredCount} / ${readiness.totalCandidates}`} />
            <Figure label="Candidates" value={String(readiness.totalCandidates)} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
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
            <Panel title="Cohort documents">
              <DocRow label="Grades report" href="/trainer/grades-report" />
              {firstCandidateId ? <DocRow label="Assignment briefs" href={`/portfolio/${firstCandidateId}/resources`} /> : null}
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

            <Panel title="Centre documents">
              {(centreDocs ?? []).length === 0 ? (
                <p className="text-xs text-[oklch(51%_0.017_70)]">Nothing uploaded yet.</p>
              ) : (
                (centreDocs ?? []).map((d) => <DocRow key={d.id} label={d.title} href={d.file_url ?? "#"} />)
              )}
              {(tutorNameById.size ?? 0) > 0 ? (
                <div className="mt-2 border-t border-[oklch(88%_0.016_82)] pt-2">
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

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.08em] text-[oklch(51%_0.017_70)]">{label}</p>
      <p className="mt-0.5 font-serif text-lg text-[oklch(23.5%_0.017_65)]">{value}</p>
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
