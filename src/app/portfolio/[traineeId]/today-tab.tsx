import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { toLocalIso, zonedTimeToUtc } from "@/lib/timetable-grid";
import { computeWeekOf } from "@/lib/course-progress";
import { rotationPosition, halfTpDates, type TpTimetableEvent } from "@/lib/rotation";
import { getTpCardStatus } from "@/lib/tp-plan-content";
import { ASSIGNMENT_INFO } from "@/lib/assignment-info";
import { SCAVENGER_HUNT_QUESTIONS } from "@/lib/scavenger-hunt";

const TP_LESSON_LENGTH_MINUTES = 45;
// Matches celta5/page.tsx's own local OBSERVATION_HOURS_REQUIRED -- kept as
// a separate constant rather than a shared import to avoid pulling that
// large staff/trainee-shared page's whole module graph into this one just
// for a single fixed CELTA number.
const OBSERVATION_HOURS_REQUIRED = 6;

// Same pattern as fol-spot-check/page.tsx's own local relativeTime -- kept
// page-local rather than shared, matching that precedent, for a 6-line helper.
function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return minutes <= 1 ? "just now" : `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

// The hero card's "in 90 minutes" meta -- Trainee Walkthrough.dc.html's own
// example, a live countdown to the lesson's start, not fixed text. Mirrors
// relativeTime's shape but counting forward instead of back.
function countdownTo(startsAt: Date): string {
  const diffMs = startsAt.getTime() - Date.now();
  if (diffMs <= 0) return "starting now";
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 60) return `in ${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.round(minutes / 60);
  return `in ${hours} hour${hours === 1 ? "" : "s"}`;
}

// Plain calendar-day arithmetic on a YYYY-MM-DD string -- deliberately not
// timezone-aware (unlike toLocalIso/zonedTimeToUtc elsewhere in this file),
// since `today` is already the trainee's local calendar date and "tomorrow"
// just means the next date on that same calendar, not a moment in time.
function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const LETTER_LABEL: Record<string, string> = {
  fail_risk: "A formal notice about your progress",
  assignment_warning: "A formal notice about an assignment",
  deferral: "Your deferral letter",
};

interface WaitingItem {
  label: string;
  detail: string;
  href: string;
  isLetter?: boolean;
  // Ramy, 28 Aug 2026: matches the real mockup's row() pill fields --
  // "Assignment 3 due today" and "Book your Stage 1 tutorial slot" both
  // carry a due-by pill (amber), while self-eval/observation rows don't --
  // only date-bound urgency gets one. Reuses the sitewide .pill system
  // (pill-warning/pill-danger), not a new color invention.
  pill?: string;
  pillClass?: "pill-warning" | "pill-danger";
  // "urgent items never get bumped off this list even when more pile up" --
  // previously only formal letters had this guarantee; extended to any
  // date-bound urgent item (assignment due today/overdue), same reasoning.
  urgent?: boolean;
}

