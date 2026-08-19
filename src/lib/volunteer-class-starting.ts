import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { sendApplicantEmail, volunteerClassStartingEmailHtml } from "@/lib/admissions-email";

// Ramy, 2026-08-19: "how else will they receive the link to join?" --
// volunteer_students gets a course_access_tokens row (role
// volunteer_student) the moment they're added (register/[token]/actions.ts,
// volunteers/actions.ts), but "volunteer_signed_up" (sent right then) is
// only ever a holding acknowledgement -- "may be a little while before
// we're in touch with dates," never the actual link. Nothing ever sent it
// afterward either. This is the send: same job as starts-monday-cron.ts
// does for candidates, for volunteers instead, plus a manual trigger since
// a centre admin may want to send it on their own timing rather than wait
// for the automatic one.
export async function sendVolunteerClassStartingEmail(
  admin: SupabaseClient<Database>,
  volunteer: { id: string; name: string; email: string | null; level: string | null; course_id: string },
  options: { skipIfAlreadySent: boolean }
): Promise<{ sent: boolean; reason?: string }> {
  if (!volunteer.email) return { sent: false, reason: "No email on file for this volunteer." };

  if (options.skipIfAlreadySent) {
    const { data: already } = await admin
      .from("applicant_emails")
      .select("id")
      .eq("to_email", volunteer.email)
      .eq("type", "volunteer_class_starting")
      .limit(1)
      .maybeSingle();
    if (already) return { sent: false, reason: "already sent" };
  }

  const [{ data: course }, { data: accessToken }] = await Promise.all([
    admin.from("courses").select("id, name, center_id, start_date").eq("id", volunteer.course_id).maybeSingle(),
    admin.from("course_access_tokens").select("token").eq("volunteer_student_id", volunteer.id).eq("role", "volunteer_student").maybeSingle(),
  ]);
  if (!course) return { sent: false, reason: "Course not found." };
  if (!accessToken) return { sent: false, reason: "This volunteer has no join link yet." };

  const { data: center } = await admin.from("centers").select("name, admissions_email").eq("id", course.center_id).maybeSingle();
  if (!center) return { sent: false, reason: "Centre not found." };

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://celtaconnect.com";
  const startDay = new Date(`${course.start_date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  // No per-course start-time field exists yet -- same default starts-
  // monday-cron.ts already uses for the equivalent candidate email.
  const startTime = "09:30";

  const { error } = await sendApplicantEmail({
    centerName: center.name,
    centerAdmissionsEmail: center.admissions_email,
    to: volunteer.email,
    subject: `your free English classes start ${startDay}`,
    centerId: course.center_id,
    applicantId: null,
    type: "volunteer_class_starting",
    recipientName: volunteer.name,
    html: volunteerClassStartingEmailHtml({
      centreName: center.name,
      levelName: volunteer.level ?? "your",
      classFact: course.name,
      whenFact: `${startDay}, ${startTime}`,
      joinUrl: `${base}/student/${accessToken.token}`,
    }),
  });

  return error ? { sent: false, reason: error } : { sent: true };
}
