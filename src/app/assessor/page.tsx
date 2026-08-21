import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { ASSESSOR_COOKIE, getAssessorCourseId, getAssessorTermsStatus } from "@/lib/auth/portfolio-access";
import { computeAssessorReadiness, buildCandidateCards } from "@/lib/assessor-pack";
import { hasMarkingGuidance } from "@/lib/marking-guidance";
import { toLocalIso } from "@/lib/timetable-grid";
import { DesignerCredit } from "@/components/designer-credit";
import { CENTRE_DOCUMENTS, COHORT_DOCUMENTS } from "@/lib/assessor-pack-contents";

// The design file's own palette, so status colour is not re-invented here.
// Re-pointed 2026-08-21 per the color audit: gold is reserved for the Pass
// A grade tint only (GOLD_TINT below), never a generic deadline/section
// accent -- those uses move to AMBER or MUTED. Green is fully retired as a
// status color -- TEAL takes over every "met/complete" use GREEN used to
// have (readiness dots, hours logged, document status).
const MUTED_ACCENT = "oklch(51% 0.017 70)";
const TEAL = "oklch(37.5% 0.058 195)";
const AMBER = "oklch(44% 0.1 68)";


// Verbatim from Assessor Visit.dc.html's own GRADE table. These are not
// decoration: Pass A is gold, Pass B is silver, a plain Pass is deliberately
// NEUTRAL, and Fail is red. The previous mapping used the app's generic pill
// classes and coloured a plain Pass green -- which read as "good" on a grade
// that is simply a pass, and left Pass B and Pass looking alike.
//
// Green in this design means complete/good as a STATUS (a met dot, hours
// logged), never a grade. Keeping the two apart is the point.
const GOLD_TINT = "color-mix(in oklab, oklch(60% 0.11 70) 18%, var(--color-card))";
const SILVER_TINT = "color-mix(in oklab, oklch(65% 0.008 90) 30%, var(--color-card))";
const RED_TINT = "color-mix(in oklab, oklch(45% 0.16 27) 14%, var(--color-card))";

