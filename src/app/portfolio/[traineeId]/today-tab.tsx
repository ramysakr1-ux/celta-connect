import Link from "next/link";
import { responseIsAnswered } from "@/lib/pre-course-task-shape";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { toLocalIso, zonedTimeToUtc } from "@/lib/timetable-grid";
import { computeWeekOf } from "@/lib/course-progress";
import { rotationPosition, halfTpDates, type TpTimetableEvent } from "@/lib/rotation";
import { getTpCardStatus } from "@/lib/tp-plan-content";
import { ASSIGNMENT_INFO } from "@/lib/assignment-info";
import { AssessorMeetingCard } from "./assessor-meeting-card";
import { SCAVENGER_HUNT_QUESTIONS } from "@/lib/scavenger-hunt";
import { getTraineeStreamDay } from "@/lib/trainee-day";
import { StreamEyebrow, StreamDayTrack } from "@/app/portfolio/[traineeId]/course-stream-day";

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
  /** What sort of thing this is, which is what the Catch up badge colours by:
   *  garnet for something overdue, teal for an action someone is waiting on,
   *  gold for a figure that is simply progressing. They were all one colour
   *  until 9 Sep 2026, which made the list read as uniformly urgent. */
  kind?: "overdue" | "scheduled" | "progress" | "assignment";
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
  viewerIsCandidate = false,
}: {
  supabase: SupabaseClient<Database>;
  traineeId: string;
  courseId: string;
  centerId: string;
  courseName: string | null;
  timeZone: string;
  /** True only when the person viewing is this candidate, so the "ask to speak
   *  with the assessor" control shows for them and not a staff preview. */
  viewerIsCandidate?: boolean;
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
    // time_bands: the course's real daily structure, which is what gives the
    // Course Stream day track its window and every session its end -- events
    // carry a start time and nothing else.
    supabase.from("courses").select("start_date, end_date, time_bands, assessor_visit_date").eq("id", courseId).maybeSingle(),
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

  // §14.2: the candidate's own control to ask for a private word with the
  // assessor. Shown only to the candidate (not a staff preview) and only for
  // an upcoming visit; the assessor sees only an anonymised count of how many
  // have asked. This card used to live on the full portfolio page, gated on a
  // condition only a candidate met -- but a candidate now lands on this Today
  // tab instead, so the control had become unreachable (11 Sep 2026).
  const assessorVisitIso = course?.assessor_visit_date ?? null;
  const showAssessorMeeting = viewerIsCandidate && Boolean(assessorVisitIso) && (assessorVisitIso as string) >= today;
  const { data: ownMeetingRequest } = showAssessorMeeting
    ? await supabase
        .from("assessor_meeting_requests")
        .select("id")
        .eq("trainee_id", traineeId)
        .is("withdrawn_at", null)
        .maybeSingle()
    : { data: null };

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
  // The other end of the course, which nothing had ever drawn. After the last
  // day the landing fell through to whatever the teaching branches happened to
  // say -- "All your TPs are taught", a day track reading "Nothing timetabled
  // for you today", a header still counting "Day 20 of 20". A finished course
  // rendered as a quiet Thursday, and that is the last thing Connect ever says
  // to a trainee. Found 10 Sep 2026 at --stage finished.
  const postCourse = course?.end_date ? today > course.end_date : false;
  // Ramy, 28 Aug 2026: counts tasks actually answered, not sections
  // self-ticked -- the task is answered inside Connect now, and the hero
  // card, the Resource Hub door and the roster all have to say the same
  // number. responseIsAnswered is the one shared definition.
  const [{ data: precourseSections }, { data: precourseResponses }, { data: huntProgress }] = preCourse
    ? await Promise.all([
        supabase.from("pre_course_task_sections").select("id").eq("center_id", centerId),
        supabase.from("pre_course_task_responses").select("item_id, response").eq("trainee_id", traineeId),
        supabase.from("scavenger_hunt_progress").select("question_key").eq("trainee_id", traineeId),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];
  const { data: precourseItems } =
    preCourse && (precourseSections ?? []).length > 0
      ? await supabase
          .from("pre_course_task_items")
          .select("id")
          .in(
            "section_id",
            (precourseSections ?? []).map((s) => s.id)
          )
      : { data: [] };
  const precourseSectionsTotal = precourseItems?.length ?? 0;
  const precourseSectionsDone = (precourseResponses ?? []).filter((r) => responseIsAnswered(r.response)).length;
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
    /** The timetable row itself -- Course Stream's day track needs to know
     *  which block on the day is this trainee's own, to give it the gold. */
    eventId: string;
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
    // A TP day runs one slot per trainee in the subgroup -- "TP8 · A", "TP8 · B",
    // "TP8 · C" -- and `order` is which of them is this trainee's. This used to
    // take tpEvents[0] unconditionally, so every trainee teaching that day was
    // told they taught in the FIRST slot: the right lesson, the wrong hour, for
    // everyone but whoever happened to be going first.
    //
    // It went unnoticed while the hero only printed a time. Course Stream's day
    // track puts a gold block on the lesson, so a wrong slot is now a wrong
    // block on the wrong part of the day, which is unmissable.
    //
    // Sorted by time, because the query does not order and PostgREST gives no
    // guarantee -- the slot order IS the clock order.
    const orderedTpEvents = [...tpEvents].sort((a, b) => (a.event_time ?? "").localeCompare(b.event_time ?? ""));
    const event = orderedTpEvents[order - 1] ?? orderedTpEvents[0];
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
      eventId: event.id,
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
      detail: `${precourseSectionsDone} of ${precourseSectionsTotal} tasks answered`,
      href: `/portfolio/${traineeId}/pre-course-task`,
    });
  }
  if (preCourse && !scavengerDone) {
    waiting.push({
      label: "Find your way around Connect",
      kind: "progress",
      detail: `${huntFoundCount} of ${SCAVENGER_HUNT_QUESTIONS.length} found`,
      href: `/portfolio/${traineeId}/pre-course-task`,
    });
  }
  for (const a of assignments ?? []) {
    if (a.first_status === "not_submitted" && a.due_date && a.due_date <= today) {
      waiting.push({
        // Ramy, 10 Sep 2026: "the assignments avatar will be garnet and the
        // assignment itself -- LRT or FOL -- will be written in the same
        // colour. Just let it pop a little bit. It's too bland."
        label: `${ASSIGNMENT_INFO[a.assignment_type]?.title ?? a.assignment_type} due`,
        kind: "assignment",
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
      kind: "scheduled",
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
      kind: "progress",
      detail: `${(observedMinutes / 60).toFixed(1)} of ${OBSERVATION_HOURS_REQUIRED} hrs logged`,
      href: `/portfolio/${traineeId}/celta5`,
    });
  }
  // design_handoff_trainee_landing: "Catch up is never truncated. If nothing
  // is outstanding, drop the column rather than showing an empty state." The
  // old three-slot cap -- and the letter/urgent guarantee that existed only to
  // survive it -- go with it. Nothing can be crowded off a list with no lid.
  const broadcastsCapped = (broadcasts ?? []).slice(0, 3);


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
  // Fetched at most once, and only inside the branch that needs it: the "next
  // TP" walk and the "which TPs never got recorded" check read the same list,
  // and they must read the same list -- two answers about the same schedule
  // from two queries is exactly how the hero and the rail ended up
  // contradicting each other.
  let halfDatesCache: string[] | null = null;
  async function getHalfDates(): Promise<string[]> {
    if (halfDatesCache) return halfDatesCache;
    if (!subgroupMember || !subgroupRow?.half_order) return (halfDatesCache = []);
    const allTpTimetableEvents: TpTimetableEvent[] = (
      await supabase.from("course_timetable_events").select("event_date").eq("course_id", courseId).eq("type", "tp")
    ).data ?? [];
    return (halfDatesCache = halfTpDates(allTpTimetableEvents, subgroupRow.half_order));
  }

  async function findNextTeaching(): Promise<TeachingOn | null> {
    if (!subgroupMember || !subgroupRow?.half_order) return null;
    const halfDates = await getHalfDates();
    for (let i = 0; i < halfDates.length; i++) {
      if (halfDates[i] <= tomorrow) continue;
      const tpNumber = i + 1;
      const plan = planByTpNumber.get(tpNumber);
      if (plan && !plan.taught_at) return computeTeachingFor(halfDates[i]);
    }
    return null;
  }
  const teachingNext = !preCourse && !teachingToday && !teachingTomorrow ? await findNextTeaching() : null;

  // A TP whose day has gone by with taught_at still null.
  //
  // taught_at is not a date -- it is written when the TRAINER logs the lesson
  // outcome (dashboard/trainer/actions.ts), so on every real course there is a
  // gap between the lesson happening and it being recorded, sometimes days
  // long. findNextTeaching only looks forward (`halfDates[i] <= tomorrow` is
  // skipped), so for the whole of that gap the TP was invisible to the hero and
  // the hero fell through to "All your TPs are taught" -- which was flatly
  // untrue, and sat on the same screen as a rail saying "TP7 plan", telling
  // them to go and prepare a lesson they had already given. Ramy caught the
  // pair of them on production, 10 Sep 2026.
  //
  // Neither statement is the right one. The truth is that the record is open,
  // so that is what the screen says now.
  const unrecordedTps =
    !preCourse && !teachingToday && !teachingTomorrow && !teachingNext
      ? (await getHalfDates()).reduce<number[]>((acc, date, i) => {
          const plan = planByTpNumber.get(i + 1);
          if (date < today && plan && !plan.taught_at) acc.push(i + 1);
          return acc;
        }, [])
      : [];
  const unrecordedLabel =
    unrecordedTps.length === 0
      ? null
      : unrecordedTps.length === 1
        ? `TP${unrecordedTps[0]}`
        : `${unrecordedTps.slice(0, -1).map((n) => `TP${n}`).join(", ")} and TP${unrecordedTps[unrecordedTps.length - 1]}`;
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
  const heroKind:
    | "teaching"
    | "teaching_tomorrow"
    | "teaching_next"
    | "teaching_unrecorded"
    | "teaching_done"
    | "teaching_unscheduled"
    | "course_finished"
    | "precourse_gtky" = postCourse
    ? "course_finished"
    : preCourse
    ? "precourse_gtky"
    : teachingToday
      ? "teaching"
      : teachingTomorrow
        ? "teaching_tomorrow"
        : teachingNext
          ? "teaching_next"
          : unrecordedLabel
            ? "teaching_unrecorded"
            : hasTeachingSchedule
              ? "teaching_done"
              : "teaching_unscheduled";
  const genericHero: HeroContent | null =
    heroKind === "course_finished"
      ? {
          label: "Course complete",
          big: "That's your course finished",
          // Deliberately says nothing about the outcome. A trainee never sees
          // their grade in Connect -- it is Cambridge's to give, after the
          // assessor and the awarding process -- so a landing that implied one
          // either way would be inventing news. What it CAN do is point at the
          // record they own and tell them where the result actually comes from.
          bigSub: "Your record stays here. Your result comes from Cambridge through your centre.",
          ctaHref: `/portfolio/${traineeId}/celta5`,
          ctaLabel: "Your record",
        }
      : heroKind === "precourse_gtky"
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
          : heroKind === "teaching_unrecorded" && unrecordedLabel
            ? {
                label: "Teaching practice",
                big: `${unrecordedLabel} ${unrecordedTps.length === 1 ? "isn't" : "aren't"} recorded yet`,
                // Deliberately not "nothing for you to do": most of the time
                // the tutor simply hasn't written it up, but a deferred or
                // missed lesson looks identical from here, and this screen
                // cannot tell the two apart. So it says who writes it and what
                // to do if it stays open, and claims nothing else.
                bigSub: "Your tutor logs the outcome after the lesson -- ask them if it stays open.",
                ctaHref: `/portfolio/${traineeId}/tp`,
                ctaLabel: "My teaching",
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

  const weekOf = course?.start_date && course?.end_date ? computeWeekOf(course.start_date, course.end_date, today) : null;
  const eyebrow = [courseName, weekOf].filter(Boolean).join(" · ");
  // The trainee's name moved to TraineeNameBanner, above the Connect header
  // itself (Ramy, 2026-08-24: "I want this to go on top") -- not repeated
  // here too.
  const todayHeading = new Date(`${today}T00:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  // ---------------------------------------------------------------- 4b ----
  // design_handoff_trainee_landing, "Course Stream (Status rail, option 4b)".
  // The screen answers two questions and nothing else: what is happening
  // today, and what do I owe. No course history -- no TP grade list, no
  // assignment ledger -- those live behind their own doors.
  const { data: traineeProfile } = await supabase.from("profiles").select("full_name").eq("id", traineeId).maybeSingle();
  const firstName = (traineeProfile?.full_name ?? "").trim().split(/\s+/)[0] || "there";

  const { data: todaysEvents } = await supabase
    .from("course_timetable_events")
    .select("*")
    .eq("course_id", courseId)
    .eq("event_date", today);

  // The same object the header's day bar renders from -- getTraineeStreamDay is
  // cache()d per request, so this is one set of queries and one answer, which
  // is what §1b means by "never a second source".
  const streamDay = await getTraineeStreamDay(supabase, traineeId, courseId, today, timeZone);

  // Unread notices (migration 0283). The read rows are RLS-scoped to the
  // reader, so a peer viewing a groupmate's portfolio under layout.tsx's
  // observation carve-out sees no read state and, more importantly, marks
  // nothing on their behalf -- the insert simply fails the policy.
  const broadcastIds = broadcastsCapped.map((b) => b.id);
  const { data: readRows } =
    broadcastIds.length > 0
      ? await supabase
          .from("course_broadcast_reads")
          .select("broadcast_id")
          .eq("trainee_id", traineeId)
          .in("broadcast_id", broadcastIds)
      : { data: [] };
  const readIds = new Set((readRows ?? []).map((r) => r.broadcast_id));
  const unreadIds = broadcastIds.filter((id) => !readIds.has(id));
  if (unreadIds.length > 0) {
    // Marked on the render that shows them: this pass still draws them bold,
    // the next one doesn't. Same shape as markScavengerHuntFound's own
    // read-side write in page.tsx.
    await supabase
      .from("course_broadcast_reads")
      .upsert(unreadIds.map((id) => ({ broadcast_id: id, trainee_id: traineeId })), { ignoreDuplicates: true });
  }

  const serverNowMs = Date.now();
  const dateLabel = new Date(`${today}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // The handoff's hero has two states, teaching and observing. This app has
  // six -- pre-course, tomorrow, further out, all taught, no group yet -- and
  // genericHero already carries the copy for every one of them. So the hero
  // takes the handoff's SHAPE and keeps the app's states, rather than losing
  // four of them to match a prototype that never had to render them.
  const teachTime = teachingToday?.eventTime ? teachingToday.eventTime.slice(0, 5) : null;
  const heroTitle = teachingToday
    ? `You teach${teachTime ? ` at ${teachTime}` : " today"} — ${teachingToday.title}`
    : (genericHero?.big ?? "Your day");
  const heroPrimary = teachingToday
    ? teachingToday.joinable && teachingToday.zoomUrl
      ? { href: teachingToday.zoomUrl, label: "Join the room", external: true }
      : { href: `/portfolio/${traineeId}/tp/${teachingToday.tpNumber}`, label: "Open your plan", external: false }
    : genericHero
      ? { href: genericHero.ctaHref, label: genericHero.ctaLabel, external: false }
      : null;
  // design_handoff_trainee_landing pairs a primary with a real second action --
  // "Join the room" / "Open your plan" -- not a standing Timetable link, which
  // the design does not have and which the rail already reaches. Timetable is
  // the fallback only when there is no second action worth offering.
  const heroSecondary = teachingToday
    ? teachingToday.joinable && teachingToday.zoomUrl
      ? { href: `/portfolio/${traineeId}/tp/${teachingToday.tpNumber}`, label: "Open your plan" }
      : { href: `/portfolio/${traineeId}/timetable`, label: "Timetable" }
    : { href: `/portfolio/${traineeId}/timetable`, label: "Timetable" };
  // The line to the right of "Your day" answers one question -- am I teaching
  // today -- so it takes the hero's label only where that label happens to
  // answer it ("You teach tomorrow", "You teach Friday"). It used to take it
  // unconditionally, which is how the day's status line came to read
  // "Teaching practice", a heading with nothing in it about today.
  const metaLead = teachingToday
    ? `You teach${teachTime ? ` ${teachTime}` : ""}`
    : heroKind === "teaching_tomorrow" || heroKind === "teaching_next"
      ? (genericHero?.label ?? "Today")
      : heroKind === "precourse_gtky"
        ? "Before day one"
        : heroKind === "course_finished"
          ? "Course finished"
          : "Not teaching today";

  return (
    <div className="flex flex-col gap-5">
      {/* The headline and the buttons only sit side by side once there is room
          for both. On a 375px phone this row gave the h1 42 pixels of width and
          200 of height -- one word per line -- because the buttons kept their
          half of it. Below lg they stack and the headline gets the page --
          lg rather than sm because the workspace rail returns at md, which is
          where the headline's share of the row gets tight again. */}
      <div className="flex flex-col items-start gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-5">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <StreamEyebrow firstName={firstName} dateLabel={dateLabel} serverNowMs={serverNowMs} timeZone={timeZone} />
          <h1 className="font-serif text-[26px] leading-tight text-ink lg:text-[32px]">{heroTitle}</h1>
          {!teachingToday && genericHero?.bigSub ? (
            <p className="text-[13px] text-muted">{genericHero.bigSub}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          {heroPrimary ? (
            heroPrimary.external ? (
              <a
                href={heroPrimary.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-[38px] items-center gap-[7px] rounded-[6px] bg-primary px-[15px] text-[13px] font-semibold text-primary-foreground"
              >
                <span aria-hidden className="size-[5px] rounded-full bg-gold" />
                {heroPrimary.label}
              </a>
            ) : (
              <Link
                href={heroPrimary.href}
                className="inline-flex h-[38px] items-center gap-[7px] rounded-[6px] bg-primary px-[15px] text-[13px] font-semibold text-primary-foreground"
              >
                <span aria-hidden className="size-[5px] rounded-full bg-gold" />
                {heroPrimary.label}
              </Link>
            )
          ) : null}
          {heroSecondary ? (
            <Link
              href={heroSecondary.href}
              className="trainee-hover-fill inline-flex h-[38px] items-center rounded-[6px] border border-border bg-card px-[14px] text-[13px] font-medium text-ink"
            >
              {heroSecondary.label}
            </Link>
          ) : null}
        </div>
      </div>

      <StreamDayTrack
        day={streamDay}
        serverNowMs={serverNowMs}
        timeZone={timeZone}
        meta={{ lead: metaLead, countdownFor: teachingToday ? "mine" : null }}
      />

      {/* Two columns, and a column with nothing in it is dropped rather than
          rendered as an empty state -- the handoff is explicit about that. */}
      <div className="grid items-start gap-[26px] md:grid-cols-[1.4fr_1fr]">
        {waiting.length > 0 ? (
          <section className="flex flex-col">
            <div className="mb-1 flex items-baseline gap-2.5">
              <h2 className="font-serif text-[21px] font-semibold text-ink-warm">Catch up</h2>
              <span className="text-[12.5px] text-muted">{waiting.length} · all shown</span>
            </div>
            {waiting.map((w, i) => {
              const overdue = w.pill === "Overdue" || w.pill === "Today";
              const garnet = overdue || w.isLetter || w.kind === "assignment";
              return (
                <Link
                  key={`${w.href}-${i}`}
                  href={w.href}
                  className="trainee-hover-ring grid grid-cols-[38px_1fr_auto] items-center gap-[13px] border-t border-border py-[11px]"
                >
                  <span
                    aria-hidden
                    className={`grid size-[38px] shrink-0 place-items-center rounded-[10px] text-[11.5px] font-bold ${
                      garnet
                        ? "bg-garnet text-primary-foreground"
                        : w.kind === "progress"
                          ? "bg-gold text-ink"
                          : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {initialsFor(w.label)}
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-[14px] font-semibold ${garnet ? "text-garnet" : "text-ink"}`}>{w.label}</span>
                    <span className="block text-[12.5px] text-muted">{w.detail}</span>
                  </span>
                  <span className={`text-[12px] ${overdue ? "font-bold text-garnet" : "font-semibold text-muted"}`}>
                    {w.pill ?? ""}
                  </span>
                </Link>
              );
            })}
          </section>
        ) : null}

        {showAssessorMeeting && assessorVisitIso ? (
          <AssessorMeetingCard
            traineeId={traineeId}
            visitDate={new Date(`${assessorVisitIso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}
            alreadyRequested={Boolean(ownMeetingRequest)}
          />
        ) : null}

        {broadcastsCapped.length > 0 ? (
          <section className="flex flex-col">
            <div className="mb-1 flex items-baseline gap-2.5">
              <h2 className="font-serif text-[21px] font-semibold text-ink-warm">From your tutors</h2>
              <span className="text-[12.5px] text-muted">{broadcastsCapped.length}</span>
            </div>
            {broadcastsCapped.map((b) => {
              const unread = !readIds.has(b.id);
              return (
                <div key={b.id} className="border-t border-border py-[11px]">
                  <p className={`flex items-center gap-[7px] text-[14px] ${unread ? "font-bold" : "font-semibold"} text-ink`}>
                    {unread ? <span aria-hidden className="size-[5px] shrink-0 rounded-full bg-gold" /> : null}
                    {b.title}
                  </p>
                  {unread && b.body ? <p className="mt-[3px] text-[12.5px] leading-relaxed text-ink">{b.body}</p> : null}
                  <p className="mt-[3px] text-[12px] text-muted">
                    {authorNameById.get(b.author_id ?? "") ?? "Your tutor"} · {relativeTime(b.created_at)}
                  </p>
                </div>
              );
            })}
          </section>
        ) : null}
      </div>
    </div>
  );
}

/** The badge on a Catch up row. Two letters off the item, so "Assignment 3 ·
 *  Language skills" reads A3 and "Observation hours" reads OH -- the handoff's
 *  own examples, derived rather than hand-listed so a new kind of item can
 *  never turn up with a blank badge. */
function initialsFor(label: string): string {
  const digits = label.match(/\d+/);
  const first = label.trim()[0]?.toUpperCase() ?? "?";
  if (digits) return `${first}${digits[0]}`;
  const words = label.trim().split(/\s+/);
  return (first + (words[1]?.[0] ?? "")).toUpperCase();
}
