import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendApplicantEmail, volunteer30MinReminderEmailHtml } from "@/lib/admissions-email";
import { toLocalIso } from "@/lib/timetable-grid";

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
  const [{ data: volunteers }, { data: courses }] = await Promise.all([
    admin.from("volunteer_students").select("id, name, email, course_id, reminders_opted_out").in("course_id", courseIds),
    admin.from("courses").select("id, name, center_id").in("id", courseIds),
  ]);
  const courseById = new Map((courses ?? []).map((c) => [c.id, c]));
  const centerIds = [...new Set((courses ?? []).map((c) => c.center_id))];
  const { data: centers } = centerIds.length > 0 ? await admin.from("centers").select("id, name, admissions_email").in("id", centerIds) : { data: [] };
  const centerById = new Map((centers ?? []).map((c) => [c.id, c]));

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

    const sentVolunteerIds: string[] = [];
    for (const volunteer of dueVolunteers) {
      const token = tokenByVolunteerId.get(volunteer.id);
      if (!token || !volunteer.email) continue;
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
          classFact: course.name,
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
