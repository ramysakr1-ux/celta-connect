import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendVolunteerClassStartingEmail } from "@/lib/volunteer-class-starting";

// Same 7-day lookahead window as starts-monday-cron.ts, checked from the
// same daily route. Simpler than that cron's Friday-before/late-enrolment
// split -- there's no equivalent "welcome copy changes if it's late"
// distinction for volunteers, just one email, sent once a course is within
// a week of starting. skipIfAlreadySent (dedupes on to_email + type) is
// what makes running this every day safe rather than the day-of-week logic
// doing that work.
export async function runVolunteerClassStartingCron(): Promise<{ sent: number }> {
  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysOut = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data: courses } = await admin
    .from("courses")
    .select("id, start_date")
    .gte("start_date", today)
    .lte("start_date", sevenDaysOut);

  let sent = 0;
  for (const course of courses ?? []) {
    const { data: volunteers } = await admin
      .from("volunteer_students")
      .select("id, name, email, level, course_id")
      .eq("course_id", course.id)
      .is("removed_at", null)
      .not("email", "is", null);

    for (const volunteer of volunteers ?? []) {
      const result = await sendVolunteerClassStartingEmail(admin, volunteer, { skipIfAlreadySent: true });
      if (result.sent) sent++;
    }
  }

  return { sent };
}
