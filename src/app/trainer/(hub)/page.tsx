import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { getAssessorCourseId, isAssessorTourMode } from "@/lib/auth/portfolio-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchRosterRows } from "@/lib/roster";
import { categorize, isEventLive, toLocalIso, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";
import { getCachedCenter } from "@/lib/supabase/cached-queries";
import { CATEGORY_ACCENT } from "@/app/trainer/(hub)/timetable/event-cell";
import { computeWeekOf } from "@/lib/course-progress";
import { AT_RISK_LABELS } from "@/lib/at-risk";
import { DesignerCredit } from "@/components/designer-credit";
import { getFeedbackAssistState } from "@/lib/feedback-assist";
import { FeedbackAssistCard } from "@/app/trainer/(hub)/feedback-assist-card";
import { AssessorCard } from "@/app/trainer/(hub)/assessor-card";
import { buildCentrePreparationList, centrePreparationDeadline, type AssessmentKind } from "@/lib/assessor-requirements";
import { assessorVisitDayProblem } from "@/lib/assessor-day";
import { findMaterialsOverlaps } from "@/lib/materials-overlap";

// Checkpoint 2 -- Today, the (hub) group's own index page (bare /trainer),
// replacing the old marketing hero + candidate-card-grid. build-spec.md's
// App Redesign.dc.html 1a: today's schedule (from the real timetable),
// what needs a trainer's attention right now, and the cohort at a glance.
export default async function TodayPage() {
  const session = await getCurrentProfile();
  const trainer =
    session?.profile?.role === "trainer" || session?.profile?.role === "admin" || session?.profile?.role === "platform_owner"
      ? session.profile
      : null;
  const assessorCourseId = !trainer ? await getAssessorCourseId() : null;
  if (!trainer && !assessorCourseId) redirect("/login");
  // Today is trainer-only operational material (write actions, cohort-wide
  // alerts) -- assessors stay on the roster, same boundary trainer-tabs.tsx
  // already draws for everything except Grades Report. for-claude-code-
  // assessor-tour-mode.md: unless they've explicitly opted into the tour,
  // which is the one place this boundary deliberately opens -- read-only
  // still, every write action below stays gated on Boolean(trainer).
  const tourMode = assessorCourseId ? await isAssessorTourMode() : false;
  if (assessorCourseId && !trainer && !tourMode) redirect("/trainer/roster");

  const supabase = trainer ? await createClient() : createAdminClient();
  const courseId = trainer?.course_id ?? assessorCourseId;
  if (!courseId) {
    return <div className="sheet text-sm text-muted">No course assigned.</div>;
  }

  // trainer is null for an assessor session -- courseId is still known
  // though (from the assessor token), just not trainer.center_id.
  const centerId = trainer?.center_id ?? (await supabase.from("courses").select("center_id").eq("id", courseId).maybeSingle()).data?.center_id;
  const timeZone = (centerId ? (await getCachedCenter(centerId))?.time_zone : null) ?? DEFAULT_TIMEZONE;
  const today = toLocalIso(new Date(), timeZone);

  // Feedback assist (design_handoff_feedback_assist, 2026-08-17) is a
  // trainer's own tool, not a course-admin one -- "whoever runs course admin
  // may not be the person writing feedback" -- so admins previewing /trainer
  // don't get the card at all.
  const feedbackAssist = trainer?.role === "trainer" ? await getFeedbackAssistState(courseId, trainer.id) : null;

  const rows = await fetchRosterRows(supabase, courseId);
  const nameById = new Map(rows.map((r) => [r.id, r.name]));
  const traineeIds = rows.map((r) => r.id);

  const [{ data: course }, { data: todayEvents }, { data: lessons }, { data: feedbackRows }, { data: dueAssignments }] =
    await Promise.all([
      supabase
        .from("courses")
        .select("name, start_date, end_date, assessor_visit_date, provisional_grades_due_at, assessor_name, assessor_email, assessor_notified_at, delivery_mode")
        .eq("id", courseId)
        .maybeSingle(),
      supabase
        .from("course_timetable_events")
        .select("*")
        .eq("course_id", courseId)
        .eq("event_date", today)
        .order("event_time"),
      // NOT `tp_lessons` -- that table is permanently empty on live courses
      // (1 row DB-wide vs. 90 real taught plans, checked 2026-08-16) and this
      // panel's whole "TP feedback unsent" alert was silently dead because of
      // it. `plan_assignments.taught_at` is the real taught signal; same bug
      // already fixed in roster.ts, tp/page.tsx and portfolio layout.tsx.
      supabase
        .from("plan_assignments")
        .select("trainee_id, tp_number, taught_at")
        .eq("course_id", courseId)
        .not("taught_at", "is", null),
      // tp_feedback has no course_id column -- scope by this course's trainee ids instead.
      traineeIds.length > 0
        ? supabase.from("tp_feedback").select("trainee_id, tp_number, submitted_at").in("trainee_id", traineeIds)
        : Promise.resolve({ data: [] }),
      supabase.from("assignments").select("assignment_type, first_submitted_at").eq("course_id", courseId).eq("due_date", today),
    ]);

  // build-spec.md: "A line on the marking tutor's Today screen -- '2
  // assignments have scanner findings' -- visible to that tutor only,
  // with no candidate names." A bare count only, never a list here.
  const [{ data: courseAssignmentIds }, materialsOverlaps] = await Promise.all([
    supabase.from("assignments").select("id").eq("course_id", courseId),
    findMaterialsOverlaps(supabase, courseId),
  ]);
  const { data: unreviewedFindings } =
    (courseAssignmentIds ?? []).length > 0
      ? await supabase
          .from("plagiarism_scanner_findings")
          .select("assignment_id")
          .in(
            "assignment_id",
            (courseAssignmentIds ?? []).map((a) => a.id)
          )
          .is("reviewed_at", null)
      : { data: [] };
  const assignmentsWithFindings = new Set((unreviewedFindings ?? []).map((f) => f.assignment_id)).size;

  // Handbook 9.2: "raise as a note to the tutor, never an accusation" --
  // same bare-count, no-names treatment as the plagiarism line above.
  const materialsOverlapCount = new Set(materialsOverlaps.map((f) => f.assignmentId)).size;

  // "Needs you" -- capped at 3 total, this priority order.
  type Alert = { title: string; meta: string; href: string; destructive?: boolean };
  const alerts: Alert[] = [];

  // Enrolment Forms.dc.html 1c -- "the centre replies to every concern."
  // Surfaced to any trainer, not routed to just the one named recipient
  // (see migration 0140's own reasoning).
  if (trainer?.course_id) {
    const { count: openConcernCount } = await supabase
      .from("concerns")
      .select("id", { count: "exact", head: true })
      .eq("course_id", trainer.course_id)
      .is("response", null);
    if (openConcernCount && openConcernCount > 0) {
      alerts.push({
        title: `${openConcernCount} concern${openConcernCount === 1 ? "" : "s"} awaiting a reply`,
        meta: "Raised through the internal complaints route",
        href: "/trainer/concerns",
      });
    }
  }

  // Grade Pipeline handoff: reminder is MCT-specific (only they can act on
  // it) and computed from the deadline the MCT set themselves, not a fixed
  // offset from the assessor visit date. 4 days is a starting judgment call,
  // not a rule from the spec -- reasonable to retune later.
  //
  // trainer.tutor_role (profiles.tutor_role) is set once at signup for a
  // trainer's first course and never re-synced when their role on a
  // specific course changes later -- same staleness (hub)/layout.tsx's own
  // isMct hit, and a platform_owner never has it set at all. course_tutors.
  // tutor_role for the course they're actually on (courseId) is the live
  // source both places now agree on.
  let isMct = trainer?.role === "admin";
  if (trainer && !isMct) {
    const admin = createAdminClient();
    const { data: tutorLink } = await admin
      .from("course_tutors")
      .select("tutor_role")
      .eq("course_id", courseId)
      .eq("profile_id", trainer.id)
      .is("left_at", null)
      .maybeSingle();
    isMct = tutorLink?.tutor_role === "main_course_tutor";
  }

  // Handbook 14.1's preparation list, sized to this course. Only computed for
  // the MCT, since that's the only person it renders for -- see the card
  // below. `as never` on the select keeps this compiling before migration
  // 0254 has been run; an absent column reads as undefined and falls back to
  // the Handbook's own default of a regular assessment.
  const preparationDeadline = centrePreparationDeadline(course?.assessor_visit_date ?? null);
  let assessmentKind: AssessmentKind = "regular";
  // Same reason as assessment_kind below -- 0256 adds this column and Ramy
  // runs migrations, so it is read off the `*` row rather than named above.
  let appianReference: string | null = null;
  let centrePreparation: ReturnType<typeof buildCentrePreparationList> = [];
  let visitDayProblem: string | null = null;
  if (isMct && courseId) {
    // assessment_kind is read by its own `select("*")` rather than being
    // named in the course select above: migration 0254 adds the column and
    // Ramy runs migrations, and naming an absent column in a select poisons
    // the whole row's generated type. `*` returns whatever exists, so this
    // compiles and runs correctly either side of the migration, falling back
    // to the Handbook's own default of a regular assessment.
    const [{ data: kindRow }, { count: candidateCount }, { count: withdrawnCount }] = await Promise.all([
      supabase.from("courses").select("*").eq("id", courseId).maybeSingle(),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("course_id", courseId).eq("role", "trainee"),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("course_id", courseId)
        .eq("role", "trainee")
        .eq("course_status", "withdrawn"),
    ]);
    assessmentKind = ((kindRow as { assessment_kind?: string } | null)?.assessment_kind ?? "regular") as AssessmentKind;
    appianReference = (kindRow as { appian_notification_reference?: string | null } | null)?.appian_notification_reference ?? null;
    centrePreparation = buildCentrePreparationList({
      assessmentKind,
      deliveryMode: course?.delivery_mode ?? "f2f",
      candidateCount: candidateCount ?? 0,
      withdrawnCount: withdrawnCount ?? 0,
    });
    visitDayProblem = await assessorVisitDayProblem(supabase, courseId, course?.assessor_visit_date ?? null);
  }
  if (isMct && course?.provisional_grades_due_at) {
    const { data: records } =
      traineeIds.length > 0
        ? await supabase.from("celta5_records").select("provisional_grade, provisional_approved_at").in("trainee_id", traineeIds)
        : { data: [] };
    const withProvisional = (records ?? []).filter((r) => r.provisional_grade);
    const approvedCount = withProvisional.filter((r) => r.provisional_approved_at).length;
    const dueDate = course.provisional_grades_due_at.slice(0, 10);
    const daysOut = Math.ceil((new Date(`${dueDate}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000);
    const REMINDER_WINDOW_DAYS = 4;
    if (daysOut <= REMINDER_WINDOW_DAYS && approvedCount < traineeIds.length) {
      alerts.push({
        title: `Provisional grades due ${daysOut <= 0 ? "today" : `in ${daysOut} day${daysOut === 1 ? "" : "s"}`}`,
        meta: `${approvedCount} of ${traineeIds.length} confirmed by the MCT`,
        href: "/trainer/grades-report",
        destructive: daysOut <= 0,
      });
    }
  }

  // for-claude-code-course-admin-landing-and-admissions.md §4: "When [the
  // assessor is] set, the MCT should get notified... with the assessor's
  // name and contact info." Same "computed fresh, no persisted dismiss
  // state" pattern as every other alert here -- this one resolves itself
  // once the MCT has actually set a visit date (assessor_visit_date),
  // which is the real next step once they know who it is, rather than a
  // separate notified_at flag to track and clear.
  if (isMct && course?.assessor_name && !course.assessor_visit_date) {
    alerts.push({
      title: `Assessor named -- ${course.assessor_name}`,
      meta: course.assessor_email ?? "No email on file",
      href: "/trainer",
    });
  }

  // Grade Pipeline handoff, "Decided": "Final-grade reminder timing is tied
  // to the last TP day, not the last calendar day of the course... the same
  // way the provisional-grade reminder is tied to the assessor visit date
  // -- not a fixed course-end date." No MCT-set deadline here (unlike
  // provisionals) -- the trigger is the last TP day itself, always known
  // from the real timetable, so there's nothing for the MCT to set.
  if (isMct) {
    // Anchored to whichever TP number is the final one on THIS course (its
    // own linked_tp_number, not just whichever event happens to carry the
    // latest date) -- Ramy, 2026-08-17: "the final TP on the course rather
    // than TP eight," since not every course is guaranteed to run exactly 8.
    const { data: tpEvents } = await supabase
      .from("course_timetable_events")
      .select("event_date, linked_tp_number")
      .eq("course_id", courseId)
      .eq("type", "tp")
      .not("linked_tp_number", "is", null)
      .order("linked_tp_number", { ascending: false })
      .limit(1);
    const lastTpDate = tpEvents?.[0]?.event_date ?? null;
    if (lastTpDate && lastTpDate <= today) {
      const { data: finalRecords } =
        traineeIds.length > 0
          ? await supabase.from("celta5_records").select("final_recommended_grade").in("trainee_id", traineeIds)
          : { data: [] };
      const finalizedCount = (finalRecords ?? []).filter((r) => r.final_recommended_grade).length;
      if (finalizedCount < traineeIds.length) {
        const daysSince = Math.ceil((new Date(`${today}T00:00:00`).getTime() - new Date(`${lastTpDate}T00:00:00`).getTime()) / 86400000);
        alerts.push({
          title: `Final grades -- ${daysSince <= 0 ? "last TP day" : `${daysSince} day${daysSince === 1 ? "" : "s"} since the last TP`}`,
          meta: `${finalizedCount} of ${traineeIds.length} recommended`,
          href: "/trainer/grades-report",
          destructive: daysSince > 3,
        });
      }
    }
  }

  const unsentByTrainee = new Map<string, string>(); // trainee_id -> most recent taught date
  for (const lesson of lessons ?? []) {
    const hasFeedback = (feedbackRows ?? []).some(
      (f) => f.trainee_id === lesson.trainee_id && f.tp_number === lesson.tp_number && f.submitted_at
    );
    // taught_at is a timestamptz, not a date -- slice to the date part so the
    // string compare below stays a real date compare.
    const taughtDate = lesson.taught_at?.slice(0, 10);
    if (!hasFeedback && taughtDate) {
      const existing = unsentByTrainee.get(lesson.trainee_id);
      if (!existing || taughtDate > existing) unsentByTrainee.set(lesson.trainee_id, taughtDate);
    }
  }
  if (unsentByTrainee.size > 0) {
    const names = [...unsentByTrainee.keys()].map((id) => nameById.get(id) ?? "Unknown");
    const latestDate = [...unsentByTrainee.values()].sort().at(-1);
    alerts.push({
      title: `TP feedback unsent — ${unsentByTrainee.size} candidate${unsentByTrainee.size === 1 ? "" : "s"}`,
      meta: `${names.join(", ")} · taught ${latestDate}`,
      href: "/trainer/roster",
    });
  }

  // for-claude-code-announcement-infra-fixes.md item 2, C2's trainer-facing
  // reminder -- "the trainer who ran it" resolves to every trainer on the
  // course (no per-session tutor assignment exists yet), same simplification
  // A5/A6's group-nudge messages made before tutor_group_assignments-style
  // ownership existed. One week lookback: older gaps are a close-out
  // question, not a daily nudge.
  const REGISTER_LOOKBACK_DAYS = 7;
  const lookbackDate = (() => {
    // Pure calendar-date arithmetic on the already-resolved `today` string,
    // not a fresh real-timezone conversion -- same self-consistent local
    // round-trip reasoning as buildDayRows' own week-start computation.
    const d = new Date(`${today}T00:00:00`);
    d.setDate(d.getDate() - REGISTER_LOOKBACK_DAYS);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const { data: unloggedSessions } = await supabase
    .from("course_timetable_events")
    .select("id, title, event_date")
    .eq("course_id", courseId)
    .eq("type", "tp")
    .lt("event_date", today)
    .gte("event_date", lookbackDate)
    .is("register_submitted_at", null)
    .order("event_date", { ascending: false });
  for (const session of unloggedSessions ?? []) {
    alerts.push({
      title: `Register not logged — ${session.title}`,
      meta: session.event_date,
      href: "/trainer/timetable",
    });
  }

  const dueByType = new Map<string, { total: number; submitted: number }>();
  for (const a of dueAssignments ?? []) {
    const entry = dueByType.get(a.assignment_type) ?? { total: 0, submitted: 0 };
    entry.total += 1;
    if (a.first_submitted_at) entry.submitted += 1;
    dueByType.set(a.assignment_type, entry);
  }
  for (const [type, { total, submitted }] of dueByType) {
    alerts.push({ title: `${type} due today`, meta: `${submitted} of ${total} submitted`, href: "/trainer/roster" });
  }

  // master-backlog #1 -- 3 streams (back-to-back fails, missing must-submit
  // docs, repeating action points) plus the same-TP contradiction flag,
  // computed once in fetchRosterRows so roster/CSV/Today can't disagree.
  const flaggedRows = rows.filter((r) => r.atRiskReasons.length > 0);
  for (const r of flaggedRows) {
    alerts.push({
      title: `At risk — ${r.name}`,
      meta: r.atRiskReasons.map((reason) => AT_RISK_LABELS[reason]).join(" · "),
      href: `/portfolio/${r.id}`,
      destructive: true,
    });
  }

  const atRisk = rows.filter((r) => r.attendancePct < 80);
  for (const r of atRisk) {
    alerts.push({
      title: `Attendance below 80% — ${r.name}`,
      meta: `${r.attendancePct}%`,
      href: `/portfolio/${r.id}`,
      destructive: true,
    });
  }

  const visibleAlerts = alerts.slice(0, 3);

  const cohort = rows.slice(0, 6);

  // Spec's per-candidate avatar hues -- explicitly decorative, "for visual
  // variety, not semantic", so they're indexed by position rather than
  // derived from anything meaningful. A flagged candidate drops its hue for
  // the alert red instead, which IS semantic.
  const AVATAR_HUES = [
    "oklch(52% 0.1 260)", // blue
    "oklch(55% 0.11 25)", // terracotta
    "oklch(58% 0.1 145)", // green
    "oklch(60% 0.1 300)", // purple
    "var(--color-gold)",
  ] as const;

  // The one conflict Ramy's 2026-08-16 diff turned up between the trainer-
  // homepage spec and what's live: the spec drew a bespoke "3 / 8" taught
  // count here. Per specs/for-claude-code-unified-tracking.md, tracked
  // activities have exactly ONE source -- the Roster Standing table -- so
  // this reads that table's own TP-stages rollup instead of recomputing.
  // Keep this in step with roster-row.tsx's TP stages cell; if that cell's
  // meaning changes, this changes with it.
  const stageStatus = (r: (typeof rows)[number]) =>
    r.tpStagesTaught === 0
      ? { label: "No TPs yet", className: "text-muted" }
      : r.tpStagesBehind > 0
        ? { label: "Behind", className: "text-status-warning-text font-semibold" }
        : { label: "On track", className: "text-muted" };

  const initialsOf = (name: string) =>
    name
      .split(" ")
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

  const weekOf =
    course?.start_date && course?.end_date ? computeWeekOf(course.start_date, course.end_date, today) : null;

  // Spec's eyebrow reads "... · 6 Nov – 1 Dec · week 2 of 4" -- these were
  // rendering as raw ISO dates.
  const shortDate = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const overline = [
    course?.name,
    course?.start_date && course?.end_date ? `${shortDate(course.start_date)} – ${shortDate(course.end_date)}` : null,
    weekOf,
  ]
    .filter(Boolean)
    .join(" · ");
  const todayHeading = new Date(`${today}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <p className="text-[10.5px] font-bold tracking-[0.1em] text-muted uppercase">{overline}</p>
          <h1
            className="font-serif text-[24px] font-semibold"
            style={{ color: isMct ? "oklch(30% 0.042 58)" : "oklch(42% 0.13 27)" }}
          >
            {todayHeading}
          </h1>
        </div>
        {/* for-claude-code-assessor-tour-mode.md: a tour is view-only, "no
            functional purpose beyond letting them see" -- these are staff
            write actions, not something a touring assessor should be
            invited to click (every one of them would fail closed anyway,
            since requireRole() never authorizes a cookie-only session, but
            offering a button that always fails is a worse look than
            omitting it). */}
        {trainer ? (
        <div className="flex flex-wrap items-center gap-2">
          {/* specs/build-spec.md §7: the one trainer surface meant to be
              genuinely usable on a phone mid-lesson -- kept first/most
              prominent in this row for that reason. Not in trainer-
              homepage-mct-act-header-spec.md (postdates it) -- kept, just
              brought to the same h-8/13px/12px dimensions as the two
              buttons that are in spec, for consistency across the row. */}
          <Link
            href="/trainer/capture"
            className="trainer-hover-fill flex h-8 items-center rounded-[6px] border border-primary bg-transparent px-[13px] text-xs font-medium text-primary"
          >
            Capture a point
          </Link>
          {/* for-claude-code-mct-only-announcements.md: hidden, not just
              disabled, for a non-MCT trainer -- announcements/page.tsx
              itself is now MCT-only too (the real gate), this just keeps
              the quick link from pointing an ACT at a page with nothing
              they can do. */}
          {isMct ? (
            <Link
              href="/trainer/announcements"
              className="trainer-hover-fill flex h-8 items-center rounded-[6px] border border-border bg-card px-[13px] text-xs font-medium text-ink"
            >
              Post announcement
            </Link>
          ) : null}
          <Link
            href="/trainer/roster"
            className="flex h-8 items-center rounded-[6px] px-[13px] text-xs font-semibold text-primary-foreground"
            style={{ background: isMct ? "oklch(37.5% 0.058 195)" : "oklch(42% 0.13 27)" }}
          >
            Write TP feedback
          </Link>
        </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.15fr_1fr_1.1fr]">
        {/* Today's schedule. The spec gives each panel a 3px top accent and a
            label in the matching colour, so the three read as distinct at a
            glance: teal = the day's material, gold = a system rule is in force
            (globals.css reserves gold for exactly that), ink = plain content. */}
        <div className="sheet flex flex-col gap-3.5 border-t-[3px] border-t-primary">
          <div className="flex items-baseline justify-between">
            <p
              className="text-[10.5px] font-bold tracking-[0.12em] uppercase"
              style={{ color: isMct ? "oklch(37.5% 0.058 195)" : "oklch(42% 0.13 27)" }}
            >
              Today&apos;s schedule
            </p>
            <p className="text-[11px] text-muted">from the timetable</p>
          </div>
          <div className="flex flex-col">
            {(todayEvents ?? []).length === 0 ? (
              <p className="py-2 text-sm text-muted">Nothing on the timetable today.</p>
            ) : (
              (todayEvents ?? []).map((event, i) => {
                const category = categorize(event);
                const live = event.type === "tp" && isEventLive(event, new Date(), timeZone);
                return (
                  <div
                    key={event.id}
                    className={`flex gap-2.5 py-2 ${i > 0 ? "border-t border-border-faint" : ""}`}
                  >
                    <span
                      className="w-[42px] shrink-0 border-l-[3px] pl-2 text-[11.5px] font-semibold text-muted tabular-nums"
                      style={{ borderLeftColor: CATEGORY_ACCENT[category] }}
                    >
                      {event.event_time?.slice(0, 5)}
                    </span>
                    <div className="flex flex-1 flex-col gap-1.5">
                      {/* Spec: a live TP session gets a bold row and a teal
                          "Live" pill. Kept as a link when there's a Zoom URL
                          to open -- the pill is the affordance that was
                          already here, only its label and weight change. */}
                      <p className={`text-[12.5px] text-ink ${live ? "font-semibold" : ""}`}>{event.title}</p>
                      {live && event.zoom_url ? (
                        <a
                          href={event.zoom_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-primary-foreground"
                        >
                          <span className="size-[5px] shrink-0 rounded-full bg-primary-foreground" />
                          Join now
                        </a>
                      ) : live ? (
                        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-primary">
                          <span className="size-[5px] shrink-0 rounded-full bg-primary" />
                          Live
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Needs you */}
        <div className="sheet flex flex-col gap-3.5 border-t-[3px] border-t-status-warning-text">
          <p className="text-[10.5px] font-bold tracking-[0.12em] uppercase" style={{ color: "oklch(60% 0.1 70)" }}>
            Needs you · {alerts.length}
          </p>
          <div className="flex flex-col">
            {visibleAlerts.length === 0 ? (
              <p className="py-2 text-sm text-muted">Nothing needs you right now.</p>
            ) : (
              visibleAlerts.map((alert, i) => (
                <Link
                  key={i}
                  href={alert.href}
                  className={`trainer-hover -mx-[6px] flex flex-col gap-0.5 rounded-[5px] px-[6px] py-[7px] ${i > 0 ? "border-t border-border-faint" : ""}`}
                >
                  <p className={`text-[12.5px] font-semibold ${alert.destructive ? "text-destructive" : "text-ink"}`}>{alert.title}</p>
                  <p className="text-xs text-muted">{alert.meta}</p>
                </Link>
              ))
            )}
          </div>
          {assignmentsWithFindings > 0 ? (
            <Link
              href="/trainer/roster"
              className="border-t border-border-faint pt-2.5 text-xs text-muted hover:text-primary"
            >
              {assignmentsWithFindings} assignment{assignmentsWithFindings === 1 ? "" : "s"} have scanner findings
            </Link>
          ) : null}
          {materialsOverlapCount > 0 ? (
            <Link
              href="/trainer/roster"
              className="border-t border-border-faint pt-2.5 text-xs text-muted hover:text-primary"
            >
              {materialsOverlapCount} assignment{materialsOverlapCount === 1 ? "" : "s"} share wording with a TP&apos;s materials
            </Link>
          ) : null}
        </div>

        {/* Cohort */}
        <div className="sheet flex flex-col gap-3.5 border-t-[3px] border-t-gold">
          <div className="flex items-baseline justify-between">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-ink-warm uppercase">Cohort · {rows.length}</p>
            <Link href="/trainer/roster" className="text-[11px] text-primary">
              Full roster →
            </Link>
          </div>
          <div className="flex flex-col">
            {cohort.map((r, i) => {
              const status = stageStatus(r);
              const flagged = r.atRiskReasons.length > 0;
              return (
                <Link
                  key={r.id}
                  href={`/portfolio/${r.id}`}
                  className={`trainer-hover -mx-2 flex items-center gap-3 rounded-[6px] px-2 py-2.5 ${i > 0 ? "border-t border-border-faint" : ""}`}
                >
                  <span
                    aria-hidden="true"
                    className="flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-primary-foreground"
                    style={{ backgroundColor: flagged ? "var(--color-destructive)" : AVATAR_HUES[i % AVATAR_HUES.length] }}
                  >
                    {initialsOf(r.name)}
                  </span>
                  <span className="flex-1 truncate text-sm text-ink">{r.name}</span>
                  <span className={`shrink-0 text-xs ${status.className}`}>{status.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {feedbackAssist ? (
        <FeedbackAssistCard
          initialEnabled={feedbackAssist.enabled}
          initialDirect={feedbackAssist.direct}
          initialSupportive={feedbackAssist.supportive}
        />
      ) : null}

      {isMct ? (
        <AssessorCard
          initialName={course?.assessor_name ?? null}
          initialEmail={course?.assessor_email ?? null}
          initialVisitDate={course?.assessor_visit_date ?? null}
          initialAssessmentKind={assessmentKind}
          initialAppianReference={appianReference}
        />
      ) : null}

      {/* Ramy, 30 Aug 2026: "there should be somewhere where the MCT is
          preparing the assessor pack... they should just be suggested by
          Connect depending on the course size... depending on the course mode
          and the course size." Handbook 14.1's list, with the items that
          depend on this course's mode, size or circumstances marked, so the
          MCT can see WHY a line is there rather than working from a generic
          checklist. MCT-only, same as the card above it -- preparing the pack
          is their job, not every tutor's. */}
      {/* A visit date with no teaching on it can't deliver Handbook 14.2's
          "co-observe two candidates", and nothing said so -- Elmswood's
          November course had a visit booked for the 30th with not one event
          on the day. Sits above the preparation list because no amount of
          preparing fixes a day with nothing to observe. */}
      {isMct && visitDayProblem ? (
        <div className="flex flex-col gap-1 rounded-[8px] border border-status-warning-text/25 bg-status-warning-bg px-[22px] py-4">
          <p className="text-[11px] font-bold tracking-[0.12em] text-status-warning-text uppercase">
            The assessor visit needs a look
          </p>
          <p className="text-sm text-status-warning-text">{visitDayProblem}</p>
          <Link href="/trainer/timetable?mode=edit" className="mt-1 self-start text-[12.5px] font-semibold text-status-warning-text underline">
            Open the timetable
          </Link>
        </div>
      ) : null}

      {isMct && centrePreparation.length > 0 ? (
        <div className="flex flex-col gap-4 rounded-[8px] border border-border border-t-[3px] border-t-gold bg-card px-[22px] py-5">
          <div className="flex flex-col gap-[3px]">
            <p className="text-[11px] font-bold tracking-[0.12em] text-muted uppercase">What the assessor needs from you</p>
            <p className="text-sm text-muted">
              Administration Handbook §14.1.{" "}
              {preparationDeadline
                ? `Available by ${new Date(`${preparationDeadline}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long" })} — two to three days before the visit, so the assessor can read it.`
                : "Set a visit date above and Connect will date this list for you."}
            </p>
          </div>
          <ul className="flex flex-col gap-2.5">
            {centrePreparation.map((item) => (
              <li key={item.label} className="flex flex-col gap-[2px] border-t border-border-faint pt-2.5 first:border-t-0 first:pt-0">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[13px] font-semibold text-ink">
                    {item.label}
                    {item.conditional ? (
                      <span className="ml-2 text-[10px] font-bold tracking-[0.08em] text-gold uppercase">This course</span>
                    ) : null}
                  </p>
                  <span className="shrink-0 text-[10px] font-semibold text-muted tabular-nums">§{item.cite}</span>
                </div>
                <p className="text-xs text-muted">{item.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <DesignerCredit />
    </div>
  );
}
