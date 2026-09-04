import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { getAssessorCourseId, isAssessorTourMode } from "@/lib/auth/portfolio-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchRosterRows } from "@/lib/roster";
import { toLocalIso, zonedTimeToUtc, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";
import { getCachedCenter } from "@/lib/supabase/cached-queries";
import { computeWeekOf } from "@/lib/course-progress";
import { AT_RISK_LABELS } from "@/lib/at-risk";
import { DesignerCredit } from "@/components/designer-credit";
import { getFeedbackAssistState } from "@/lib/feedback-assist";
import { FeedbackAssistCard } from "@/app/trainer/(hub)/feedback-assist-card";
import { AssessorCard } from "@/app/trainer/(hub)/assessor-card";
import { buildCentrePreparationList, centrePreparationDeadline, type AssessmentKind } from "@/lib/assessor-requirements";
import { assessorVisitDayProblem } from "@/lib/assessor-day";
import { findMaterialsOverlaps } from "@/lib/materials-overlap";
import { Avatar } from "@/components/avatar";
import { NeedsYou, type TodayAlert } from "@/app/trainer/(hub)/needs-you";
import { YourDay, LiveClock, type DaySlot } from "@/app/trainer/(hub)/your-day";
import { sixHoursProblems, doubleMarkingProblems, entryFormProblems, type ComplianceProblem } from "@/lib/course-compliance";

// Checkpoint 2 -- Today, the (hub) group's own index page (bare /trainer),
// replacing the old marketing hero + candidate-card-grid. build-spec.md's
// App Redesign.dc.html 1a: today's schedule (from the real timetable),
// what needs a trainer's attention right now, and the cohort at a glance.
//
// NOTE ON App Redesign.dc.html -- it is not in specs/handoffs/ and Ramy
// confirmed on 31 Aug 2026 that no file by that name exists to recover. Every
// other design source cited in this codebase was found and archived that day;
// this one is a dead reference, so do not go looking for it.
//
// The citations are kept rather than stripped because the redesign itself was
// real and its results are load-bearing. "Checkpoint 2" was a pass that
// changed four screens: this page (hero + card grid -> Today), the trainee
// tabs (top bar -> 232px sidebar), the trainee header (two blocks -> one 56px
// bar) and the TP1-8 view (card grid -> table). Deleting the attribution would
// leave four deliberate design decisions looking like somebody's preference.
//
// So: treat these as provenance for WHY the screens changed, never as a
// specification to check the code against. There is nothing to check against.
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
        .select("name, start_date, end_date, assessor_visit_date, provisional_grades_due_at, assessor_name, assessor_email, assessor_notified_at, delivery_mode, entry_form_sent_at")
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

  // "Needs you" -- every one of them, in this priority order. It used to be
  // capped at three: the header said 17 and the body showed 3, and the other
  // fourteen had no route. Ramy, 4 Sep 2026: "it's a panel announcing work
  // and then hiding it." kind/badge/due feed the filter and the row layout.
  type Alert = TodayAlert;
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
        kind: "admin",
        badge: "CN",
        due: "Now",
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
        kind: "marking",
        badge: "PG",
        due: daysOut <= 0 ? "Today" : `${daysOut}d`,
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
      kind: "admin",
      badge: "AV",
      due: "Soon",
      title: `Assessor named -- ${course.assessor_name}`,
      meta: course.assessor_email ?? "No email on file",
      // Used to link to "/trainer" -- this page, a loop. The assessor card
      // below is where the visit date gets set.
      href: "#assessor",
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
          kind: "marking",
          badge: "FG",
          due: daysSince > 3 ? "Now" : "Today",
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
      kind: "tp",
      badge: "TP",
      due: "Today",
      title: `TP feedback unsent — ${unsentByTrainee.size} candidate${unsentByTrainee.size === 1 ? "" : "s"}`,
      meta: `${names.join(", ")} · taught ${latestDate}`,
      // This alert has just worked out exactly who is outstanding, and used
      // to discard that and drop you on the roster. The TP queue is the page
      // that lists them with a "Feedback due" pill and clicks straight into
      // the form.
      href: "/trainer/tp",
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
      kind: "tp",
      badge: "RG",
      due: "Today",
      title: `Register not logged — ${session.title}`,
      meta: session.event_date,
      href: "/trainer/volunteers",
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
    // Used to dump on the roster. The marking queue is where submissions
    // are opened; it lists exactly these.
    alerts.push({
      kind: "marking",
      badge: type.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase() || "AS",
      due: "Today",
      title: `${type} due today`,
      meta: `${submitted} of ${total} submitted`,
      href: "/trainer/tp",
    });
  }

  // master-backlog #1 -- 3 streams (back-to-back fails, missing must-submit
  // docs, repeating action points) plus the same-TP contradiction flag,
  // computed once in fetchRosterRows so roster/CSV/Today can't disagree.
  const flaggedRows = rows.filter((r) => r.atRiskReasons.length > 0);
  for (const r of flaggedRows) {
    alerts.push({
      kind: "candidate",
      badge: "AR",
      due: "Now",
      title: `At risk — ${r.name}`,
      meta: r.atRiskReasons.map((reason) => AT_RISK_LABELS[reason]).join(" · "),
      href: `/portfolio/${r.id}`,
      destructive: true,
    });
  }

  const atRisk = rows.filter((r) => r.attendancePct < 80);
  for (const r of atRisk) {
    alerts.push({
      kind: "candidate",
      badge: `${Math.round(r.attendancePct)}%`,
      due: "Now",
      title: `Attendance below 80% — ${r.name}`,
      meta: `${r.attendancePct}%`,
      href: `/portfolio/${r.id}`,
      destructive: true,
    });
  }

  // ---- Scope: an ACT sees their own group's people and sessions; the MCT
  // sees the course. A group is "theirs" when course_tp_groups names them as
  // its tutor. If no group on the course is staffed yet (tutor_profile_id
  // null everywhere), scope stays the whole course rather than an empty
  // page -- honest about the setup rather than hiding it.
  let scopedTraineeIds: Set<string> | null = null;
  let scopedGroupIds: Set<string> | null = null;
  if (trainer && !isMct) {
    const admin = createAdminClient();
    const { data: myGroups } = await admin.from("course_tp_groups").select("id").eq("course_id", courseId).eq("tutor_profile_id", trainer.id);
    if (myGroups && myGroups.length > 0) {
      scopedGroupIds = new Set(myGroups.map((g) => g.id));
      const { data: subs } = await admin.from("course_subgroups").select("id").eq("course_id", courseId).in("tp_group_id", [...scopedGroupIds]);
      const subIds = (subs ?? []).map((x) => x.id);
      const { data: members } = subIds.length ? await admin.from("course_subgroup_members").select("trainee_id").in("subgroup_id", subIds) : { data: [] };
      scopedTraineeIds = new Set((members ?? []).map((m) => m.trainee_id));
    }
  }
  const inScope = (traineeId: string) => !scopedTraineeIds || scopedTraineeIds.has(traineeId);

  // Alerts about a specific candidate follow the scope; course-wide ones do
  // not (a concern or a grades deadline is everyone's).
  const scopedAlerts = alerts.filter((a) => {
    const m = a.href.match(/^\/portfolio\/([^/]+)/);
    return m ? inScope(m[1]) : true;
  });

  // ---- Flagged: only who is in trouble. rows.slice(0, 6) -- the first six
  // of the roster -- is gone; Ramy, 4 Sep 2026: "if something is flagged, it
  // should be in the cohort. Otherwise just use the roster."
  const flagged = rows
    .filter((r) => inScope(r.id))
    .map((r) => {
      const reasons: { text: string; tone: "red" | "gold" }[] = [];
      if (r.attendancePct < 80) reasons.push({ text: `Attendance ${Math.round(r.attendancePct)}% · below threshold`, tone: "red" });
      if (r.atRiskReasons.length > 0) reasons.push({ text: r.atRiskReasons.map((x) => AT_RISK_LABELS[x]).join(" · "), tone: "red" });
      if (r.tpStagesBehind > 0) reasons.push({ text: `Behind — ${r.tpStagesBehind} TP stage${r.tpStagesBehind === 1 ? "" : "s"}`, tone: "gold" });
      return { id: r.id, name: r.name, reasons };
    })
    .filter((r) => r.reasons.length > 0);

  // ---- Your day: only what this tutor is on. Every timetable row used to
  // render -- on the last demo day that was "Course close" six times and a
  // lunch break. Milestones, due-dates and lunch are the timetable's, not a
  // person's; TP rows follow the group scope. Events carry no tutor of their
  // own, so input and supervised sessions are shown to every tutor.
  const serverNowMs = Date.now();
  const SLOT_MINUTES: Record<string, number> = { tp: 3 * 60, input_session: 60, supervised_session: 60 };
  const rawSlots: DaySlot[] = (todayEvents ?? [])
    .filter((e) => e.event_time && (e.type === "tp" || e.type === "input_session" || e.type === "supervised_session") && e.tag !== "lunch")
    .filter((e) => !(e.type === "tp" && scopedGroupIds && e.tp_group_scope_id && !scopedGroupIds.has(e.tp_group_scope_id)))
    .map((e) => {
      const start = zonedTimeToUtc(e.event_date, e.event_time!, timeZone).getTime();
      return {
        id: e.id,
        time: e.event_time!.slice(0, 5),
        title: e.title,
        sub: e.detail,
        startsAtMs: start,
        endsAtMs: start + (SLOT_MINUTES[e.type] ?? 60) * 60_000,
        zoomUrl: e.zoom_url,
      };
    });
  // Consecutive slots with the same title collapse to one row spanning them.
  // The demo's last day is "Course close" six times over; a real course can
  // repeat a block the same way. Six rows say less than one that reads
  // "10:00–15:15 · × 6".
  const daySlots: DaySlot[] = [];
  for (const slot of rawSlots) {
    const last = daySlots[daySlots.length - 1];
    if (last && last.title === slot.title && last.sub === slot.sub) {
      const n = (last as DaySlot & { _n?: number })._n ?? 1;
      (last as DaySlot & { _n?: number })._n = n + 1;
      last.endsAtMs = slot.endsAtMs;
      last.time = `${last.time.split("–")[0]}–${slot.time}`;
      last.sub = `× ${n + 1}`;
    } else {
      daySlots.push({ ...slot });
    }
  }

  // ---- The banner: what the course cannot satisfy as planned.
  const problems: ComplianceProblem[] = [];
  if (visitDayProblem) {
    problems.push({ tag: "Assessor visit", message: visitDayProblem, detail: "Nothing to observe", href: "/trainer/timetable?mode=edit", cite: "14.2" });
  }
  {
    const { data: futureTps } = await supabase
      .from("course_timetable_events")
      .select("linked_tp_number")
      .eq("course_id", courseId)
      .eq("type", "tp")
      .gt("event_date", today)
      .not("linked_tp_number", "is", null);
    const futureTpNumbers = [...new Set((futureTps ?? []).map((t) => t.linked_tp_number as number))];
    problems.push(
      ...sixHoursProblems({
        candidates: rows.filter((r) => inScope(r.id) && r.courseStatus === "active").map((r) => ({ id: r.id, name: r.name, assessedHrs: r.assessedHrs, tpStagesTaught: r.tpStagesTaught })),
        futureTpNumbers,
      })
    );
  }
  if (isMct) {
    const { data: marked } = await supabase.from("assignments").select("assignment_type, second_marker_recorded_at").eq("course_id", courseId);
    const byType = new Map<string, number>();
    const types = new Set<string>();
    for (const a of marked ?? []) {
      types.add(a.assignment_type);
      if (a.second_marker_recorded_at) byType.set(a.assignment_type, (byType.get(a.assignment_type) ?? 0) + 1);
    }
    problems.push(...doubleMarkingProblems({ candidateCount: rows.length, today, endDate: course?.end_date ?? null, doubleMarkedByType: byType, assignmentTypes: [...types] }));
    problems.push(...entryFormProblems({ today, startDate: course?.start_date ?? null, deliveryMode: course?.delivery_mode ?? null, entryFormSentAt: course?.entry_form_sent_at ?? null }));
  }

  // Same-tag problems collapse to one row. Seen live on the demo course:
  // three "cannot reach 6 hrs" banners in a stack, one per candidate, where
  // a single line saying "3 candidates" is the same fact told once. The
  // rule -- one row per impossibility -- holds; "everyone is short" is one
  // impossibility, not three.
  const problemsByTag = new Map<string, ComplianceProblem[]>();
  for (const pr of problems) problemsByTag.set(pr.tag, [...(problemsByTag.get(pr.tag) ?? []), pr]);
  const shownProblems: ComplianceProblem[] = [...problemsByTag.values()].map((group) => {
    if (group.length === 1) return group[0];
    const first = group[0];
    if (first.tag === "Cannot reach 6 hrs") {
      const names = group.map((g) => g.message.replace(/ cannot reach six assessed hours.*$/, ""));
      return {
        ...first,
        message: `${group.length} candidates cannot reach six assessed hours on the current timetable`,
        detail: names.join(", "),
      };
    }
    return { ...first, message: `${group.length} × ${first.message}`, detail: group.map((g) => g.detail).join(" · ") };
  });

  // v4's role accent: MCT garnet, ACT gold. The hub header still carries its
  // older ink/garnet pairing -- restyling that bar is Phase 4 work on the
  // layout, not this page.
  const accent = isMct ? "oklch(42% 0.13 27)" : "oklch(60% 0.11 70)";
  const accentDeep = isMct ? "oklch(36% 0.12 27)" : "oklch(50% 0.11 65)";

  const weekOf =
    course?.start_date && course?.end_date ? computeWeekOf(course.start_date, course.end_date, today) : null;

  const overline = [
    course?.name,
    isMct ? "cohort" : scopedGroupIds ? "your group" : "all groups",
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
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-[11.5px] font-bold tracking-[0.1em] text-muted uppercase">{overline}</p>
          <h1 className="font-serif text-[34px] leading-[1.08] font-semibold text-ink-warm">
            {todayHeading}
            <LiveClock timeZone={timeZone} serverNowMs={serverNowMs} accent={accentDeep} />
          </h1>
        </div>
        {trainer ? (
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/trainer/capture" className="trainer-hover-fill flex h-10 items-center rounded-[8px] border border-border bg-card px-3.5 text-[13px] font-medium text-ink">
              Capture a point
            </Link>
            {isMct ? (
              <Link href="/trainer/announcements" className="trainer-hover-fill flex h-10 items-center rounded-[8px] border border-border bg-card px-3.5 text-[13px] font-medium text-ink">
                Post announcement
              </Link>
            ) : null}
            <Link
              href="/trainer/tp"
              className="flex h-10 items-center rounded-[8px] px-[18px] text-[13.5px] font-bold text-primary-foreground transition-[filter] hover:brightness-110"
              style={{ background: accent }}
            >
              Write TP feedback
            </Link>
          </div>
        ) : null}
      </div>

      {shownProblems.map((pr) => (
        <Link
          key={pr.tag + pr.message}
          href={pr.href}
          className="flex flex-wrap items-center gap-3.5 rounded-[10px] px-[18px] py-3.5 text-primary-foreground transition-[filter] hover:brightness-110"
          style={{ background: accent }}
        >
          <span className="rounded-[5px] bg-white/[0.18] px-2 py-1 text-[10.5px] font-bold tracking-[0.08em] uppercase whitespace-nowrap">{pr.tag}</span>
          <span className="flex-1 text-[14px] font-semibold">{pr.message}</span>
          <span className="text-[12.5px] opacity-80 whitespace-nowrap">
            {pr.detail} &middot; &sect;{pr.cite} &rarr;
          </span>
        </Link>
      ))}

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-5">
          <NeedsYou alerts={scopedAlerts} accent={accentDeep} />

          {flagged.length > 0 ? (
            <section className="flex flex-col rounded-[14px] border border-border bg-frame">
              <div className="flex items-center justify-between gap-3 px-[18px] pt-4 pb-2">
                <div className="flex items-baseline gap-2.5">
                  <h3 className="font-serif text-[20px] font-semibold text-ink-warm">Flagged candidates</h3>
                  <span className="text-[12.5px] text-muted">
                    {flagged.length} of {rows.filter((r) => inScope(r.id)).length}
                  </span>
                </div>
                <Link href="/trainer/roster" className="text-[12.5px] text-muted hover:underline">
                  Full roster &rarr;
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-2.5 px-3.5 pb-4 sm:grid-cols-2">
                {flagged.map((f) => (
                  <Link
                    key={f.id}
                    href={`/portfolio/${f.id}`}
                    className="trainer-hover flex items-center gap-3 rounded-[10px] border border-border bg-card px-3 py-[11px]"
                  >
                    <Avatar name={f.name} size="sm" />
                    <span className="min-w-0">
                      <span className="block text-[13.5px] font-semibold text-ink">{f.name}</span>
                      {f.reasons.map((rs) => (
                        <span key={rs.text} className={`block truncate text-[12px] ${rs.tone === "red" ? "text-destructive" : "text-status-warning-text"}`}>
                          {rs.text}
                        </span>
                      ))}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {assignmentsWithFindings > 0 || materialsOverlapCount > 0 ? (
            <p className="px-1 text-[12px] text-muted">
              {assignmentsWithFindings > 0 ? `${assignmentsWithFindings} assignment${assignmentsWithFindings === 1 ? "" : "s"} have scanner findings` : null}
              {assignmentsWithFindings > 0 && materialsOverlapCount > 0 ? " · " : null}
              {materialsOverlapCount > 0 ? `${materialsOverlapCount} share wording with a TP's materials` : null}
              {" — "}
              <Link href="/trainer/roster" className="underline hover:text-ink">
                roster
              </Link>
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-5">
          <YourDay slots={daySlots} serverNowMs={serverNowMs} accent={accentDeep} />

          {isMct && course?.assessor_visit_date ? (
            <a
              href="#assessor"
              className="flex flex-col gap-1.5 rounded-[14px] px-[18px] py-4 text-[oklch(96%_0.008_85)] transition-[filter] hover:brightness-[1.13]"
              style={{ background: "var(--color-ink-warm)" }}
            >
              <span className="flex justify-between text-[10.5px] font-bold tracking-[0.11em] text-gold uppercase">
                <span>Assessor visit</span>
                <span>
                  {(() => {
                    const d = Math.ceil((Date.parse(`${course.assessor_visit_date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
                    return d < 0 ? "visited" : d === 0 ? "today" : `in ${d} day${d === 1 ? "" : "s"}`;
                  })()}
                </span>
              </span>
              <span className="font-serif text-[18px] font-semibold">
                {new Date(`${course.assessor_visit_date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                {course.assessor_name ? ` · ${course.assessor_name}` : ""}
              </span>
              <span className="text-[12px] opacity-80">
                {centrePreparation.length} preparation item{centrePreparation.length === 1 ? "" : "s"}
                {preparationDeadline ? ` · ready by ${new Date(`${preparationDeadline}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}
              </span>
              <span className="text-[12.5px] font-semibold text-gold">What the assessor needs &darr;</span>
            </a>
          ) : null}

          {isMct ? (
            <div className="flex flex-col gap-2">
              <span className="text-[10.5px] font-bold tracking-[0.11em] text-muted uppercase">Also under Today</span>
              <div className="flex flex-wrap gap-1.5">
                <Link href="/trainer/announcements" className="rounded-full border border-border px-2.5 py-1 text-[12px] text-muted transition-colors hover:border-current hover:text-ink">
                  Announcements &rarr;
                </Link>
              </div>
            </div>
          ) : null}
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
        <div id="assessor" className="scroll-mt-6">
          <AssessorCard
            initialName={course?.assessor_name ?? null}
            initialEmail={course?.assessor_email ?? null}
            initialVisitDate={course?.assessor_visit_date ?? null}
            initialAssessmentKind={assessmentKind}
            initialAppianReference={appianReference}
          />
        </div>
      ) : null}

      {isMct && centrePreparation.length > 0 ? (
        <div className="flex flex-col gap-4 rounded-[14px] border border-border bg-card px-[22px] py-5">
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
                    {item.conditional ? <span className="ml-2 text-[10px] font-bold tracking-[0.08em] text-gold uppercase">This course</span> : null}
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
