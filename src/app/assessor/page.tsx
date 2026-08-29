import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { ASSESSOR_COOKIE, getAssessorCourseId, getAssessorTermsStatus } from "@/lib/auth/portfolio-access";
import { computeAssessorReadiness, buildCandidateCards } from "@/lib/assessor-pack";
import { hasMarkingGuidance } from "@/lib/marking-guidance";
import { toLocalIso, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";
import { getCachedCenter } from "@/lib/supabase/cached-queries";
import { DesignerCredit } from "@/components/designer-credit";
import { CENTRE_DOCUMENTS, COHORT_DOCUMENTS } from "@/lib/assessor-pack-contents";
import { buildAssessorRequirements, doubleMarkingPerAssignment, type AssessmentKind } from "@/lib/assessor-requirements";

// The design file's own palette, so status colour is not re-invented here.
// Re-pointed 2026-08-21 per the color audit: gold is reserved for the Pass
// A grade tint only (GOLD_TINT below), never a generic deadline/section
// accent -- those uses move to AMBER or MUTED. Green is fully retired as a
// status color -- TEAL takes over every "met/complete" use GREEN used to
// have (readiness dots, hours logged, document status).
const MUTED_ACCENT = "oklch(51% 0.017 70)";
const TEAL = "oklch(37.5% 0.058 195)";
const AMBER = "oklch(44% 0.1 68)";
const GOLD = "oklch(63% 0.096 72)";


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
// Three of the spec's own "ask, don't invent" questions were left open
// here, resolved 2026-08-23 by for-claude-code-assessor-pack-decisions.md:
// (1) the landing page defaults to the centre-selected subset
// (profiles.selected_for_assessor_visit, roster's "Select for assessor
// visit" panel), with an always-reachable "View full cohort" link -- never
// a restriction; (2) online TPs during the visit window get a real,
// clickable Zoom join link, the same one students/tutors use; (3) the
// centre document list stays the 8 compiled-in defaults, plus any extra
// file a centre uploads under Resource Hub's existing "Centre documents"
// uploader (`resources`, `category = 'centre_documents'`) now also shows
// here even when its title doesn't match one of the 8 -- previously
// silently dropped.
export default async function AssessorPage({
  searchParams,
}: {
  searchParams: Promise<{ candidate?: string; cohort?: string }>;
}) {
  const { candidate: openCandidateId, cohort } = await searchParams;
  const cookieStore = await cookies();
  if (!cookieStore.get(ASSESSOR_COOKIE)?.value) redirect("/login");
  const termsStatus = await getAssessorTermsStatus();
  if (!termsStatus) redirect("/login?error=assessor_link_invalid");
  if (!termsStatus.accepted) redirect("/assessor/gate");
  const courseId = await getAssessorCourseId();
  if (!courseId) redirect("/login?error=assessor_link_invalid");

  const admin = createAdminClient();

  const [{ data: course }, { data: accessToken }, readiness, candidates] = await Promise.all([
    admin.from("courses").select("*, centers(name, center_number, appian_url)").eq("id", courseId).maybeSingle(),
    admin.from("course_access_tokens").select("expires_at").eq("course_id", courseId).eq("role", "assessor").maybeSingle(),
    computeAssessorReadiness(admin, courseId),
    buildCandidateCards(admin, courseId),
  ]);
  const markingGuidancePresent = course ? await hasMarkingGuidance(admin, course.center_id) : false;

  if (!course) redirect("/login?error=assessor_link_invalid");

  const center = course.centers as unknown as { name: string; center_number: string; appian_url: string | null } | null;
  const timeZone = (await getCachedCenter(course.center_id))?.time_zone ?? DEFAULT_TIMEZONE;
  const today = toLocalIso(new Date(), timeZone);

  // MCT-set, not computed from assessor_visit_date -- see migration 0127.
  const sendByDate = course.provisional_grades_due_at ? course.provisional_grades_due_at.slice(0, 10) : null;
  const daysOut = sendByDate ? Math.ceil((new Date(`${sendByDate}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000) : null;

  const [{ data: tutorRows }, { data: onDayEvents }, { data: centreDocs }, { data: asyncEvents }, { data: malpracticeCases }] = await Promise.all([
    admin.from("course_tutors").select("profile_id, tutor_role").eq("course_id", courseId).is("left_at", null),
    course.assessor_visit_date
      ? admin.from("course_timetable_events").select("*").eq("course_id", courseId).eq("event_date", course.assessor_visit_date).order("event_time")
      : Promise.resolve({ data: [] }),
    admin.from("resources").select("id, title, file_url").eq("center_id", course.center_id).eq("category", "centre_documents"),
    // course-modes.md §7 (Handbook 3.4): "Moodle content ... must be
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
    // for-claude-code-malpractice-outcomes.md / Malpractice.dc.html's own
    // case note: "It goes in the assessor pack. Every case, upheld or not,
    // with the full timeline." No case-detail route exists for a token-
    // only assessor to click into (/trainer/malpractice/[caseId] requires
    // a real trainer session) -- so this pack shows every field inline
    // rather than linking out, same self-contained shape as every other
    // section on this page.
    admin
      .from("malpractice_cases")
      .select("id, trainee_id, assignment_id, status, outcome, flagged_for_referral, decision_notes, opened_at, candidate_account, candidate_account_recorded_at, decided_at")
      .eq("course_id", courseId)
      .order("opened_at", { ascending: false }),
  ]);

  const malpracticeTraineeIds = [...new Set((malpracticeCases ?? []).map((c) => c.trainee_id))];
  const { data: malpracticeTrainees } =
    malpracticeTraineeIds.length > 0 ? await admin.from("profiles").select("id, full_name").in("id", malpracticeTraineeIds) : { data: [] };
  const malpracticeTraineeNameById = new Map((malpracticeTrainees ?? []).map((t) => [t.id, t.full_name]));
  const malpracticeAssignmentIds = [...new Set((malpracticeCases ?? []).map((c) => c.assignment_id))];
  const { data: malpracticeAssignments } =
    malpracticeAssignmentIds.length > 0 ? await admin.from("assignments").select("id, assignment_type").in("id", malpracticeAssignmentIds) : { data: [] };
  const malpracticeAssignmentTypeById = new Map((malpracticeAssignments ?? []).map((a) => [a.id, a.assignment_type]));

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

  // Handbook 14.2 makes the withdrawn candidates the assessor's business too
  // -- "check documentation for any candidate who has withdrawn from the
  // course (e.g., letter confirming withdrawal)" -- and 14.1 adds their
  // application to that. buildCandidateCards doesn't filter by course_status,
  // but it also doesn't surface it, so this is counted head-only here.
  const { count: withdrawnCandidateCount } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("course_id", courseId)
    .eq("role", "trainee")
    .eq("course_status", "withdrawn");

  const tutorProfileIds = (tutorRows ?? []).map((t) => t.profile_id);
  const { data: tutorProfiles } =
    tutorProfileIds.length > 0 ? await admin.from("profiles").select("id, full_name").in("id", tutorProfileIds) : { data: [] };
  const tutorNameById = new Map((tutorProfiles ?? []).map((p) => [p.id, p.full_name]));

  // "Assignment briefs" cohort document -- reuses an existing, already
  // assessor-safe candidate resources page (portfolio/[traineeId]/resources
  // already checks getAssessorCourseId) rather than a course-level page,
  // since briefs are identical for the whole cohort.
  const firstCandidateId = candidates[0]?.traineeId ?? null;

  // Ramy, 30 Aug 2026: "those numbers that are hard to [remember]. Let's get
  // them down somewhere. Maybe the assessor pack will contain them." Derived
  // against this course rather than printed as a static list -- Handbook
  // citations live in src/lib/assessor-requirements.ts.
  //
  // "At risk" is read off the provisional grade rather than a separate flag:
  // the Handbook's trigger is "Fail or potential Fail", and the provisional
  // slots carrying Fail at all are exactly Fail and Fail/Pass
  // (PROVISIONAL_SLOTS, src/lib/provisional-grade.ts), so a substring test on
  // the label is the whole rule, not an approximation of one.
  const atRiskCount = candidates.filter((c) => c.provisionalLabel?.includes("Fail")).length;
  const selectedCount = candidates.filter((c) => c.selectedForAssessorVisit).length;
  const requirements = buildAssessorRequirements({
    // Cast rather than a regenerated type: migration 0254 adds this column
    // and Ramy runs migrations, so the generated Database type won't carry it
    // until after he does. `select("*")` simply omits an absent column, and
    // the fallback is the Handbook's own default, so the pack reads correctly
    // either side of the migration running.
    assessmentKind: ((course as { assessment_kind?: string }).assessment_kind ?? "regular") as AssessmentKind,
    candidateCount: candidates.length,
    atRiskCount,
    selectedCount,
    withdrawnCount: withdrawnCandidateCount ?? 0,
  });
  const doubleMarkPerAssignment = doubleMarkingPerAssignment(candidates.length);

  // for-claude-code-assessor-pack-decisions.md §3: "don't hardcode the
  // list -- let the centre add/remove supplementary documents." Resource
  // Hub's "Centre documents" uploader (resources, category = 'centre_
  // documents') already lets a centre freely add or remove any titled
  // file -- this was the missing half: any upload whose title doesn't
  // match one of the 8 defaults now shows as its own row instead of being
  // silently dropped.
  const extraCentreDocs = (centreDocs ?? []).filter(
    (d) => !CENTRE_DOCUMENTS.some((doc) => doc.name.toLowerCase() === d.title.trim().toLowerCase())
  );

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
  // for-claude-code-trainee-assessor-card-system.md's header underline --
  // = --color-gold, distinct from the page's own GOLD const above (that
  // one's tuned for the Pass A tint/dot, a different job).
  const GOLD_UNDERLINE = "oklch(60% 0.11 70)";

  // The six rows the design names, in its order. Values come from real
  // records, so where the app genuinely doesn't hold something the row says so
  // rather than borrowing the design file's sample text -- an assessor reading
  // "120 of 120 contact hours" that nothing computed would be worse than a row
  // admitting the figure isn't tracked.
  // for-claude-code-assessor-pack-decisions.md §1: "default to showing the
  // candidates the centre has selected... not a restriction -- the
  // assessor can freely browse into the complete cohort... at any time."
  // isNarrowed is false for an untouched course (everyone still defaults
  // to selected=true), so the link only appears once a centre has actually
  // narrowed something down.
  const isNarrowed = candidates.some((c) => !c.selectedForAssessorVisit);
  const wantsFullCohort = cohort === "full";
  const visibleCandidates = isNarrowed && !wantsFullCohort ? candidates.filter((c) => c.selectedForAssessorVisit) : candidates;

  const openCandidate = openCandidateId ? candidates.find((c) => c.traineeId === openCandidateId) ?? null : null;
  // Ramy, 29 Aug 2026, on opening a candidate card: "Like, what is this?
  // Like, a summary? The assessor is supposed to check the entire
  // portfolio for those candidates." It was a summary and nothing else --
  // six rows of completeness with no way into any of them, so the one
  // thing the assessor is here to do (CELTA 5's own "assessors scrutinise
  // a selection of portfolios to moderate candidates' work") could only be
  // reached by taking the optional platform tour instead.
  //
  // Each row that names a real part of the portfolio now opens it. The two
  // without a link have nothing to link to: attendance is recorded inside
  // the CELTA 5 rather than as its own register, so linking it would just
  // be a second route to the row above, and special arrangements has no
  // screen at all. Every destination is a page an assessor session already
  // reaches read-only.
  const drawerRows: { label: string; value: string; state: string; ink: string; href?: string }[] = openCandidate
    ? [
        {
          label: "CELTA 5 record",
          value: openCandidate.celta5Detail,
          state: openCandidate.celta5Complete ? "Complete" : "Incomplete",
          ink: openCandidate.celta5Complete ? TEAL : AMBER,
          href: `/portfolio/${openCandidate.traineeId}/celta5`,
        },
        {
          label: "Teaching practice",
          value: `${openCandidate.tpsTaught} of 8 TPs · ${openCandidate.hoursAssessed.toFixed(1)} hrs assessed${
            openCandidate.levels.length > 0 ? ` · ${openCandidate.levels.join(", ")}` : ""
          }`,
          state: openCandidate.tpsComplete ? "Complete" : "Incomplete",
          ink: openCandidate.tpsComplete ? TEAL : AMBER,
          href: `/portfolio/${openCandidate.traineeId}/tp`,
        },
        {
          label: "Assignments",
          value: "Four assignments, criteria and marks recorded",
          state: openCandidate.assignmentsComplete ? "Complete" : (openCandidate.flaggedIssue ?? "Incomplete"),
          ink: openCandidate.assignmentsComplete ? TEAL : AMBER,
          href: `/portfolio/${openCandidate.traineeId}/assignments`,
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
          href: "/trainer/grades-report",
        },
      ]
    : [];


  return (
    <div style={{ minHeight: "100vh", background: "var(--color-background)" }}>
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

      {/* for-claude-code-trainee-assessor-card-system.md: dark ink-brown
          header, 3px gold bottom border -- opposite-pairing, same logic as
          every other role header this app now uses. The logo tile, wordmark,
          pill, and download button below were built for a light header
          (CARD background) and are corrected here to translucent light
          treatments so they read against this darker one instead. */}
      <header
        style={{
          height: 92, background: WARM, borderBottom: `3px solid ${GOLD_UNDERLINE}`, display: "flex",
          alignItems: "center", justifyContent: "space-between", padding: "0 32px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              width: 30, height: 30, borderRadius: 7, background: "color-mix(in oklab, oklch(97% 0.008 88) 22%, transparent)",
              display: "flex", alignItems: "center", justifyContent: "center", flex: "none",
            }}
          >
            <svg viewBox="8 30 104 60" width={19} height={11} fill="none" aria-label="Connect" role="img">
              <path d="M56.1 42.2 A 24 24 0 1 0 56.1 77.8" stroke="oklch(70% 0.12 72)" strokeWidth={15} strokeLinecap="round" />
              <path d="M96.1 42.2 A 24 24 0 1 0 96.1 77.8" stroke="oklch(97% 0.008 88)" strokeWidth={15} strokeLinecap="round" />
            </svg>
          </span>
          <span style={{ fontFamily: "var(--font-instrument-serif), Newsreader, Georgia, serif", fontStyle: "italic", fontSize: 18, color: "oklch(70% 0.12 72)" }}>
            Connect
          </span>
          <span style={{ width: 1, height: 16, background: "color-mix(in oklab, oklch(97% 0.008 88) 25%, transparent)" }} aria-hidden />
          <span
            style={{
              fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
              color: "oklch(97% 0.008 88)", background: "color-mix(in oklab, oklch(97% 0.008 88) 14%, transparent)",
              border: "1px solid color-mix(in oklab, oklch(97% 0.008 88) 30%, transparent)",
              borderRadius: 5, padding: "4px 10px",
            }}
          >
            Assessor · read-only
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* assessor-visit-pack-full-spec.md: "Links to Appian's login page
              only -- no deep link, no data ever flows from Connect into
              Appian. Same link-out pattern used on Course Admin's
              entry-form card: manual navigation, no integration." Moved
              here from beside the readiness stats (Ramy's first verbal
              placement) once he sent the actual spec -- this is where it's
              drawn. */}
          {center?.appian_url ? (
            <a
              href={center.appian_url}
              target="_blank"
              rel="noreferrer"
              className="transition-colors duration-150 hover:bg-[color-mix(in_oklab,oklch(60%_0.11_70)_28%,transparent)]"
              style={{
                height: 34, padding: "0 15px", borderRadius: 6,
                border: "1px solid color-mix(in oklab, oklch(60% 0.11 70) 55%, transparent)",
                background: "color-mix(in oklab, oklch(60% 0.11 70) 16%, transparent)",
                color: "oklch(94% 0.02 82)", fontSize: 12.5, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 8,
                textDecoration: "none",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M6 3H3.5A1.5 1.5 0 0 0 2 4.5v8A1.5 1.5 0 0 0 3.5 14h8a1.5 1.5 0 0 0 1.5-1.5V10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M9.5 2H14v4.5M14 2 7.5 8.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Open Appian
            </a>
          ) : null}
          <a
            href="/assessor/pack.pdf"
            className="transition-colors duration-150 hover:bg-[color-mix(in_oklab,oklch(97%_0.008_88)_22%,transparent)]"
            style={{
              height: 34, padding: "0 15px", borderRadius: 6,
              border: "1px solid color-mix(in oklab, oklch(97% 0.008 88) 30%, transparent)",
              background: "color-mix(in oklab, oklch(97% 0.008 88) 12%, transparent)",
              color: "oklch(97% 0.008 88)", fontSize: 12.5, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 8,
              textDecoration: "none",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M8 2v8m0 0 3-3m-3 3L5 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2.5 11.5v1a1.5 1.5 0 0 0 1.5 1.5h8a1.5 1.5 0 0 0 1.5-1.5v-1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            Download whole pack
          </a>
        </div>
      </header>

      <div
        className="frame"
        style={{ margin: "40px 32px 44px", padding: "24px 28px", display: "flex", flexDirection: "column", gap: 22 }}
      >
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
            <div className="card overflow-hidden" style={{ borderColor: "color-mix(in oklab, oklch(38% 0.072 195) 32%, transparent)" }}>
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
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "none" }}>
                  {/* The whole point of the visit, said plainly -- the rows
                      below open one part each, this opens the portfolio
                      itself. */}
                  <Link
                    href={`/portfolio/${openCandidate.traineeId}`}
                    style={{
                      fontSize: 11.5, fontWeight: 600, padding: "7px 14px", borderRadius: 6,
                      border: `1px solid color-mix(in oklab, ${GOLD_UNDERLINE} 70%, transparent)`,
                      background: `color-mix(in oklab, ${GOLD_UNDERLINE} 22%, transparent)`,
                      color: CREAM, textDecoration: "none",
                    }}
                  >
                    Open the whole portfolio →
                  </Link>
                  <Link
                    href="/assessor"
                    style={{
                      fontSize: 11.5, fontWeight: 600, padding: "7px 14px", borderRadius: 6,
                      border: "1px solid oklch(45% 0.045 58)", background: "oklch(24% 0.036 58)",
                      color: CREAM, textDecoration: "none",
                    }}
                  >
                    Close
                  </Link>
                </div>
              </div>
              {drawerRows.map((row) => {
                const cells = (
                  <>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: INK }}>{row.label}</span>
                    <span style={{ fontSize: 12, color: MUTED }}>{row.value}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: row.ink, textAlign: "right" }}>{row.state}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: row.href ? TEAL : "transparent", textAlign: "right" }}>
                      {row.href ? "Open →" : "—"}
                    </span>
                  </>
                );
                const rowStyle = {
                  display: "grid", gridTemplateColumns: "200px 1fr 120px 58px", gap: 14, alignItems: "center",
                  padding: "12px 20px", borderBottom: "1px solid color-mix(in srgb, oklch(88% 0.016 82) 50%, transparent)",
                } as const;
                return row.href ? (
                  <Link key={row.label} href={row.href} className="assessor-hover no-underline" style={rowStyle}>
                    {cells}
                  </Link>
                ) : (
                  <div key={row.label} style={rowStyle}>
                    {cells}
                  </div>
                );
              })}
            </div>
          ) : (
          <>
          {isNarrowed ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <span style={{ fontSize: 11.5, color: MUTED }}>
                Showing {visibleCandidates.length} of {candidates.length} candidates -- the centre&apos;s selection for this visit.
              </span>
              <Link
                href={wantsFullCohort ? "/assessor" : "/assessor?cohort=full"}
                style={{ fontSize: 11.5, fontWeight: 600, color: TEAL, textDecoration: "none" }}
              >
                {wantsFullCohort ? "← Back to selected" : `View full cohort (${candidates.length}) →`}
              </Link>
            </div>
          ) : null}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
            {visibleCandidates.map((c) => (
              <Link
                key={c.traineeId}
                href={`/assessor?candidate=${c.traineeId}`}
                className="card assessor-hover-fill no-underline"
                style={{
                  background: c.flaggedIssue ? "color-mix(in oklab, oklch(44% 0.1 68) 8%, var(--color-card))" : CARD,
                  border: `1px solid ${c.flaggedIssue ? "color-mix(in oklab, oklch(44% 0.1 68) 35%, transparent)" : BORDER}`,
                  borderLeft: `3px solid ${c.flaggedIssue ? AMBER : TEAL}`,
                  padding: "15px 16px", display: "flex", flexDirection: "column", gap: 10,
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
            {visibleCandidates.length === 0 ? <p style={{ fontSize: 12.5, color: MUTED }}>No candidates on this course.</p> : null}
          </div>
          </>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Ramy, 30 Aug 2026: "those numbers that are hard to [remember].
                Let's get them down somewhere. Maybe the assessor pack will
                contain them." First panel in the column deliberately -- it is
                what the visit IS, so it sits above the documents the visit
                uses. Every line carries its Handbook section so an assessor
                who disagrees can check rather than take our word for it. */}
            <Panel title="What this assessment requires" accent="gold">
              {requirements.map((r) => (
                <div
                  key={r.label}
                  style={{
                    padding: "11px 15px",
                    borderBottom: "1px solid color-mix(in srgb, oklch(88% 0.016 82) 45%, transparent)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                    <p style={{ fontSize: 12.5, fontWeight: 600, color: INK }}>{r.label}</p>
                    <span style={{ fontSize: 10, fontWeight: 600, color: MUTED, flex: "none", fontVariantNumeric: "tabular-nums" }}>
                      §{r.cite}
                    </span>
                  </div>
                  <p style={{ fontSize: 11.5, color: MUTED, marginTop: 3, lineHeight: 1.5 }}>{r.detail}</p>
                  {r.emphasis ? (
                    <p style={{ fontSize: 11.5, color: AMBER, marginTop: 4, lineHeight: 1.5, fontWeight: 500 }}>{r.emphasis}</p>
                  ) : null}
                </div>
              ))}
              {doubleMarkPerAssignment ? (
                <div style={{ padding: "11px 15px", background: "var(--color-frame)" }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                    <p style={{ fontSize: 12.5, fontWeight: 600, color: INK }}>The centre&apos;s double-marking, for reference</p>
                    <span style={{ fontSize: 10, fontWeight: 600, color: MUTED, flex: "none", fontVariantNumeric: "tabular-nums" }}>§11</span>
                  </div>
                  <p style={{ fontSize: 11.5, color: MUTED, marginTop: 3, lineHeight: 1.5 }}>
                    {doubleMarkPerAssignment} of each assignment on a course of {candidates.length}. Not the assessor&apos;s task, but
                    the record may be asked for -- and this is the count that scales with cohort size, unlike anything above it.
                  </p>
                </div>
              ) : null}
            </Panel>

            <Panel title="Cohort documents">
              {COHORT_DOCUMENTS.map((name) => (
                <DocRow key={name} label={name} href={COHORT_DOC_HREF(name)} status="Live" />
              ))}
            </Panel>

            {moodleSchedule.length > 0 ? (
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED_ACCENT, marginBottom: 8 }}>
                  Moodle schedule
                </p>
                <div
                  className="card card-gold"
                  style={{
                    borderLeftColor: "color-mix(in oklab, oklch(51% 0.017 70) 26%, transparent)",
                    borderRightColor: "color-mix(in oklab, oklch(51% 0.017 70) 26%, transparent)",
                    borderBottomColor: "color-mix(in oklab, oklch(51% 0.017 70) 26%, transparent)",
                    padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10,
                  }}
                >
                  <p style={{ fontSize: 11.5, color: MUTED }}>
                    Which Moodle sections candidates were asked to complete, and the centre-delivered input that
                    augmented each one (Handbook 3.4).
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
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: GOLD_UNDERLINE, marginBottom: 8 }}>
                On the day
              </p>
              <div
                className="card"
                style={{
                  border: `1px solid color-mix(in oklab, ${GOLD_UNDERLINE} 26%, transparent)`,
                  borderTop: `3px solid ${GOLD_UNDERLINE}`,
                  padding: "14px 16px", display: "flex", flexDirection: "column", gap: 9,
                }}
              >
                {(onDayEvents ?? []).length === 0 ? (
                  <span style={{ fontSize: 12, color: MUTED }}>
                    {course.assessor_visit_date ? "No timetable events on the visit date yet." : "No assessor visit date set yet."}
                  </span>
                ) : (
                  (onDayEvents ?? []).map((e) => (
                    <div key={e.id} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <span style={{ fontSize: 11.5, fontWeight: 600, color: MUTED, width: 58, flex: "none", fontVariantNumeric: "tabular-nums" }}>
                          {e.event_time?.slice(0, 5) ?? ""}
                        </span>
                        <span>
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: INK, display: "block" }}>{e.title}</span>
                          {/* for-claude-code-assessor-pack-decisions.md §2: "a
                              real, clickable join link... not just a static
                              'Observable' label. An assessor who can't click
                              into the session isn't meaningfully observing
                              it." Same zoom_url students/tutors use -- the
                              real join window is Zoom's own waiting room, not
                              something this page enforces. */}
                          <span style={{ fontSize: 11, color: MUTED }}>
                            {e.type === "tp" ? "Observable · " : ""}
                            {e.zoom_url ? "Online — joining link opens 10 minutes before" : "In person at the centre"}
                          </span>
                        </span>
                      </div>
                      {e.zoom_url ? (
                        <a
                          href={e.zoom_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: 11, fontWeight: 600, color: TEAL, flex: "none", textDecoration: "none" }}
                        >
                          Join →
                        </a>
                      ) : null}
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

            <Panel title="Centre documents" accent="garnet">
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
                    className={present && href ? "assessor-hover" : undefined}
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
                      <a href={href} className="hover:underline" style={{ fontSize: 11, fontWeight: 600, color: TEAL, flex: "none", textDecoration: "none" }}>
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
              {extraCentreDocs.map((d) => (
                <div
                  key={d.id}
                  className="assessor-hover"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                    padding: "11px 15px", borderBottom: "1px solid color-mix(in srgb, oklch(88% 0.016 82) 45%, transparent)",
                  }}
                >
                  <div>
                    <p style={{ fontSize: 12.5, fontWeight: 600, color: INK }}>{d.title}</p>
                    <p style={{ fontSize: 10.5, color: MUTED }}>Added by the centre</p>
                  </div>
                  <a href={d.file_url ?? "#"} className="hover:underline" style={{ fontSize: 11, fontWeight: 600, color: TEAL, flex: "none", textDecoration: "none" }}>
                    Open →
                  </a>
                </div>
              ))}
              {/* "Tutor list and roles doesn't take you there" -- it did jump,
                  but to a heading further down this same column, which reads
                  as nothing happening when every sibling row opens a page
                  instead. .assessor-anchor (globals.css) pulls the target
                  clear of the sticky banner and tints it briefly, so the jump
                  lands somewhere the eye can follow. */}
              {tutorNameById.size > 0 ? (
                <div id="tutor-list" className="assessor-anchor" style={{ padding: "11px 15px" }}>
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
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED_ACCENT, marginBottom: 8 }}>
                Malpractice cases
              </p>
              <div
                className="card card-amber"
                style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 14 }}
              >
                {(malpracticeCases ?? []).length === 0 ? (
                  <p style={{ fontSize: 12, color: MUTED }}>No plagiarism or malpractice cases have been raised on this course.</p>
                ) : (
                  (malpracticeCases ?? []).map((c) => (
                    <div
                      key={c.id}
                      style={{ display: "flex", flexDirection: "column", gap: 6, paddingBottom: 14, borderBottom: "1px solid oklch(90% 0.012 85)" }}
                    >
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: INK }}>
                          {malpracticeTraineeNameById.get(c.trainee_id) ?? "Candidate"} ·{" "}
                          {malpracticeAssignmentTypeById.get(c.assignment_id) ?? "Assignment"}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: c.status === "open" ? AMBER : MUTED }}>
                          {c.status === "open" ? "Open" : `Closed · ${c.outcome ?? "decided"}`}
                        </span>
                      </div>
                      {c.flagged_for_referral ? (
                        <span style={{ fontSize: 11, fontWeight: 600, color: "oklch(45% 0.15 27)" }}>Referred to the centre&apos;s malpractice procedure</span>
                      ) : null}
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, color: MUTED }}>
                        <span>Opened {new Date(c.opened_at).toLocaleDateString()}</span>
                        {c.candidate_account_recorded_at ? (
                          <span>Candidate&apos;s account recorded {new Date(c.candidate_account_recorded_at).toLocaleDateString()}</span>
                        ) : null}
                        {c.decided_at ? <span>Decided {new Date(c.decided_at).toLocaleDateString()}</span> : null}
                      </div>
                      {c.candidate_account ? (
                        <div>
                          <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: MUTED }}>
                            Candidate&apos;s account
                          </p>
                          <p style={{ fontSize: 12, color: INK, whiteSpace: "pre-wrap" }}>{c.candidate_account}</p>
                        </div>
                      ) : null}
                      {c.decision_notes ? (
                        <div>
                          <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: MUTED }}>
                            Decision notes
                          </p>
                          <p style={{ fontSize: 12, color: INK, whiteSpace: "pre-wrap" }}>{c.decision_notes}</p>
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED, marginBottom: 8 }}>
                Not in this pack
              </p>
              <div
                className="frame"
                style={{
                  borderTop: `3px solid ${MUTED}`,
                  padding: "14px 16px", display: "flex", flexDirection: "column", gap: 9,
                }}
              >
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

            {/* for-claude-code-assessor-tour-mode.md: "small, colorful...
                so it stands out as an inviting extra rather than blending
                into the informational list." Deliberately the one warm,
                saturated element on an otherwise muted/informational page --
                the same GOLD this page already reserves for Pass A, not a
                new accent invented for this. */}
            {/* Plain <a>, not <Link> -- /assessor/tour is a route handler
                (sets the tour cookie, then redirects), not a page. Next's
                Link prefetch could otherwise trigger that GET, and the
                cookie it sets, before the assessor actually clicks. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/assessor/tour"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                background: GOLD, color: "oklch(23.5% 0.017 65)", fontSize: 13, fontWeight: 700,
                borderRadius: 999, padding: "12px 20px", textDecoration: "none",
              }}
            >
              Take a tour of the platform →
            </a>
            <p style={{ fontSize: 11, lineHeight: 1.5, color: MUTED, marginTop: -4 }}>
              Browse the wider platform read-only -- the trainer dashboard, a candidate&apos;s full portfolio, the
              timetable, the resource hub. Nothing here is required reading; it&apos;s just here if you&apos;re
              curious how the platform works day to day.
            </p>
          </div>
        </div>
      </div>

      <DesignerCredit />
    </div>
  );
}

// Where each cohort document actually opens. Kept beside the shared list so a
// new document cannot be added without someone deciding where it points.
function COHORT_DOC_HREF(name: string): string {
  switch (name) {
    case "Grades report":
      return "/trainer/grades-report";
    case "Course timetable":
      return "/trainer/timetable";
    // Ramy, 29 Aug 2026: "Lesson plans for the day takes the assessor to
    // the timetable, and the timetable takes the assessor to the
    // timetable." Two of the six rows pointed at the same page. The
    // Handbook's pack list names them separately, and the plans are the
    // document the assessor actually reads before observing.
    case "Lesson plans for the day":
      return "/assessor/lesson-plans";
    // Was the first candidate's resource hub, where the briefs sit inside
    // a collapsed category well down a long page -- "Assignment titles
    // doesn't take you there." The titles are the same for the whole
    // cohort, so they get a page about the course.
    case "Assignment titles":
      return "/assessor/assignment-titles";
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

// Ramy, 27 Aug 2026: the decorative teal/garnet card-line alternation
// (same pilot as Centre Admin's overview page) applies only to panels with
// no status meaning of their own -- "gold" here isn't part of that
// alternation, it's this page's own pre-existing warm highlight (kept as an
// inline override, at its own tuned value, distinct from .card-gold's
// slightly different hue) and stays available even though no current call
// site uses it.
function Panel({
  title,
  children,
  accent = "teal",
}: {
  title: string;
  children: React.ReactNode;
  accent?: "teal" | "gold" | "garnet";
}) {
  return (
    <div>
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "oklch(51% 0.017 70)", marginBottom: 8 }}>
        {title}
      </p>
      <div
        className={`card overflow-hidden ${accent === "garnet" ? "card-garnet" : ""}`}
        style={accent === "gold" ? { borderTopColor: "oklch(60% 0.11 70)" } : undefined}
      >
        {children}
      </div>
    </div>
  );
}

function DocRow({ label, href, status }: { label: string; href: string; status: string }) {
  return (
    <div
      className="assessor-hover"
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        padding: "11px 15px", borderBottom: "1px solid color-mix(in srgb, oklch(88% 0.016 82) 45%, transparent)",
      }}
    >
      <div>
        <p style={{ fontSize: 12.5, fontWeight: 600, color: "oklch(23.5% 0.017 65)" }}>{label}</p>
        <p style={{ fontSize: 10.5, color: TEAL }}>{status}</p>
      </div>
      <a href={href} className="hover:underline" style={{ fontSize: 11, fontWeight: 600, color: "oklch(38% 0.072 195)", flex: "none", textDecoration: "none" }}>
        Open →
      </a>
    </div>
  );
}
