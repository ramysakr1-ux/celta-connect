import Link from "next/link";
import { responseIsAnswered } from "@/lib/pre-course-task-shape";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { toLocalIso, zonedTimeToUtc } from "@/lib/timetable-grid";
import { formatCalendarDate } from "@/lib/format-date";
import { computeWeekOf } from "@/lib/course-progress";
import { rotationPosition, halfTpDates, type TpTimetableEvent } from "@/lib/rotation";
import { AssessorMeetingCard } from "./assessor-meeting-card";
import { SCAVENGER_HUNT_QUESTIONS } from "@/lib/scavenger-hunt";
import { getTraineeStreamDayOrNext } from "@/lib/trainee-day";
import { StreamEyebrow, StreamDayTrack } from "@/app/portfolio/[traineeId]/course-stream-day";
import { StreamHero } from "@/app/portfolio/[traineeId]/stream-hero";
import { buildHeroState, type TeachingOn } from "@/app/portfolio/[traineeId]/stream-hero-state";
import { buildWaitingList, type WaitingItem } from "@/app/portfolio/[traineeId]/waiting-list";
import { classLessons, levelKey } from "@/lib/volunteer-class-session";
import { demoToday, demoNow } from "@/lib/demo-clock";


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
  const today = await demoToday(timeZone);
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
    //
    // Ramy's two-group model (11 Sep 2026) put six lessons on a TP day, two
    // groups at two levels, so this list held each slot TWICE and position 2
    // landed on the other group's copy of slot 1 -- the right lesson, the
    // wrong hour again, for everyone but whoever taught first. Narrowed to
    // the candidate's own group before ordering (walked 14 Sep 2026); a TP
    // row that names no group is left in, for a course with one group.
    const myGroupId = subgroup?.tp_group_id ?? null;
    const ownGroupEvents = myGroupId
      ? tpEvents.filter((e) => !e.tp_group_scope_id || e.tp_group_scope_id === myGroupId)
      : tpEvents;
    const orderedTpEvents = [...ownGroupEvents].sort((a, b) => (a.event_time ?? "").localeCompare(b.event_time ?? ""));
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
    // know... maybe it will show on their TP cards".
    //
    // Three things were wrong with it (walked 15 Sep 2026):
    //
    //   - It counted every volunteer on the COURSE. Two levels run at the
    //     same hours, so a candidate teaching B1+ was told "2 of 2
    //     volunteers coming" when one of the two attends the A2 class and
    //     will never be in their room.
    //   - Silence counted as yes. Everyone was "coming" unless they had
    //     declined, so a class nobody had answered for read as full.
    //   - It checked declines against THIS lesson only, while a volunteer
    //     replies once for the class-day, against its first lesson -- so a
    //     decline at 10:00 still read as coming at 11:45.
    //
    // Admin client, not the trainee's own -- volunteer_declines has no
    // trainee RLS policy (0143_volunteer_declines.sql).
    const admin = createAdminClient();
    const { data: courseVolunteers } = await admin
      .from("volunteer_students")
      .select("id, level")
      .eq("course_id", courseId)
      .is("removed_at", null);
    // The level off the candidate's OWN timetable row, with the coursebook
    // as the fallback. tp_coursebooks.level is only set where the round was
    // assigned from the library, and where it is not the filter below did
    // nothing -- the demo course's TP6 read "2 volunteers" for a class that
    // has one.
    const myLevel = levelKey((event as { detail?: string | null }).detail ?? coursebook?.level ?? null);
    const classVolunteers = (courseVolunteers ?? []).filter((v) => {
      const theirs = levelKey(v.level);
      return !myLevel || !theirs || theirs === myLevel;
    });
    const courseVolunteerIds = classVolunteers.map((v) => v.id);
    let volunteers: { expected: number; total: number } | null = null;
    if (courseVolunteerIds.length > 0) {
      // Every lesson of that class that day: the reply is one reply for the
      // class, left against whichever lesson the email linked to.
      const { data: dayEvents } = await admin
        .from("course_timetable_events")
        .select("id, detail")
        .eq("course_id", courseId)
        .eq("type", "tp")
        .eq("event_date", dateIso);
      const dayIds = classLessons(dayEvents ?? [], (event as { detail?: string | null }).detail ?? coursebook?.level ?? null).map((e) => e.id);
      const [{ data: declines }, { data: confirmations }] = await Promise.all([
        admin.from("volunteer_declines").select("volunteer_student_id").in("timetable_event_id", dayIds).in("volunteer_student_id", courseVolunteerIds),
        admin.from("volunteer_confirmations").select("volunteer_student_id").in("timetable_event_id", dayIds).in("volunteer_student_id", courseVolunteerIds),
      ]);
      const said = new Set((declines ?? []).map((d) => d.volunteer_student_id));
      const coming = new Set(
        (confirmations ?? []).map((c) => c.volunteer_student_id).filter((id) => !said.has(id))
      );
      volunteers = { total: courseVolunteerIds.length, expected: coming.size };
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
  // The list, its order and the reasons for that order live in
  // waiting-list.ts (trainee spec C4).
  const waiting = buildWaitingList({
    traineeId,
    today,
    preCourse,
    precourseSectionsDone,
    precourseSectionsTotal,
    scavengerDone,
    huntFoundCount,
    assignments,
    filmedObservationReminder,
    unacknowledgedLetters,
    tutorialInvites,
    tutorialEventById,
    planByTpNumber,
    tpPlanByTpNumber,
    selfEvalByTpNumber,
    feedbackByTpNumber,
    observations,
  });
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
  // The eight-state hero ladder and its copy live in stream-hero-state.ts
  // (trainee spec C4).
  const { kind: heroKind, generic: genericHero } = buildHeroState({
    traineeId,
    preCourse,
    postCourse,
    teachingToday,
    teachingTomorrow,
    teachingNext,
    unrecordedLabel,
    unrecordedTps,
    hasTeachingSchedule: Boolean(subgroupMember && subgroupRow?.half_order),
    gtkyAssignment,
  });

  const weekOf = course?.start_date && course?.end_date ? computeWeekOf(course.start_date, course.end_date, today) : null;
  const eyebrow = [courseName, weekOf].filter(Boolean).join(" · ");
  // The trainee's name moved to TraineeNameBanner, above the Connect header
  // itself (Ramy, 2026-08-24: "I want this to go on top") -- not repeated
  // here too.
  const todayHeading = formatCalendarDate(today, { weekday: "long", day: "numeric", month: "long" });

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
  // Ramy, 12 Sep 2026, logged in as a candidate on a Saturday: "it says
  // nothing timetabled for you today. How is that possible? There's always
  // something to do." A day with nothing on is a weekend or a gap, not the
  // end of the course -- so the section shows the next timetabled day
  // instead, named as such, with the same boxes it will show on the morning,
  // and the marker parked at its start. Same answer as the header's bar.
  const streamView = await getTraineeStreamDayOrNext(supabase, traineeId, courseId, today, timeZone);
  const streamDay = streamView.day;
  const streamHeading = streamView.isToday
    ? "Your day"
    : `Your next day · ${formatCalendarDate(streamView.dateIso, { weekday: "long", day: "numeric", month: "long" })}`;

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

  const serverNowMs = (await demoNow(timeZone)).getTime();
  const dateLabel = formatCalendarDate(today, {
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
  // "Tomorrow · 09:30" / "Friday · 09:30" -- the time column a lesson that is
  // not today still gets (Part 5), from whichever future teaching day the
  // hero is actually about.
  const laterTeaching = teachingTomorrow ?? teachingNext;
  const heroLaterTime =
    !teachingToday && laterTeaching?.eventTime
      ? {
          at: laterTeaching.eventTime.slice(0, 5),
          when:
            heroKind === "teaching_tomorrow"
              ? "Tomorrow"
              : new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "long" }).format(
                  new Date(`${laterTeaching.date}T12:00:00Z`)
                ),
        }
      : null;

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
      {/* Course Stream's hero is the glass tile now (trainee spec B4 and
          Part 5): the one thing on the page that IS today's lesson used to
          be the only thing on it not wearing the timetable's glass. The
          eyebrow stays above it, as the spec asks. */}
      <StreamEyebrow firstName={firstName} dateLabel={dateLabel} serverNowMs={serverNowMs} timeZone={timeZone} />
      {/* Trainee spec C5: the landing's panels rise in on first paint, in the
          motion rule's own stagger (0 / 60 / 80 / 140ms). Nothing else on the
          candidate side animates on arrival. */}
      <div className="rise">
      <StreamHero
        day={streamDay}
        serverNowMs={serverNowMs}
        teaching={
          teachingToday
            ? {
                eventId: teachingToday.eventId,
                tpNumber: teachingToday.tpNumber,
                letter: teachingToday.teachingOrder
                  ? String.fromCharCode(64 + teachingToday.teachingOrder)
                  : null,
                groupName: teachingToday.groupName,
                title: teachingToday.title,
                meta: [
                  teachingToday.level,
                  teachingToday.volunteers
                    ? teachingToday.volunteers.expected === 0
                      ? `${teachingToday.volunteers.total} volunteer${teachingToday.volunteers.total === 1 ? "" : "s"} · nobody has replied yet`
                      : `${teachingToday.volunteers.expected} of ${teachingToday.volunteers.total} volunteers coming`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || null,
                planHref: `/portfolio/${traineeId}/tp/${teachingToday.tpNumber}`,
                zoomUrl: teachingToday.zoomUrl,
              }
            : null
        }
        generic={
          genericHero
            ? {
                label: genericHero.label,
                big: genericHero.big,
                bigSub: genericHero.bigSub,
                ctaHref: genericHero.ctaHref,
                ctaLabel: genericHero.ctaLabel,
                // A lesson that is not today keeps its time column and loses
                // the Join button (Part 5).
                time: heroLaterTime,
              }
            : null
        }
      />
      </div>

      <div className="rise-1">
      <StreamDayTrack
        day={streamDay}
        serverNowMs={serverNowMs}
        timeZone={timeZone}
        heading={streamHeading}
        meta={{
          lead: streamView.isToday ? metaLead : `Nothing on ${dateLabel.split(" ")[0]}`,
          countdownFor: teachingToday ? "mine" : null,
        }}
      />

      </div>

      {/* Two columns, and a column with nothing in it is dropped rather than
          rendered as an empty state -- the handoff is explicit about that. */}
      <div className="grid items-start gap-[26px] md:grid-cols-[1.4fr_1fr]">
        {waiting.length > 0 ? (
          <section className="rise-2 flex flex-col">
            <div className="mb-1 flex items-baseline gap-2.5">
              <h2 className="font-serif text-h2 font-semibold text-ink-warm">Catch up</h2>
              <span className="text-meta text-muted">{waiting.length} · all shown</span>
            </div>
            {waiting.map((w, i) => {
              const overdue = w.pill === "Overdue" || w.pill === "Today";
              const garnet = overdue || w.isLetter || w.kind === "assignment";
              return (
                <Link
                  key={`${w.href}-${i}`}
                  href={w.href}
                  className="lift grid grid-cols-[38px_1fr_auto] items-center gap-[13px] border-t border-border py-[11px]"
                >
                  <span
                    aria-hidden
                    className={`grid size-[38px] shrink-0 place-items-center rounded-[10px] text-label font-bold ${
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
                    <span className={`block text-body font-semibold ${garnet ? "text-garnet" : "text-ink"}`}>{w.label}</span>
                    <span className="block text-meta text-muted">{w.detail}</span>
                  </span>
                  <span className={`text-meta ${overdue ? "font-bold text-garnet" : "font-semibold text-muted"}`}>
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
            visitDate={formatCalendarDate(assessorVisitIso, { day: "numeric", month: "long" })}
            alreadyRequested={Boolean(ownMeetingRequest)}
          />
        ) : null}

        {broadcastsCapped.length > 0 ? (
          <section className="rise-3 flex flex-col">
            <div className="mb-1 flex items-baseline gap-2.5">
              <h2 className="font-serif text-h2 font-semibold text-ink-warm">From your tutors</h2>
              <span className="text-meta text-muted">{broadcastsCapped.length}</span>
            </div>
            {broadcastsCapped.map((b) => {
              const unread = !readIds.has(b.id);
              return (
                <div key={b.id} className="border-t border-border py-[11px]">
                  <p className={`flex items-center gap-[7px] text-body ${unread ? "font-bold" : "font-semibold"} text-ink`}>
                    {unread ? <span aria-hidden className="size-[5px] shrink-0 rounded-full bg-gold" /> : null}
                    {b.title}
                  </p>
                  {unread && b.body ? <p className="mt-[3px] text-meta leading-relaxed text-ink">{b.body}</p> : null}
                  <p className="mt-[3px] text-meta text-muted">
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