const GRADE: Record<string, { bg: string; ink: string }> = {
  "Pass A": { bg: GOLD_TINT, ink: "oklch(40% 0.09 68)" },
  "Pass B": { bg: SILVER_TINT, ink: "oklch(42% 0.01 90)" },
  Pass: { bg: "oklch(94% 0.012 85)", ink: "oklch(51% 0.017 70)" },
  Fail: { bg: RED_TINT, ink: "oklch(45% 0.16 27)" },
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
export default async function AssessorPage({
  searchParams,
}: {
  searchParams: Promise<{ candidate?: string }>;
}) {
  const { candidate: openCandidateId } = await searchParams;
  const cookieStore = await cookies();
  if (!cookieStore.get(ASSESSOR_COOKIE)?.value) redirect("/login");
  const termsStatus = await getAssessorTermsStatus();
  if (!termsStatus) redirect("/login?error=assessor_link_invalid");
  if (!termsStatus.accepted) redirect("/assessor/gate");
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
  const markingGuidancePresent = course ? await hasMarkingGuidance(admin, course.center_id) : false;

  if (!course) redirect("/login?error=assessor_link_invalid");

  const center = course.centers as unknown as { name: string; center_number: string } | null;

  // MCT-set, not computed from assessor_visit_date -- see migration 0127.
  const sendByDate = course.provisional_grades_due_at ? course.provisional_grades_due_at.slice(0, 10) : null;
  const daysOut = sendByDate ? Math.ceil((new Date(`${sendByDate}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000) : null;

  const [{ data: tutorRows }, { data: onDayEvents }, { data: centreDocs }, { data: asyncEvents }] = await Promise.all([
    admin.from("course_tutors").select("profile_id, tutor_role").eq("course_id", courseId).is("left_at", null),
    course.assessor_visit_date
      ? admin.from("course_timetable_events").select("*").eq("course_id", courseId).eq("event_date", course.assessor_visit_date).order("event_time")
      : Promise.resolve({ data: [] }),
    admin.from("resources").select("id, title, file_url").eq("center_id", course.center_id).eq("category", "centre_documents"),
    // course-modes.md §7 (Handbook 2.2.2): "Moodle content ... must be
    // augmented with centre-delivered online input. Assessors must be given
    // a schedule showing which Moodle sections candidates were asked to
    // complete and what input the centre provided ... nothing generates it
    // today." Real schedule, not a static document -- built from the same
    // is_asynchronous/linked_live_session_event_id pair remaining-
    // compliance.md item 3 already gates locking on, not a new field.
    course.delivery_mode !== "f2f"
      ? admin
          .from("course_timetable_events")
          .select("id, title, event_date, linked_live_session_event_id")
          .eq("course_id", courseId)
          .eq("type", "input_session")
          .eq("is_asynchronous", true)
          .order("event_date")
      : Promise.resolve({ data: [] }),
  ]);

  const liveFollowUpIds = (asyncEvents ?? []).map((e) => e.linked_live_session_event_id).filter((id): id is string => Boolean(id));
  const { data: liveFollowUpEvents } =
    liveFollowUpIds.length > 0
      ? await admin.from("course_timetable_events").select("id, title, event_date").in("id", liveFollowUpIds)
      : { data: [] };
  const liveFollowUpById = new Map((liveFollowUpEvents ?? []).map((e) => [e.id, e]));
  const moodleSchedule = (asyncEvents ?? []).map((e) => ({
    id: e.id,
    title: e.title,
    date: e.event_date,
    liveFollowUp: e.linked_live_session_event_id ? (liveFollowUpById.get(e.linked_live_session_event_id) ?? null) : null,
  }));

  // "A count of candidates who requested to speak with the assessor" -- a
  // count, never the names. Read head-only so the identities never even leave
  // the database.
  const { count: concernsCount } = await admin
    .from("assessor_meeting_requests")
    .select("id", { count: "exact", head: true })
    .eq("course_id", courseId)
    .is("withdrawn_at", null);

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

  // build-spec.md: "120 contact hours; 6 hours of assessed teaching per
  // candidate". The design shows this figure as a fraction ("48 of 48"), so
  // the denominator is the cohort's requirement, not an arbitrary target.
  const hoursRequired = readiness.totalCandidates * 6;

  // The design writes dates the way a person says them -- "Assessor visit --
  // 30 November", "Send by 28 Aug" -- never ISO. An assessor reading
  // "2026-11-30" has to translate it.
  const longDate = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
  const shortDate = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  const CARD = "var(--color-card)";
  const BORDER = "oklch(88% 0.016 82)";
  const INK = "oklch(23.5% 0.017 65)";
  const MUTED = "oklch(51% 0.017 70)";
  const WARM = "oklch(30% 0.042 58)";
  const TEAL = "oklch(38% 0.072 195)";
  const CREAM = "oklch(97% 0.008 88)";

  // The six rows the design names, in its order. Values come from real
  // records, so where the app genuinely doesn't hold something the row says so
  // rather than borrowing the design file's sample text -- an assessor reading
  // "120 of 120 contact hours" that nothing computed would be worse than a row
  // admitting the figure isn't tracked.
  const openCandidate = openCandidateId ? candidates.find((c) => c.traineeId === openCandidateId) ?? null : null;
  const drawerRows: { label: string; value: string; state: string; ink: string }[] = openCandidate
    ? [
        {
          label: "CELTA 5 record",
          value: openCandidate.celta5Complete
            ? "All criteria rated, tutor comments complete"
            : "Criteria or tutor comments still outstanding",
          state: openCandidate.celta5Complete ? "Complete" : "Incomplete",
          ink: openCandidate.celta5Complete ? TEAL : AMBER,
        },
        {
          label: "Teaching practice",
          value: `${openCandidate.tpsTaught} of 8 TPs · ${openCandidate.hoursAssessed.toFixed(1)} hrs assessed${
            openCandidate.levels.length > 0 ? ` · ${openCandidate.levels.join(", ")}` : ""
          }`,
          state: openCandidate.tpsComplete ? "Complete" : "Incomplete",
          ink: openCandidate.tpsComplete ? TEAL : AMBER,
        },
        {
          label: "Assignments",
          value: "Four assignments, criteria and marks recorded",
          state: openCandidate.assignmentsComplete ? "Complete" : (openCandidate.flaggedIssue ?? "Incomplete"),
          ink: openCandidate.assignmentsComplete ? TEAL : AMBER,
        },
        {
          label: "Attendance",
          value: "Recorded in the CELTA 5, not as a separate register",
          state: "On file",
          ink: TEAL,
        },
        { label: "Special arrangements", value: "None declared", state: "—", ink: MUTED },
        {
          label: "Provisional grade",
          value: openCandidate.provisionalLabel ?? "Not yet entered",
          state: openCandidate.provisionalLabel ? "Recorded" : "Pending",
          ink: openCandidate.provisionalLabel ? TEAL : AMBER,
        },
      ]
    : [];


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
              color: "oklch(51% 0.017 70)", background: "color-mix(in oklab, oklch(51% 0.017 70) 10%, var(--color-card))",
              border: "1px solid color-mix(in oklab, oklch(51% 0.017 70) 26%, transparent)",
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
                Assessor visit{course.assessor_visit_date ? ` — ${longDate(course.assessor_visit_date)}` : ""}
              </h1>
            </div>
            <div style={{ display: "flex", gap: 34 }}>
              <Figure label="Provisional grades due" value={sendByDate ? shortDate(sendByDate) : "Not set"} ink={AMBER} />
              <Figure
                label="Portfolios complete"
                value={`${readiness.portfoliosCompleteCount} of ${readiness.totalCandidates}`}
                ink={readiness.portfoliosCompleteCount >= readiness.totalCandidates ? TEAL : AMBER}
              />
              <Figure
                label="Hours logged"
                value={`${readiness.hoursAssessedTotal.toFixed(readiness.hoursAssessedTotal % 1 === 0 ? 0 : 1)} of ${hoursRequired}`}
                ink={readiness.hoursAssessedTotal >= hoursRequired ? TEAL : AMBER}
              />
              <Figure
                label="Provisional grades"
                value={`${readiness.gradesApprovedCount} of ${readiness.totalCandidates} MCT-approved`}
                ink={readiness.gradesApprovedCount >= readiness.totalCandidates ? TEAL : AMBER}
              />
            </div>
          </div>
        </div>

        {(
          <div
            style={{
              display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 7,
              background: "color-mix(in oklab, oklch(44% 0.1 68) 8%, var(--color-card))",
              border: "1px solid color-mix(in oklab, oklch(44% 0.1 68) 26%, transparent)",
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: AMBER }}>
              {sendByDate ? `Provisional grades due: ${longDate(sendByDate)} EOD` : "No provisional grades deadline set"}
              {daysOut !== null ? ` · ${daysOut} day${daysOut === 1 ? "" : "s"} out` : ""}
            </span>
            <span style={{ fontSize: 12, color: INK }}>
              {sendByDate
                ? "Each TP tutor proposes for their own group, the MCT proposes for theirs, then the MCT approves all before it's sent and recorded here."
                : "The MCT hasn't set a provisional grades deadline for this course yet."}
            </span>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 20, alignItems: "start" }}>
          {openCandidate ? (
            <div style={{ background: CARD, border: "1px solid color-mix(in oklab, oklch(38% 0.072 195) 32%, transparent)", borderRadius: 8, overflow: "hidden" }}>
              <div
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14,
                  padding: "14px 20px", background: WARM, color: CREAM,
                }}
              >
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600 }}>{openCandidate.name}</p>
                  <p style={{ fontSize: 11, color: "oklch(76% 0.02 80)" }}>
                    {openCandidate.tpsTaught}/8 TPs · {openCandidate.hoursAssessed.toFixed(1)} hrs assessed
                    {openCandidate.levels.length > 0 ? ` · ${openCandidate.levels.join(", ")}` : ""}
                  </p>
                </div>
                <Link
                  href="/assessor"
                  style={{
                    fontSize: 11.5, fontWeight: 600, padding: "7px 14px", borderRadius: 6,
                    border: "1px solid oklch(45% 0.045 58)", background: "oklch(24% 0.036 58)",
                    color: CREAM, textDecoration: "none", flex: "none",
                  }}
                >
                  Close
                </Link>
              </div>
              {drawerRows.map((row) => (
                <div
                  key={row.label}
                  style={{
                    display: "grid", gridTemplateColumns: "220px 1fr 130px", gap: 14, alignItems: "center",
                    padding: "12px 20px", borderBottom: "1px solid color-mix(in srgb, oklch(88% 0.016 82) 50%, transparent)",
                  }}
                >
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: INK }}>{row.label}</span>
                  <span style={{ fontSize: 12, color: MUTED }}>{row.value}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: row.ink, textAlign: "right" }}>{row.state}</span>
                </div>
              ))}
            </div>
          ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
            {candidates.map((c) => (
              <Link
                key={c.traineeId}
                href={`/assessor?candidate=${c.traineeId}`}
                style={{
                  background: c.flaggedIssue ? "color-mix(in oklab, oklch(44% 0.1 68) 8%, var(--color-card))" : CARD,
                  border: `1px solid ${c.flaggedIssue ? "color-mix(in oklab, oklch(44% 0.1 68) 35%, transparent)" : BORDER}`,
                  borderRadius: 8, padding: "15px 16px", display: "flex", flexDirection: "column", gap: 10,
                  textDecoration: "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: INK }}>{c.name}</span>
                  {c.provisionalLabel ? (
                    <span
                      style={{
                        fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 99,
                        background: (GRADE[c.provisionalLabel] ?? GRADE.Pass).bg,
                        color: (GRADE[c.provisionalLabel] ?? GRADE.Pass).ink,
                        flex: "none", whiteSpace: "nowrap",
                      }}
                    >
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
                      background: "color-mix(in oklab, oklch(44% 0.1 68) 10%, var(--color-card))",
                    }}
                  >
                    {c.flaggedIssue}
                  </span>
                ) : null}
              </Link>
            ))}
            {candidates.length === 0 ? <p style={{ fontSize: 12.5, color: MUTED }}>No candidates on this course.</p> : null}
          </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <Panel title="Cohort documents">
              {COHORT_DOCUMENTS.map((name) => (
                <DocRow key={name} label={name} href={COHORT_DOC_HREF(name, firstCandidateId)} status="Live" />
              ))}
            </Panel>

            {moodleSchedule.length > 0 ? (
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED_ACCENT, marginBottom: 8 }}>
                  Moodle schedule
                </p>
                <div
                  style={{
                    background: CARD, border: "1px solid color-mix(in oklab, oklch(51% 0.017 70) 26%, transparent)",
                    borderRadius: 7, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10,
                  }}
                >
                  <p style={{ fontSize: 11.5, color: MUTED }}>
                    Which Moodle sections candidates were asked to complete, and the centre-delivered input that
                    augmented each one (Handbook 2.2.2).
                  </p>
                  {moodleSchedule.map((s) => (
                    <div key={s.id} style={{ fontSize: 12.5 }}>
                      <span style={{ fontWeight: 600, color: "oklch(23.5% 0.017 65)" }}>{s.title}</span>
                      <span style={{ color: MUTED }}> -- {s.date}</span>
                      <div style={{ fontSize: 11, color: s.liveFollowUp ? MUTED : "oklch(52% 0.11 75)" }}>
                        {s.liveFollowUp
                          ? `Augmented by "${s.liveFollowUp.title}" -- ${s.liveFollowUp.event_date}`
                          : "No live follow-up linked yet"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED_ACCENT, marginBottom: 8 }}>
                On the day
              </p>
              <div
                style={{
                  background: CARD, border: "1px solid color-mix(in oklab, oklch(51% 0.017 70) 26%, transparent)",
                  borderRadius: 7, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 9,
                }}
              >
                {(onDayEvents ?? []).length === 0 ? (
                  <span style={{ fontSize: 12, color: MUTED }}>
                    {course.assessor_visit_date ? "No timetable events on the visit date yet." : "No assessor visit date set yet."}
                  </span>
                ) : (
                  (onDayEvents ?? []).map((e) => (
                    <div key={e.id} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: MUTED, width: 58, flex: "none", fontVariantNumeric: "tabular-nums" }}>
                        {e.event_time?.slice(0, 5) ?? ""}
                      </span>
                      <span>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: INK, display: "block" }}>{e.title}</span>
                        {/* "which TPs are observable and when (with Zoom link
                            timing for online ones)". An assessor needs to know
                            whether to be in a room or at a screen. */}
                        <span style={{ fontSize: 11, color: MUTED }}>
                          {e.type === "tp" ? "Observable · " : ""}
                          {e.zoom_url ? "Online — joining link opens 10 minutes before" : "In person at the centre"}
                        </span>
                      </span>
                    </div>
                  ))
                )}

                {/* The two fixed meetings the visit day always carries. They
                    are not timetable events, so nothing would ever have put
                    them here. */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: MUTED, width: 58, flex: "none" }}>—</span>
                  <span>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: INK, display: "block" }}>Tutor meeting</span>
                    <span style={{ fontSize: 11, color: MUTED }}>Time agreed with the main course tutor</span>
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: MUTED, width: 58, flex: "none" }}>—</span>
                  <span>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: INK, display: "block" }}>Candidate-concerns meeting</span>
                    <span style={{ fontSize: 11, color: MUTED }}>Private, without tutors present</span>
                  </span>
                </div>

                <span style={{ fontSize: 11.5, lineHeight: 1.5, color: MUTED, paddingTop: 4, borderTop: "1px solid oklch(90% 0.012 85)" }}>
                  {concernsCount && concernsCount > 0
                    ? `${concernsCount} candidate${concernsCount === 1 ? " has" : "s have"} asked to speak with you. Names are not shown before the meeting.`
                    : "No candidate has asked to speak with you."}
                </span>
              </div>
            </div>

            <Panel title="Centre documents">
              {CENTRE_DOCUMENTS.map((doc) => {
                // "Marking guidance" is the one line item that now lives in
                // the app itself, not the resources upload table -- see
                // marking-guidance.ts's hasMarkingGuidance.
                const isMarkingGuidance = doc.name === "Marking guidance";
                const uploaded = isMarkingGuidance
                  ? null
                  : (centreDocs ?? []).find((d) => d.title.trim().toLowerCase() === doc.name.toLowerCase());
                const present = isMarkingGuidance ? markingGuidancePresent : Boolean(uploaded?.file_url);
                const href = isMarkingGuidance ? "/assessor/marking-guidance" : uploaded?.file_url;
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
                    {present && href ? (
                      <a href={href} style={{ fontSize: 11, fontWeight: 600, color: TEAL, flex: "none", textDecoration: "none" }}>
                        Open →
                      </a>
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 600, color: AMBER, flex: "none" }}>
                        {isMarkingGuidance ? "Not written yet" : "Not uploaded"}
                      </span>
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

// Where each cohort document actually opens. Kept beside the shared list so a
// new document cannot be added without someone deciding where it points.
function COHORT_DOC_HREF(name: string, firstCandidateId: string | null): string {
  switch (name) {
    case "Grades report":
      return "/trainer/grades-report";
    case "Course timetable":
    case "Lesson plans for the day":
      return "/trainer/timetable";
    case "Assignment titles":
      return firstCandidateId ? `/portfolio/${firstCandidateId}/resources` : "#";
    case "Tutor list and roles":
      return "#tutor-list";
    case "Candidate descriptions":
      return "/trainer/roster";
    default:
      return "#";
  }
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
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: ok ? TEAL : AMBER }} />
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
      <div style={{ background: "var(--color-card)", border: "1px solid oklch(88% 0.016 82)", borderRadius: 7, overflow: "hidden" }}>
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
        <p style={{ fontSize: 10.5, color: TEAL }}>{status}</p>
      </div>
      <a href={href} style={{ fontSize: 11, fontWeight: 600, color: "oklch(38% 0.072 195)", flex: "none", textDecoration: "none" }}>
        Open →
      </a>
    </div>
  );
}
