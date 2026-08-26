import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendApplicantEmail, volunteer30MinReminderEmailHtml } from "@/lib/admissions-email";
import { zonedTimeToUtc, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";
import { teachingDayNumber } from "@/lib/volunteer-attendance";
import { extractLevelCode } from "@/lib/levels";

const WINDOW_START_MINUTES = 25;
const WINDOW_END_MINUTES = 35;

// Ramy, 25 Aug 2026: "let's leave the enable notifications" -- this runs
// alongside the existing 30-minutes-before push (volunteer-session-
// reminder-cron.ts), same 25-35-minute window and 5-minute sweep, so
// volunteers who never turned push on still get reminded. Shares
// volunteer_session_reminders_sent for idempotency, scoped to its own
// channel ('email_30min') so it never double-sends against the push or the
// day-before email, and never skips a volunteer either of those already
// covered.
export async function runVolunteer30MinEmailReminderCron(): Promise<{ eventsChecked: number; reminded: number }> {
  const admin = createAdminClient();
  const now = new Date();
  const windowStart = new Date(now.getTime() + WINDOW_START_MINUTES * 60_000);
  const windowEnd = new Date(now.getTime() + WINDOW_END_MINUTES * 60_000);

  // "Is this event 25-35 minutes from now" depends on each event's own
  // centre timezone (to know its real UTC instant), which isn't known until
  // its course/centre is resolved below -- so the query itself only
  // narrows by a generous, timezone-agnostic +/-1 day UTC bound rather than
  // trying to filter precisely up front.
  const wideStart = new Date(windowStart.getTime() - 24 * 60 * 60 * 1000);
  const wideEnd = new Date(windowEnd.getTime() + 24 * 60 * 60 * 1000);
  const { data: candidateEvents } = await admin
    .from("course_timetable_events")
    .select("id, course_id, title, event_date, event_time, zoom_url")
    .eq("type", "tp")
    .not("event_time", "is", null)
    .gte("event_date", wideStart.toISOString().slice(0, 10))
    .lte("event_date", wideEnd.toISOString().slice(0, 10));

  const candidateCourseIds = [...new Set((candidateEvents ?? []).map((e) => e.course_id))];
  const [{ data: volunteers }, { data: courses }, { data: allTpEvents }] = await Promise.all([
    candidateCourseIds.length > 0
      ? admin.from("volunteer_students").select("id, name, email, level, course_id, reminders_opted_out").in("course_id", candidateCourseIds)
      : Promise.resolve({ data: [] }),
    candidateCourseIds.length > 0 ? admin.from("courses").select("id, name, center_id").in("id", candidateCourseIds) : Promise.resolve({ data: [] }),
    candidateCourseIds.length > 0
      ? admin.from("course_timetable_events").select("course_id, event_date").eq("type", "tp").in("course_id", candidateCourseIds)
      : Promise.resolve({ data: [] }),
  ]);
  const courseById = new Map((courses ?? []).map((c) => [c.id, c]));
  const centerIds = [...new Set((courses ?? []).map((c) => c.center_id))];
  const { data: centers } = centerIds.length > 0 ? await admin.from("centers").select("id, name, admissions_email, time_zone").in("id", centerIds) : { data: [] };
  const centerById = new Map((centers ?? []).map((c) => [c.id, c]));

  const dueEvents = (candidateEvents ?? []).filter((e) => {
    if (!e.event_time) return false;
    const course = courseById.get(e.course_id);
    const timeZone = course ? (centerById.get(course.center_id)?.time_zone ?? DEFAULT_TIMEZONE) : DEFAULT_TIMEZONE;
    const eventDateTime = zonedTimeToUtc(e.event_date, e.event_time, timeZone);
    return eventDateTime >= windowStart && eventDateTime < windowEnd;
  });
  if (dueEvents.length === 0) return { eventsChecked: 0, reminded: 0 };
  const tpDatesByCourse = new Map<string, string[]>();
  for (const e of allTpEvents ?? []) {
    const list = tpDatesByCourse.get(e.course_id) ?? [];
    list.push(e.event_date);
    tpDatesByCourse.set(e.course_id, list);
  }

  let reminded = 0;

  for (const event of dueEvents) {
    const course = courseById.get(event.course_id);
    const center = course ? centerById.get(course.center_id) : null;
    if (!course || !center) continue;

    const eventVolunteers = (volunteers ?? []).filter((v) => v.course_id === event.course_id && v.email && !v.reminders_opted_out);
    if (eventVolunteers.length === 0) continue;
    const volunteerIds = eventVolunteers.map((v) => v.id);

    const [{ data: declines }, { data: alreadySent }] = await Promise.all([
      admin.from("volunteer_declines").select("volunteer_student_id").eq("timetable_event_id", event.id).in("volunteer_student_id", volunteerIds),
      admin
        .from("volunteer_session_reminders_sent")
        .select("volunteer_student_id")
        .eq("timetable_event_id", event.id)
        .eq("channel", "email_30min")
        .in("volunteer_student_id", volunteerIds),
    ]);
    const skip = new Set([...(declines ?? []).map((d) => d.volunteer_student_id), ...(alreadySent ?? []).map((r) => r.volunteer_student_id)]);
    const dueVolunteers = eventVolunteers.filter((v) => !skip.has(v.id));
    if (dueVolunteers.length === 0) continue;

    const { data: tokens } = await admin
      .from("course_access_tokens")
      .select("token, volunteer_student_id")
      .eq("role", "volunteer_student")
      .in(
        "volunteer_student_id",
        dueVolunteers.map((v) => v.id)
      );
    const tokenByVolunteerId = new Map((tokens ?? []).map((t) => [t.volunteer_student_id, t.token]));

    const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://celtaconnect.com";
    const whenFact = `${new Date(`${event.event_date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}${
      event.event_time ? `, ${event.event_time.slice(0, 5)}` : ""
    }`;
    const dayFact = `Day ${teachingDayNumber(tpDatesByCourse.get(event.course_id) ?? [], event.event_date)}`;

    const sentVolunteerIds: string[] = [];
    for (const volunteer of dueVolunteers) {
      const token = tokenByVolunteerId.get(volunteer.id);
      if (!token || !volunteer.email) continue;
      const classFact = volunteer.level ? `${extractLevelCode(volunteer.level)} English lesson` : course.name;
      const { error } = await sendApplicantEmail({
        centerName: center.name,
        centerAdmissionsEmail: center.admissions_email,
        to: volunteer.email,
        subject: "your class starts in 30 minutes",
        centerId: center.id,
        applicantId: null,
        type: "volunteer_session_reminder_30min",
        recipientName: volunteer.name,
        html: volunteer30MinReminderEmailHtml({
          classFact,
          dayFact,
          whenFact,
          joinUrl: event.zoom_url ?? `${base}/student/${token}`,
          unsubscribeUrl: `${base}/student/${token}/unsubscribe`,
        }),
      });
      if (!error) sentVolunteerIds.push(volunteer.id);
    }

    if (sentVolunteerIds.length > 0) {
      await admin
        .from("volunteer_session_reminders_sent")
        .insert(sentVolunteerIds.map((volunteer_student_id) => ({ volunteer_student_id, timetable_event_id: event.id, channel: "email_30min" as const })));
      reminded += sentVolunteerIds.length;
    }
  }

  return { eventsChecked: dueEvents.length, reminded };
}
