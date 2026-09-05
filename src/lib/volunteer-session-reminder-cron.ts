import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToOwners } from "@/lib/push/send";
import { zonedTimeToUtc, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";
import { getCachedCenter } from "@/lib/supabase/cached-queries";

const WINDOW_START_MINUTES = 25;
const WINDOW_END_MINUTES = 35;

// for-claude-code-announcements.md: "Volunteer session starting soon --
// Registered volunteers for that session -- 'Your class starts in 30
// minutes -- join here.'" Every TP event of a course a volunteer belongs
// to counts as one of their classes (same model getVolunteerIdentityData
// uses for the student dashboard) -- a volunteer who's explicitly
// declined a specific event is skipped, everyone else is due once, ever,
// per event (volunteer_session_reminders_sent is the idempotency guard
// across 5-minute sweeps).
//
// A 10-minute-wide window (25-35 minutes out), swept every 5 minutes,
// means every event's start time falls inside exactly one sweep's window
// -- no gaps, no double-counting a boundary event across two sweeps.
export async function runVolunteerSessionReminderCron(): Promise<{ eventsChecked: number; reminded: number }> {
  const admin = createAdminClient();
  const now = new Date();
  const windowStart = new Date(now.getTime() + WINDOW_START_MINUTES * 60_000);
  const windowEnd = new Date(now.getTime() + WINDOW_END_MINUTES * 60_000);

  // Same reasoning as the email reminder crons: "due" depends on each
  // event's own centre timezone, not known until its course/centre is
  // resolved -- the query only narrows by a generous, timezone-agnostic
  // +/-1 day UTC bound (the window itself is under an hour out).
  const wideStart = new Date(windowStart.getTime() - 24 * 60 * 60 * 1000);
  const wideEnd = new Date(windowEnd.getTime() + 24 * 60 * 60 * 1000);
  const { data: candidateEvents } = await admin
    .from("course_timetable_events")
    .select("id, course_id, event_date, event_time")
    .eq("type", "tp")
    .not("event_time", "is", null)
    .gte("event_date", wideStart.toISOString().slice(0, 10))
    .lte("event_date", wideEnd.toISOString().slice(0, 10));

  const candidateCourseIds = [...new Set((candidateEvents ?? []).map((e) => e.course_id))];
  const { data: candidateCourses } =
    candidateCourseIds.length > 0 ? await admin.from("courses").select("id, center_id").in("id", candidateCourseIds) : { data: [] };
  const centerIdByCourseId = new Map((candidateCourses ?? []).map((c) => [c.id, c.center_id]));
  const centerIds = [...new Set([...centerIdByCourseId.values()])];
  const centers = await Promise.all(centerIds.map((id) => getCachedCenter(id)));
  const timezoneByCenterId = new Map(centers.filter((c) => c !== null).map((c) => [c.id, c.time_zone]));

  const dueEvents = (candidateEvents ?? []).filter((e) => {
    if (!e.event_time) return false;
    const centerId = centerIdByCourseId.get(e.course_id);
    const timeZone = (centerId ? timezoneByCenterId.get(centerId) : null) ?? DEFAULT_TIMEZONE;
    const eventDateTime = zonedTimeToUtc(e.event_date, e.event_time, timeZone);
    return eventDateTime >= windowStart && eventDateTime < windowEnd;
  });
  if (dueEvents.length === 0) return { eventsChecked: 0, reminded: 0 };

  const courseIds = [...new Set(dueEvents.map((e) => e.course_id))];
  const { data: volunteers } = await admin.from("volunteer_students").select("id, course_id").in("course_id", courseIds);

  let reminded = 0;

  for (const event of dueEvents) {
    const eventVolunteerIds = (volunteers ?? []).filter((v) => v.course_id === event.course_id).map((v) => v.id);
    if (eventVolunteerIds.length === 0) continue;

    const [{ data: declines }, { data: alreadySent }] = await Promise.all([
      admin.from("volunteer_declines").select("volunteer_student_id").eq("timetable_event_id", event.id).in("volunteer_student_id", eventVolunteerIds),
      admin
        .from("volunteer_session_reminders_sent")
        .select("volunteer_student_id")
        .eq("timetable_event_id", event.id)
        .eq("channel", "push")
        .in("volunteer_student_id", eventVolunteerIds),
    ]);
    const skip = new Set([...(declines ?? []).map((d) => d.volunteer_student_id), ...(alreadySent ?? []).map((r) => r.volunteer_student_id)]);
    const dueVolunteerIds = eventVolunteerIds.filter((id) => !skip.has(id));
    if (dueVolunteerIds.length === 0) continue;

    // Each volunteer's dashboard URL is their own tokenized link -- can't
    // share one push payload across volunteers the way a course-wide
    // announcement could, so this sends one push per volunteer.
    const { data: tokens } = await admin
      .from("course_access_tokens")
      .select("token, volunteer_student_id")
      .eq("role", "volunteer_student")
      .in("volunteer_student_id", dueVolunteerIds);
    const tokenByVolunteerId = new Map((tokens ?? []).map((t) => [t.volunteer_student_id, t.token]));

    // for-claude-code-volunteer-messaging-complete.md §1: tell them the
    // actual time to join -- five minutes before this event's own start,
    // computed per event, never a fixed clock time. "The room won't be
    // ready before then" replaces copy that implied it already was.
    const [h, m] = (event.event_time ?? "00:00").slice(0, 5).split(":").map(Number);
    const joinMinutes = h * 60 + m - 5;
    const joinAt = `${String(Math.floor(((joinMinutes % 1440) + 1440) % 1440 / 60)).padStart(2, "0")}:${String(((joinMinutes % 60) + 60) % 60).padStart(2, "0")}`;
    for (const volunteerId of dueVolunteerIds) {
      const token = tokenByVolunteerId.get(volunteerId);
      await sendPushToOwners(
        { volunteerStudentIds: [volunteerId] },
        {
          title: "Your class starts in 30 minutes",
          body: `Please join at ${joinAt} -- the room won't be ready before then.`,
          url: token ? `/student/${token}` : "/",
        }
      );
    }

    await admin
      .from("volunteer_session_reminders_sent")
      .insert(dueVolunteerIds.map((volunteer_student_id) => ({ volunteer_student_id, timetable_event_id: event.id, channel: "push" as const })));
    reminded += dueVolunteerIds.length;
  }

  return { eventsChecked: dueEvents.length, reminded };
}