// for-claude-code-trainee-interface.md's Today tab -- the new landing
// experience for a real trainee viewing their OWN portfolio (or, via the
// peer-observation carve-out in layout.tsx, a groupmate's). Staff/assessor
// keep the existing Course Stream content in page.tsx -- this is a
// deliberately separate component/fetch, not woven into that page's
// already-substantial staff-facing logic.
export async function TodayTab({
  supabase,
  traineeId,
  courseId,
  centerId,
  courseName,
  timeZone,
}: {
  supabase: SupabaseClient<Database>;
  traineeId: string;
  courseId: string;
  centerId: string;
  courseName: string | null;
  timeZone: string;
}) {
  const today = toLocalIso(new Date(), timeZone);
  const tomorrow = addDaysIso(today, 1);

  const [
    { data: course },
    { data: plans },
    { data: tpPlans },
    { data: selfEvaluations },
    { data: feedbackRows },
    { data: assignments },
    { data: subgroupMember },
    { data: observations },
  ] = await Promise.all([
    supabase.from("courses").select("start_date, end_date").eq("id", courseId).maybeSingle(),
    supabase.from("plan_assignments").select("*").eq("trainee_id", traineeId),
    supabase.from("tp_plans").select("tp_number, submitted_at").eq("trainee_id", traineeId),
    supabase.from("tp_self_evaluations").select("tp_number, submitted_at").eq("trainee_id", traineeId),
    supabase.from("tp_feedback").select("tp_number, grade, submitted_at").eq("trainee_id", traineeId),
    supabase.from("assignments").select("id, assignment_type, first_status, due_date").eq("trainee_id", traineeId),
    supabase.from("course_subgroup_members").select("subgroup_id, base_slot").eq("trainee_id", traineeId).maybeSingle(),
    supabase.from("observations").select("length_minutes, filmed").eq("trainee_id", traineeId),
  ]);

  // course_broadcasts carries three scope columns (visible_to_trainee_id/
  // _tp_group_id/_subgroup_id) that the write side already sets correctly
  // (personal assignment feedback, Stage 2's per-group nudge, rotation's
  // per-subgroup TP-release message) -- this filter is what makes those
  // writes actually private instead of every trainee seeing every
  // broadcast regardless of who it was meant for. Null in all three columns
  // = whole-cohort, the only case that needed no filter before this existed.
  const subgroupRow = subgroupMember
    ? (await supabase.from("course_subgroups").select("half_order, tp_group_id").eq("id", subgroupMember.subgroup_id).maybeSingle())
        .data
    : null;
  const subgroupTpGroupId = subgroupRow?.tp_group_id ?? null;
  let broadcastsQuery = supabase
    .from("course_broadcasts")
    .select("id, title, body, pinned, created_at, author_id")
    .eq("course_id", courseId)
    .not("sent_at", "is", null);
  const scopeFilters = [
    "and(visible_to_trainee_id.is.null,visible_to_tp_group_id.is.null,visible_to_subgroup_id.is.null)",
    `visible_to_trainee_id.eq.${traineeId}`,
  ];
  if (subgroupTpGroupId) scopeFilters.push(`visible_to_tp_group_id.eq.${subgroupTpGroupId}`);
  if (subgroupMember) scopeFilters.push(`visible_to_subgroup_id.eq.${subgroupMember.subgroup_id}`);
  broadcastsQuery = broadcastsQuery.or(scopeFilters.join(","));
  const { data: broadcasts } = await broadcastsQuery
    .order("pinned", { ascending: false })
    .order("sent_at", { ascending: false })
    .limit(3);

  // for-claude-code-trainee-interface.md: "Author + relative time under
  // each" -- author_id was already being fetched above but never resolved
  // to a name or displayed.
  const authorIds = [...new Set((broadcasts ?? []).map((b) => b.author_id).filter((id): id is string => Boolean(id)))];
  const { data: authors } =
    authorIds.length > 0 ? await supabase.from("profiles").select("id, full_name").in("id", authorIds) : { data: [] };
  const authorNameById = new Map((authors ?? []).map((a) => [a.id, a.full_name]));

  const { data: tutorialInvites } = await supabase
    .from("individual_tutorial_invites")
    .select("id, stage, timetable_event_id, confirmed_at")
    .eq("trainee_id", traineeId)
    .is("confirmed_at", null);
  const tutorialEventIds = (tutorialInvites ?? []).map((i) => i.timetable_event_id);
  const { data: tutorialEvents } =
    tutorialEventIds.length > 0
      ? await supabase.from("course_timetable_events").select("id, event_date, event_time").in("id", tutorialEventIds)
      : { data: [] };
  const tutorialEventById = new Map((tutorialEvents ?? []).map((e) => [e.id, e]));

  // Filmed observation -- group watch session (design_handoff_filmed_
  // observation_watch): reminder surfaces from 10 minutes before the
  // scheduled start, same day only. The recording is persisted, so this
  // never needs to linger past today -- anyone who misses the sitting can
  // reach the same screen from their own portfolio/celta5 page afterward
  // and watch solo, no reminder required to do that.
  const { data: todaysFilmedEvents } = await supabase
    .from("course_timetable_events")
    .select("id, event_date, event_time")
    .eq("course_id", courseId)
    .eq("event_date", today)
    .eq("type", "milestone");
  const todaysFilmedEventIds = (todaysFilmedEvents ?? []).map((e) => e.id);
  const { data: todaysFilmedSessions } =
    todaysFilmedEventIds.length > 0
      ? await supabase
          .from("filmed_observation_sessions")
          .select("id, lesson_title, timetable_event_id")
          .in("timetable_event_id", todaysFilmedEventIds)
      : { data: [] };
  const todaysFilmedEventById = new Map((todaysFilmedEvents ?? []).map((e) => [e.id, e]));
  let filmedObservationReminder: WaitingItem | null = null;
  if (todaysFilmedSessions && todaysFilmedSessions.length > 0) {
    const now = new Date();
    for (const s of todaysFilmedSessions) {
      const event = todaysFilmedEventById.get(s.timetable_event_id);
      if (!event) continue;
      const startsAt = event.event_time ? zonedTimeToUtc(event.event_date, event.event_time, timeZone) : null;
      if (startsAt && now.getTime() < startsAt.getTime() - 10 * 60 * 1000) continue; // more than 10 min out
      const { data: task } = await supabase.from("filmed_observation_tasks").select("id").eq("session_id", s.id).maybeSingle();
      const { data: response } = task
        ? await supabase
            .from("filmed_observation_task_responses")
            .select("completed_at")
            .eq("task_id", task.id)
            .eq("trainee_id", traineeId)
            .maybeSingle()
        : { data: null };
      if (response?.completed_at) continue;
      filmedObservationReminder = {
        label: `Filmed observation${s.lesson_title ? ` — ${s.lesson_title}` : ""}`,
        detail: event.event_time ? `Group watch · ${event.event_time.slice(0, 5)}` : "Group watch, today",
        href: `/portfolio/${traineeId}/filmed-observation/${s.id}`,
      };
      break;
    }
  }

  const { data: unacknowledgedLetters } = await supabase
    .from("formal_letters")
    .select("id, letter_type")
    .eq("trainee_id", traineeId)
    .is("acknowledged_at", null);

  const { data: gtkyAssignment } = await supabase
    .from("gtky_assignments")
    .select("chosen_slug")
    .eq("trainee_id", traineeId)
    .maybeSingle();

  // Ramy, 28 Aug 2026: "three cards will always be there... the information
  // on them will change" -- before the course starts there's no TP to teach,
  // so the hero card carries pre-course-task/scavenger-hunt progress instead,
  // switching to the day-one GTKY pick once the scavenger hunt is fully
  // found. Only queried pre-course -- these tables are irrelevant once the
  // course has actually started.
  const preCourse = course?.start_date ? today < course.start_date : false;
  const [{ data: precourseSections }, { data: precourseProgress }, { data: huntProgress }] = preCourse
    ? await Promise.all([
        supabase.from("pre_course_task_sections").select("id").eq("center_id", centerId),
        supabase.from("pre_course_task_progress").select("section_id, completed_at").eq("trainee_id", traineeId),
        supabase.from("scavenger_hunt_progress").select("question_key").eq("trainee_id", traineeId),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];
  const precourseSectionsTotal = precourseSections?.length ?? 0;
  const precourseSectionsDone = (precourseProgress ?? []).filter((p) => p.completed_at).length;
  const huntFoundCount = (huntProgress ?? []).length;
  const scavengerDone = huntFoundCount >= SCAVENGER_HUNT_QUESTIONS.length;

  const planByTpNumber = new Map((plans ?? []).map((p) => [p.tp_number, p]));
  const tpPlanByTpNumber = new Map((tpPlans ?? []).map((p) => [p.tp_number, p]));
  const selfEvalByTpNumber = new Map((selfEvaluations ?? []).map((s) => [s.tp_number, s]));
  const feedbackByTpNumber = new Map((feedbackRows ?? []).map((f) => [f.tp_number, f]));

  // "You teach today"/"You teach tomorrow" -- reuses the exact same
  // half/date bridge rotation.ts and the trainer-side Teaching Practice
  // queue already trust, scoped to just this one trainee's own subgroup
  // instead of a whole course scan. Pulled into a function of the date so
  // it can answer "today" first and, only if that's empty, "tomorrow" --
  // Ramy, 28 Aug 2026: the hero card should say "you teach tomorrow" on a
  // day the trainee isn't teaching, not disappear.
  type TeachingOn = {
    date: string;
    tpNumber: number;
    title: string;
    teachingOrder: number;
    groupSize: number;
    zoomUrl: string | null;
    eventTime: string | null;
    groupName: string | null;
    joinable: boolean;
    level: string | null;
    volunteers: { expected: number; total: number } | null;
  };
  async function computeTeachingFor(dateIso: string): Promise<TeachingOn | null> {
    if (!subgroupMember) return null;
    const subgroup = subgroupRow;
    const { data: members } = await supabase
      .from("course_subgroup_members")
      .select("trainee_id, base_slot")
      .eq("subgroup_id", subgroupMember.subgroup_id);
    const { data: tpEvents } = await supabase
      .from("course_timetable_events")
      .select("*")
      .eq("course_id", courseId)
      .eq("type", "tp")
      .eq("event_date", dateIso);
    if (!subgroup?.half_order || !tpEvents || tpEvents.length === 0) return null;

    const allTpTimetableEvents: TpTimetableEvent[] = (
      await supabase.from("course_timetable_events").select("event_date").eq("course_id", courseId).eq("type", "tp")
    ).data ?? [];
    const halfDates = halfTpDates(allTpTimetableEvents, subgroup.half_order);
    const tpIndex = halfDates.indexOf(dateIso);
    const tpNumber = tpIndex >= 0 ? tpIndex + 1 : null;
    const plan = tpNumber ? planByTpNumber.get(tpNumber) : null;
    if (!tpNumber || !plan || plan.taught_at || (members ?? []).length === 0) return null;

    const size = (members ?? []).length;
    const order = rotationPosition(subgroupMember.base_slot, size, tpNumber) + 1;
    const event = tpEvents[0];
    // Matches the timetable's own camera-icon/live-now-bar gate
    // (isEventLive: joinable from 10 min before start) -- this card's
    // "Join the room" button used to have no time check at all, unlike
    // those two, so a trainee could join six hours early from here and
    // nowhere else. zonedTimeToUtc/timeZone rather than isEventLive's
    // naive Date() parsing, to match this file's own existing
    // timezone-aware pattern just above (filmedObservationReminder).
    // Only ever true for `today` -- a "tomorrow" lookup can't be joinable yet.
    const startsAt = event.event_time ? zonedTimeToUtc(event.event_date, event.event_time, timeZone) : null;
    const joinable = dateIso === today && startsAt ? Date.now() >= startsAt.getTime() - 10 * 60 * 1000 : false;
    // Spec calls for "which TP, when, where, level, group size, teaching
    // order" -- this app doesn't track a physical room anywhere, and
    // event.title (the old roomOrLevel value, e.g. "TP1 -- Half A") was
    // fetched but never actually rendered, and wouldn't have been
    // meaningful even if it had been (just repeats the TP number already
    // shown). Group name is the one real "where" this schema has.
    const { data: tpGroup } = subgroupTpGroupId
      ? await supabase.from("course_tp_groups").select("name").eq("id", subgroupTpGroupId).maybeSingle()
      : { data: null };
    // Level -- real, available in advance, just a two-hop join: this TP
    // round's own tp_point (if it was assigned from the coursebook
    // generator, not a manual/syllabus-grid override) carries the
    // coursebook it came from, and tp_coursebooks.level is the real CEFR
    // level. Silently omitted (not faked) when tp_point_id is null.
    const { data: tpPoint } = plan.tp_point_id
      ? await supabase.from("tp_points").select("tp_coursebook_id").eq("id", plan.tp_point_id).maybeSingle()
      : { data: null };
    const { data: coursebook } = tpPoint?.tp_coursebook_id
      ? await supabase.from("tp_coursebooks").select("level").eq("id", tpPoint.tp_coursebook_id).maybeSingle()
      : { data: null };
    // Volunteer headcount -- Ramy, 25 Aug 2026: "the trainees also should
    // know... maybe it will show on their TP cards" -- same aggregate
    // already built for the TP detail page (tp/[tpNumber]/page.tsx):
    // every active volunteer_students row for the course counts as
    // "coming" unless they explicitly declined this specific timetable
    // event. Admin client, not the trainee's own -- volunteer_declines has
    // no trainee RLS policy (0143_volunteer_declines.sql), same reason
    // that page already uses one.
    const admin = createAdminClient();
    const { data: courseVolunteers } = await admin.from("volunteer_students").select("id").eq("course_id", courseId).is("removed_at", null);
    const courseVolunteerIds = (courseVolunteers ?? []).map((v) => v.id);
    let volunteers: { expected: number; total: number } | null = null;
    if (courseVolunteerIds.length > 0) {
      const { data: declines } = await admin
        .from("volunteer_declines")
        .select("volunteer_student_id")
        .eq("timetable_event_id", event.id)
        .in("volunteer_student_id", courseVolunteerIds);
      volunteers = { total: courseVolunteerIds.length, expected: courseVolunteerIds.length - (declines?.length ?? 0) };
    }
    return {
      date: dateIso,
      tpNumber,
      title: plan.short_title || plan.main_lesson_aim,
      teachingOrder: order,
      groupSize: size,
      zoomUrl: event.zoom_url,
      eventTime: event.event_time,
      groupName: tpGroup?.name ?? null,
      joinable,
      level: coursebook?.level ?? null,
      volunteers,
    };
  }
  const teachingToday = await computeTeachingFor(today);
  const teachingTomorrow = !preCourse && !teachingToday ? await computeTeachingFor(tomorrow) : null;

  // Waiting on you -- capped at 3, this priority order: pre-course task,
  // scavenger hunt, assignment due, confirm a Stage 1/3 tutorial invite,
  // self-evaluation due, observation hours to log. Tutorial confirmation
  // sits above self-evaluations -- it's a one-time commitment tied to a
  // specific date the tutor is waiting on, not a rolling backlog item like
  // self-evals, so it shouldn't get crowded out by however many TPs happen
  // to be awaiting a self-eval.
  // Ramy, 28 Aug 2026: "the third card is exclusive for things that are
  // waiting on you" -- the pre-course task and scavenger hunt are real
  // to-dos, so they belong here, not on the hero card (that's teaching-only
  // now: today's TP, tomorrow's TP, or the day-one GTKY pick, which is why
  // GTKY itself doesn't get its own item here anymore -- it already has a
  // home on the hero card).
  const waiting: WaitingItem[] = [];
  if (preCourse && precourseSectionsDone < precourseSectionsTotal) {
    waiting.push({
      label: "Finish your pre-course task",
      detail: `${precourseSectionsDone} of ${precourseSectionsTotal} sections done`,
      href: `/portfolio/${traineeId}/pre-course-task`,
    });
  }
  if (preCourse && !scavengerDone) {
    waiting.push({
      label: "Find your way around Connect",
      detail: `${huntFoundCount} of ${SCAVENGER_HUNT_QUESTIONS.length} found`,
      href: `/portfolio/${traineeId}/pre-course-task`,
    });
  }
  for (const a of assignments ?? []) {
    if (a.first_status === "not_submitted" && a.due_date && a.due_date <= today) {
      waiting.push({
        label: `${ASSIGNMENT_INFO[a.assignment_type]?.title ?? a.assignment_type} due`,
        detail: a.due_date,
        href: `/portfolio/${traineeId}/assignments/${a.id}`,
        pill: a.due_date === today ? "Today" : "Overdue",
        pillClass: a.due_date === today ? "pill-warning" : "pill-danger",
        urgent: true,
      });
    }
  }
  if (filmedObservationReminder) waiting.push(filmedObservationReminder);
  for (const letter of unacknowledgedLetters ?? []) {
    waiting.push({
      label: LETTER_LABEL[letter.letter_type] ?? "A formal letter",
      detail: "Please read and acknowledge it",
      href: `/portfolio/${traineeId}/letters/${letter.id}`,
      isLetter: true,
    });
  }
  for (const invite of tutorialInvites ?? []) {
    const event = tutorialEventById.get(invite.timetable_event_id);
    const stageLabel = invite.stage === "stage1" ? "Stage 1" : "Stage 3";
    waiting.push({
      label: `Confirm your ${stageLabel} tutorial`,
      detail: event ? `${event.event_date}${event.event_time ? ` · ${event.event_time.slice(0, 5)}` : ""}` : "Time set by your tutor",
      href: `/portfolio/${traineeId}/individual-tutorial/${invite.id}`,
    });
  }
  for (const [tpNumber, plan] of planByTpNumber) {
    if (!plan.taught_at) continue;
    const status = getTpCardStatus({
      planSubmitted: Boolean(tpPlanByTpNumber.get(tpNumber)?.submitted_at),
      taught: true,
      selfEvalSubmitted: Boolean(selfEvalByTpNumber.get(tpNumber)?.submitted_at),
      feedbackSubmitted: Boolean(feedbackByTpNumber.get(tpNumber)?.submitted_at),
      grade: feedbackByTpNumber.get(tpNumber)?.grade,
    });
    if (status.label === "Self-evaluation due") {
      waiting.push({ label: `TP${tpNumber} self-evaluation`, detail: "Write it before feedback opens", href: `/portfolio/${traineeId}/tp/${tpNumber}` });
    }
  }
  const observedMinutes = (observations ?? []).reduce((sum, o) => sum + (o.length_minutes ?? 0), 0);
  if (observedMinutes / 60 < OBSERVATION_HOURS_REQUIRED) {
    waiting.push({
      label: "Observation hours",
      detail: `${(observedMinutes / 60).toFixed(1)} of ${OBSERVATION_HOURS_REQUIRED} hrs logged`,
      href: `/portfolio/${traineeId}/celta5`,
    });
  }
  // A formal letter is the one item type here with no other route to it
  // anywhere in the trainee UI (no letters archive/nav entry) -- it must
  // never fall off this cap, or it becomes permanently unreachable. Ramy,
  // 28 Aug 2026: "urgent items never get bumped off this list" -- extended
  // the same guarantee to any date-bound urgent item (assignment due
  // today/overdue), not just letters. Guaranteed items always keep a slot;
  // the rest fill whatever remains, in their existing priority order.
  const guaranteedSlots = waiting.filter((w) => w.isLetter || w.urgent).length;
  const otherSlotsRemaining = Math.max(0, 3 - guaranteedSlots);
  let otherSlotsUsed = 0;
  const waitingCapped = waiting.filter((w) => {
    if (w.isLetter || w.urgent) return true;
    if (otherSlotsUsed >= otherSlotsRemaining) return false;
    otherSlotsUsed += 1;
    return true;
  });
  // for-claude-code-trainee-interface.md: "up to 3 items, newest first" --
  // was rendering every broadcast unbounded.
  const broadcastsCapped = (broadcasts ?? []).slice(0, 3);

  // for-claude-code-trainee-assessor-card-system.md's card-edge rule: small
  // cards in a 3-column grid get a left border. Ramy, 28 Aug 2026: "three
  // cards will always be there" -- the grid is permanently 3-column now (see
  // heroKind below), so every card always takes the left variant; there's no
  // more 2-column state that needed the top variant. Full literal class
  // strings (not string-built) so Tailwind's static scanner can see them --
  // a template-built `border-l-${color}` would never be generated.
  // Ramy, 28 Aug 2026, live on the preview: the design file's own default
  // (--trainee-plum) read "a very bright color" against this card's pale
  // background -- rejected in favor of --color-garnet, the same accent
  // already used sitewide (Assignments' second card, Resources' list-item
  // alternation, the trainer-hub ACT color). Not paired back up with teal
  // into the old alternation, though -- one shared garnet, same as plum was
  // one shared color, just a different hue. The hero card keeps its own
  // teal edge -- the file computes that as color-mix(in oklab, teal 55%,
  // transparent), referencing --color-primary, not a flat solid teal.
  const CARD_EDGE: Record<"mauve" | "primary", string> = {
    mauve: "border-l-[3px] border-l-[var(--color-garnet)] border-t-0",
    primary: "border-l-[3px] border-t-0",
  };
  const cardEdge = (color: keyof typeof CARD_EDGE) => CARD_EDGE[color];
  const heroEdgeColor = "color-mix(in oklab, var(--color-primary) 55%, transparent)";

  // Ramy, 28 Aug 2026, correcting an earlier pass: "the hero card is
  // exclusive for teaching" -- not assignments due, not Announcements
  // overflow. Same size/color hero card every day; only its content
  // switches, always about teaching: today's TP, tomorrow's TP, the next
  // upcoming TP further out, or -- once every TP is taught -- a plain
  // "you're done teaching" note. Before the course starts there's no TP
  // yet, so the hero carries the day-one GTKY pick instead ("teaching,
  // unassessed," his words) -- the pre-course task and scavenger hunt are
  // real to-dos, not teaching, so they live on Waiting-on-you instead (see
  // its own comment above).
  // Ramy, 28 Aug 2026: "this is not just a hero card for you teach today,
  // it's a hero card for the next TP... when they click on my plan, it
  // will open the plan for the coming TP." One model, not three -- so this
  // reuses computeTeachingFor itself (same level/volunteers/order/etc. as
  // today and tomorrow get) rather than a separate thin lookup that only
  // knew a TP number and a date.
  async function findNextTeaching(): Promise<TeachingOn | null> {
    if (!subgroupMember || !subgroupRow?.half_order) return null;
    const allTpTimetableEvents: TpTimetableEvent[] = (
      await supabase.from("course_timetable_events").select("event_date").eq("course_id", courseId).eq("type", "tp")
    ).data ?? [];
    const halfDates = halfTpDates(allTpTimetableEvents, subgroupRow.half_order);
    for (let i = 0; i < halfDates.length; i++) {
      if (halfDates[i] <= tomorrow) continue;
      const tpNumber = i + 1;
      const plan = planByTpNumber.get(tpNumber);
      if (plan && !plan.taught_at) return computeTeachingFor(halfDates[i]);
    }
    return null;
  }
  const teachingNext = !preCourse && !teachingToday && !teachingTomorrow ? await findNextTeaching() : null;
  // Ramy, 28 Aug 2026: "this is never gonna be the case because they will
  // always have a TP... if it's the end of the course, why do they still
  // have a lot of things waiting on them?" -- caught a real bug, not a
  // hypothetical: every demo trainee has zero course_subgroup_members rows
  // (the demo course's subgroups/TP groups were never seeded at all), so
  // computeTeachingFor/findNextTeaching always returned null for a reason
  // that has nothing to do with having taught every TP -- there was no
  // schedule to check in the first place. "All your TPs are taught" must
  // only fire when the half schedule was actually found and confirmed
  // exhausted, not whenever the lookup comes back empty for any reason.
  const hasTeachingSchedule = Boolean(subgroupMember && subgroupRow?.half_order);

  type HeroContent = { label: string; big: string; bigSub: string; ctaHref: string; ctaLabel: string };
  const heroKind: "teaching" | "teaching_tomorrow" | "teaching_next" | "teaching_done" | "teaching_unscheduled" | "precourse_gtky" = preCourse
    ? "precourse_gtky"
    : teachingToday
      ? "teaching"
      : teachingTomorrow
        ? "teaching_tomorrow"
        : teachingNext
          ? "teaching_next"
          : hasTeachingSchedule
            ? "teaching_done"
            : "teaching_unscheduled";
  const genericHero: HeroContent | null =
    heroKind === "precourse_gtky"
      ? !gtkyAssignment
        ? {
            label: "Before day one",
            big: "Your day-one activity",
            bigSub: "Ready once your teaching groups are set -- check back closer to the start.",
            ctaHref: `/portfolio/${traineeId}/pre-course-task`,
            ctaLabel: "Pre-course task",
          }
        : !gtkyAssignment.chosen_slug
          ? {
              label: "Before day one",
              big: "Pick your day-one activity",
              bigSub: "Three options, unassessed -- pick one before your first morning.",
              ctaHref: `/portfolio/${traineeId}/gtky`,
              ctaLabel: "Choose your activity",
            }
          : {
              label: "Before day one",
              big: "You're set for day one",
              bigSub: "Your day-one activity is picked -- see you Monday.",
              ctaHref: `/portfolio/${traineeId}/gtky`,
              ctaLabel: "View your pick",
            }
      : heroKind === "teaching_tomorrow" && teachingTomorrow
        ? {
            label: "You teach tomorrow",
            big: `TP${teachingTomorrow.tpNumber} — ${teachingTomorrow.title}`,
            bigSub: [
              teachingTomorrow.eventTime ? teachingTomorrow.eventTime.slice(0, 5) : null,
              teachingTomorrow.level,
              `${teachingTomorrow.teachingOrder === 1 ? "1st" : teachingTomorrow.teachingOrder === 2 ? "2nd" : `${teachingTomorrow.teachingOrder}th`} of ${teachingTomorrow.groupSize} tomorrow`,
              `${TP_LESSON_LENGTH_MINUTES} min`,
              teachingTomorrow.groupName ? `Group ${teachingTomorrow.groupName}` : null,
              teachingTomorrow.volunteers ? `${teachingTomorrow.volunteers.expected} of ${teachingTomorrow.volunteers.total} volunteers coming` : null,
            ]
              .filter(Boolean)
              .join(" · "),
            ctaHref: `/portfolio/${traineeId}/tp/${teachingTomorrow.tpNumber}`,
            ctaLabel: "Open your plan",
          }
        : heroKind === "teaching_next" && teachingNext
          ? {
              // Same "You teach {day}" pattern as today/tomorrow, just with
              // the actual weekday name once it's further out than tomorrow.
              label: `You teach ${new Date(`${teachingNext.date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "long" })}`,
              big: `TP${teachingNext.tpNumber} — ${teachingNext.title}`,
              bigSub: [
                new Date(`${teachingNext.date}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long" }),
                teachingNext.eventTime ? teachingNext.eventTime.slice(0, 5) : null,
                teachingNext.level,
                `${teachingNext.teachingOrder === 1 ? "1st" : teachingNext.teachingOrder === 2 ? "2nd" : `${teachingNext.teachingOrder}th`} of ${teachingNext.groupSize}`,
                `${TP_LESSON_LENGTH_MINUTES} min`,
                teachingNext.groupName ? `Group ${teachingNext.groupName}` : null,
                teachingNext.volunteers ? `${teachingNext.volunteers.expected} of ${teachingNext.volunteers.total} volunteers coming` : null,
              ]
                .filter(Boolean)
                .join(" · "),
              // Ramy, 28 Aug 2026: "when they click on my plan, it will open
              // the plan for the coming TP" -- same direct link as today
              // and tomorrow, not a detour through the timetable page.
              ctaHref: `/portfolio/${traineeId}/tp/${teachingNext.tpNumber}`,
              ctaLabel: "Open your plan",
            }
          : heroKind === "teaching_done"
            ? {
                label: "Teaching practice",
                big: "All your TPs are taught",
                bigSub: "Nothing left to teach -- see My teaching for the full record.",
                ctaHref: `/portfolio/${traineeId}/tp`,
                ctaLabel: "My teaching",
              }
            : heroKind === "teaching_unscheduled"
              ? {
                  label: "Teaching practice",
                  big: "Your teaching schedule isn't set up yet",
                  bigSub: "Nothing to show here until your tutor puts you in a TP group.",
                  ctaHref: `/portfolio/${traineeId}/tp`,
                  ctaLabel: "My teaching",
                }
              : null;

  // Hero card meta + footer, teaching-today only -- the countdown and the
  // "nothing above it until after {time}" note both only make sense for
  // the lesson that's actually happening today, not tomorrow/next.
  const teachingTodayStartsAt =
    teachingToday?.eventTime ? zonedTimeToUtc(today, teachingToday.eventTime, timeZone) : null;
  const teachingTodayMeta = teachingTodayStartsAt ? countdownTo(teachingTodayStartsAt) : null;
  // Real cutoff, not invented: the same day's own "Feedback" session
  // (timetable-skeleton.ts's FEEDBACK_AND_LESSON_PLANNING, title exactly
  // "Feedback", always type supervised_session) -- if today has one, its
  // start time is genuinely when this trainee is free of teaching +
  // feedback. Omitted (not faked) on a day with no Feedback session.
  const { data: todaysFeedbackEvent } = teachingToday
    ? await supabase
        .from("course_timetable_events")
        .select("event_time")
        .eq("course_id", courseId)
        .eq("event_date", today)
        .eq("type", "supervised_session")
        .eq("title", "Feedback")
        .maybeSingle()
    : { data: null };
  const teachingTodayFoot = todaysFeedbackEvent?.event_time
    ? `The one thing that matters this morning, and nothing above it. Everything else here can wait until after ${todaysFeedbackEvent.event_time.slice(0, 5)}.`
    : null;

  const weekOf = course?.start_date && course?.end_date ? computeWeekOf(course.start_date, course.end_date, today) : null;
  const eyebrow = [courseName, weekOf].filter(Boolean).join(" · ");
  // The trainee's name moved to TraineeNameBanner, above the Connect header
  // itself (Ramy, 2026-08-24: "I want this to go on top") -- not repeated
  // here too.
  const todayHeading = new Date(`${today}T00:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">{eyebrow}</p>
          <h1 className="font-serif text-2xl text-ink">{todayHeading}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/portfolio/${traineeId}/timetable`}
            className="trainee-hover-fill inline-flex h-[34px] items-center rounded-[6px] border border-border bg-card px-[14px] text-[13px] font-medium text-ink"
          >
            Timetable
          </Link>
          {teachingToday ? (
            <Link
              href={`/portfolio/${traineeId}/tp/${teachingToday.tpNumber}`}
              className="inline-flex h-[34px] items-center rounded-[6px] bg-primary px-[14px] text-[13px] font-semibold text-primary-foreground"
            >
              Open TP{teachingToday.tpNumber} plan
            </Link>
          ) : null}
        </div>
      </div>

      {/* Ramy, 28 Aug 2026: items-start -- without it, CSS Grid's default
          stretch makes every card in the row match the tallest one, losing
          the reference design's real size progression (short hero card,
          taller announcements, tallest waiting-on-you). Each card should
          size to its own content instead. Grid is permanently 3-column now
          -- "three cards will always be there," never a 2-card fallback.
          Dimensions below (18px grid gap, 16px/18px card padding, 13px
          internal gap, 25px/13px/10.5px type sizes, 34px buttons, the 5px
          gold dot on a primary CTA) are the literal pixel values from
          Trainee Walkthrough.dc.html's own panel template (lines ~83-106),
          not Tailwind's default spacing/type scale -- Ramy, 28 Aug 2026:
          "I'm going to use the exact specs and HTML that you shared with
          me," not an approximation. */}
      <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[1.2fr_1fr_1fr]">
        {heroKind === "teaching" && teachingToday ? (
          <div
            className={`sheet-accent trainee-hover flex flex-col gap-[13px] rounded-[9px] px-[18px] py-4 ${cardEdge("primary")}`}
            style={{ background: "color-mix(in oklab, var(--color-accent) 40%, var(--color-card))", borderLeftColor: heroEdgeColor }}
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[10.5px] font-semibold tracking-[0.12em] text-primary uppercase">You teach today</p>
              {teachingTodayMeta ? <p className="text-[11px] text-muted">{teachingTodayMeta}</p> : null}
            </div>
            <p className="font-serif text-[25px] leading-[1.15] font-semibold text-ink-warm">
              TP{teachingToday.tpNumber} — {teachingToday.title}
            </p>
            {/* Ramy, 28 Aug 2026: level and volunteer headcount are both
                real, checked against the schema -- level via this TP's own
                tp_point -> tp_coursebook, volunteer count via the same
                aggregate already built for the TP detail page (25 Aug:
                "the trainees also should know"). No fabricated student
                count -- that field doesn't exist anywhere before a lesson
                is taught, only tp_lessons.learner_count after the fact. */}
            <p className="text-[13px] leading-[1.5] text-ink-warm">
              {[
                teachingToday.eventTime ? teachingToday.eventTime.slice(0, 5) : null,
                teachingToday.level,
                `${teachingToday.teachingOrder === 1 ? "1st" : teachingToday.teachingOrder === 2 ? "2nd" : `${teachingToday.teachingOrder}th`} of ${teachingToday.groupSize} today`,
                `${TP_LESSON_LENGTH_MINUTES} min`,
                teachingToday.groupName ? `Group ${teachingToday.groupName}` : null,
                teachingToday.volunteers ? `${teachingToday.volunteers.expected} of ${teachingToday.volunteers.total} volunteers coming` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <div className="flex items-center gap-2 pt-[3px]">
              {teachingToday.zoomUrl && teachingToday.joinable ? (
                <a
                  href={teachingToday.zoomUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-[34px] items-center gap-[7px] rounded-[6px] bg-primary px-[14px] text-[13px] font-semibold text-primary-foreground"
                >
                  <span className="size-[5px] shrink-0 rounded-full bg-gold" />
                  Join the room
                </a>
              ) : teachingToday.zoomUrl ? (
                <span
                  title="Opens 10 minutes before the session"
                  aria-disabled="true"
                  className="inline-flex h-[34px] items-center gap-[7px] rounded-[6px] bg-primary/10 px-[14px] text-[13px] font-semibold text-primary/60"
                  style={{ cursor: "default" }}
                >
                  <span className="size-[5px] shrink-0 rounded-full bg-gold/60" />
                  Join the room
                </span>
              ) : null}
              <Link
                href={`/portfolio/${traineeId}/tp/${teachingToday.tpNumber}`}
                className="inline-flex h-[34px] items-center rounded-[6px] border border-border bg-card px-[13px] text-[13px] font-medium text-ink"
              >
                Open your plan
              </Link>
            </div>
            {teachingTodayFoot ? <p className="text-[13px] leading-[1.5] text-muted">{teachingTodayFoot}</p> : null}
          </div>
        ) : genericHero ? (
          <div
            className={`sheet-accent trainee-hover flex flex-col gap-[13px] rounded-[9px] px-[18px] py-4 ${cardEdge("primary")}`}
            style={{ background: "color-mix(in oklab, var(--color-accent) 40%, var(--color-card))", borderLeftColor: heroEdgeColor }}
          >
            <p className="text-[10.5px] font-semibold tracking-[0.12em] text-primary uppercase">{genericHero.label}</p>
            <p className="font-serif text-[25px] leading-[1.15] font-semibold text-ink-warm">{genericHero.big}</p>
            <p className="text-[13px] leading-[1.5] text-ink-warm">{genericHero.bigSub}</p>
            <div className="flex items-center gap-2 pt-[3px]">
              <Link
                href={genericHero.ctaHref}
                className="inline-flex h-[34px] items-center gap-[7px] rounded-[6px] bg-primary px-[14px] text-[13px] font-semibold text-primary-foreground"
              >
                <span className="size-[5px] shrink-0 rounded-full bg-gold" />
                {genericHero.ctaLabel}
              </Link>
            </div>
          </div>
        ) : null}

        {/* Announcements -- shared mauve default (no accent of its own),
            same as Waiting-on-you beside it. Edge side (left vs top)
            follows cardEdge -- see its own comment above. */}
        <div className={`sheet flex flex-col gap-3 rounded-[9px] ${cardEdge("mauve")}`}>
          <p className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">
            Announcements{broadcastsCapped.length > 0 ? ` · ${broadcastsCapped.length}` : ""}
          </p>
          {broadcastsCapped.length === 0 ? (
            <p className="text-sm text-muted">Nothing posted yet.</p>
          ) : (
            <div className="flex flex-col">
              {broadcastsCapped.map((b, i) => (
                <div key={b.id} className={`flex flex-col gap-1 py-2.5 ${i > 0 ? "border-t border-border-faint" : ""} ${b.pinned ? "border-l-2 border-status-warning-text pl-2.5" : ""}`}>
                  <p className={`text-sm ${b.pinned ? "font-bold text-ink" : "font-semibold text-ink"}`}>{b.title}</p>
                  {b.body ? (
                    <div className="flex flex-col gap-2 text-sm whitespace-pre-line text-ink">{b.body}</div>
                  ) : null}
                  <p className="text-xs text-muted">
                    {b.author_id ? (authorNameById.get(b.author_id) ?? "Your tutor") : "Your tutor"} · {relativeTime(b.created_at)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Waiting on you -- shared mauve default, same as Announcements
            beside it. */}
        <div className={`sheet flex flex-col gap-3 rounded-[9px] ${cardEdge("mauve")}`}>
          <p className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">
            Waiting on you{waiting.length > 0 ? ` · ${waiting.length}` : ""}
          </p>
          {waitingCapped.length === 0 ? (
            <p className="text-sm text-muted">Well done — you're all caught up.</p>
          ) : (
            <div className="flex flex-col">
              {waitingCapped.map((w, i) => (
                <Link key={i} href={w.href} className={`trainee-hover -mx-2 flex flex-col gap-0.5 rounded-[6px] px-2 py-2.5 ${i > 0 ? "border-t border-border-faint" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-ink">{w.label}</p>
                    {w.pill ? <span className={`pill shrink-0 ${w.pillClass ?? "pill-warning"}`}>{w.pill}</span> : null}
                  </div>
                  <p className="text-xs text-muted">{w.detail}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
