import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendApplicantEmail, volunteerSessionReminderEmailHtml } from "@/lib/admissions-email";
import { toLocalIso } from "@/lib/timetable-grid";
import { teachingDayNumber } from "@/lib/volunteer-attendance";
import { extractLevelCode } from "@/lib/levels";

const WINDOW_START_MINUTES = 20 * 60 - 15; // 19h45m before
const WINDOW_END_MINUTES = 20 * 60 + 15; // 20h15m before

// Ramy, 25 Aug 2026: "we don't know what time zone... it should be a
// certain number of hours before class time." Used to fire once a day at a
// fixed clock time (17:00 UTC) for anything on "tomorrow"'s calendar date,
// so the actual lead time swung anywhere from ~15 to ~33 hours depending on
// the class's own start time. Deliberately NOT 24 hours before: for a
// course teaching every day at roughly the same time, 24 hours before
// tomorrow's class lands right at today's -- "it means they will actually
// be at class when they get the reminder." 20 hours sidesteps that without
// needing to know anything about the course's actual daily schedule (an
// "end of today's class + 30 minutes" anchor was considered and dropped --
// same idea, but has to solve weekends/gaps to find "the preceding class
// day," and a flat number sidesteps that entirely). Same shape as the
// 30-minutes-before push/email crons just scaled up -- a 30-minute-wide
// window swept every 15 minutes (migration 0215), so no event can fall
// through the gap between two sweeps. Same idempotency table as the push
// cron, scoped to channel = 'email', and skips anyone who's used either
// reminder email's unsubscribe link (migration 0214, reminders_opted_out).
export async function runVolunteerSessionEmailReminderCron(): Promise<{ eventsChecked: number; reminded: number }> {
  const admin = createAdminClient();
  const now = new Date();
  const windowStart = new Date(now.getTime() + WINDOW_START_MINUTES * 60_000);
  const windowEnd = new Date(now.getTime() + WINDOW_END_MINUTES * 60_000);

  const { data: candidateEvents } = await admin
    .from("course_timetable_events")
    .select("id, course_id, title, event_date, event_time, zoom_url")
    .eq("type", "tp")
    .not("event_time", "is", null)
    .gte("event_date", toLocalIso(now))
    .lte("event_date", toLocalIso(windowEnd));

  const dueEvents = (candidateEvents ?? []).filter((e) => {
    if (!e.event_time) return false;
    const eventDateTime = new Date(`${e.event_date}T${e.event_time}`);
    return eventDateTime >= windowStart && eventDateTime < windowEnd;
  });
  if (dueEvents.length === 0) return { eventsChecked: 0, reminded: 0 };

  const courseIds = [...new Set(dueEvents.map((e) => e.course_id))];
  const [{ data: volunteers }, { data: courses }, { data: allTpEvents }] = await Promise.all([
    admin.from("volunteer_students").select("id, name, email, level, course_id, reminders_opted_out").in("course_id", courseIds),
    admin.from("courses").select("id, name, center_id").in("id", courseIds),
    // Every TP date for these courses, not just the due window -- "since
    // everything comes from the timetable, this will also come from the
    // timetable": the day number a due event gets is its real position
    // among that course's own teaching dates, not a fixed per-day TP count.
    admin.from("course_timetable_events").select("course_id, event_date").eq("type", "tp").in("course_id", courseIds),
  ]);
  const courseById = new Map((courses ?? []).map((c) => [c.id, c]));
  const centerIds = [...new Set((courses ?? []).map((c) => c.center_id))];
  const { data: centers } = centerIds.length > 0 ? await admin.from("centers").select("id, name, admissions_email").in("id", centerIds) : { data: [] };
  const centerById = new Map((centers ?? []).map((c) => [c.id, c]));
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
        .eq("channel", "email")
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
    // Ramy, 25 Aug 2026: "TP4" meant nothing to a volunteer, and neither
    // does the raw course name/code -- what's actually useful is the
    // level (set by the MCT at the very beginning, via the same Class
    // level dropdown every "add volunteer" form already has) and which
    // teaching day this is.
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
        subject: "your class is tomorrow",
        centerId: center.id,
        applicantId: null,
        type: "volunteer_session_reminder",
        recipientName: volunteer.name,
        html: volunteerSessionReminderEmailHtml({
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
        .insert(sentVolunteerIds.map((volunteer_student_id) => ({ volunteer_student_id, timetable_event_id: event.id, channel: "email" as const })));
      reminded += sentVolunteerIds.length;
    }
  }

  return { eventsChecked: dueEvents.length, reminded };
}
