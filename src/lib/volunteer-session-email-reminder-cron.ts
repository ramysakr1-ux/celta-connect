import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendApplicantEmail, volunteerSessionReminderEmailHtml } from "@/lib/admissions-email";
import { toLocalIso } from "@/lib/timetable-grid";

// Ramy, 23 Aug 2026: volunteers get an EMAIL, not a push, for the
// day-before reminder -- distinct from the existing 30-minutes-before push
// (volunteer-session-reminder-cron.ts, which stays as-is). Fires once
// daily (migration 0201's cron.schedule), checks for TP events happening
// tomorrow, same idempotency table as the push cron but scoped to
// channel = 'email' so the two reminders never block each other.
export async function runVolunteerSessionEmailReminderCron(): Promise<{ eventsChecked: number; reminded: number }> {
  const admin = createAdminClient();
  const tomorrow = toLocalIso(new Date(Date.now() + 24 * 60 * 60 * 1000));

  const { data: dueEvents } = await admin
    .from("course_timetable_events")
    .select("id, course_id, title, event_date, event_time, zoom_url")
    .eq("type", "tp")
    .eq("event_date", tomorrow);
  if (!dueEvents || dueEvents.length === 0) return { eventsChecked: 0, reminded: 0 };

  const courseIds = [...new Set(dueEvents.map((e) => e.course_id))];
  const [{ data: volunteers }, { data: courses }] = await Promise.all([
    admin.from("volunteer_students").select("id, name, email, course_id").in("course_id", courseIds),
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

    const eventVolunteers = (volunteers ?? []).filter((v) => v.course_id === event.course_id && v.email);
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

    const sentVolunteerIds: string[] = [];
    for (const volunteer of dueVolunteers) {
      const token = tokenByVolunteerId.get(volunteer.id);
      if (!token || !volunteer.email) continue;
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
          classFact: course.name,
          whenFact,
          joinUrl: event.zoom_url ?? `${base}/student/${token}`,
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
