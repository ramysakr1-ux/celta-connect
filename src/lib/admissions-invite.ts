import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { sendApplicantEmail, interviewInvitationEmailHtml } from "@/lib/admissions-email";
import { getPickerTimeOptions, hasBookableOption, flagNoInterviewSlots } from "@/lib/interview-slot-picker";

// Ramy, 2026-08-18: supersedes the earlier "auto-book the earliest slot"
// design (migration 0151's original admissions-auto-booking.ts). Sending
// an invite no longer books anything -- it only ever sends the picker
// link. Used by both the AI-triage "clear" lane (via the cron sweep once
// the 15-minute hold passes) and a human deciding to invite someone in
// the borderline lane (staff-triggered, immediate, no hold).
export async function sendInterviewInvite(
  admin: SupabaseClient<Database>,
  applicantId: string
): Promise<{ sent: boolean }> {
  const { data: applicant } = await admin
    .from("applicants")
    .select("id, full_name, email, center_id, intake_course_id, interview_invite_token")
    .eq("id", applicantId)
    .maybeSingle();
  if (!applicant || !applicant.email) return { sent: false };

  const { data: center } = await admin.from("centers").select("name, admissions_email").eq("id", applicant.center_id).maybeSingle();
  if (!center) return { sent: false };

  const options = await getPickerTimeOptions(admin, { centerId: applicant.center_id, intakeCourseId: applicant.intake_course_id });
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://celtaconnect.com";
  const bookingUrl = `${base}/interview/${applicant.interview_invite_token}`;

  const { error } = await sendApplicantEmail({
    centerName: center.name,
    centerAdmissionsEmail: center.admissions_email,
    to: applicant.email,
    subject: "we would like to meet you",
    centerId: applicant.center_id,
    applicantId: applicant.id,
    type: "interview_invitation",
    html: interviewInvitationEmailHtml({
      applicantName: applicant.full_name,
      bookingUrl,
      slotsNote: hasBookableOption(options)
        ? "Times are held on a first-come basis -- once you pick one, it's yours."
        : "We're still finding you a time and will write again shortly -- the link above will have times as soon as they're ready.",
    }),
  });
  if (error) return { sent: false };

  await admin.from("applicants").update({ interview_invite_sent_at: new Date().toISOString() }).eq("id", applicant.id);

  if (!hasBookableOption(options)) {
    await flagNoInterviewSlots(admin, { applicantId: applicant.id, centerId: applicant.center_id, applicantName: applicant.full_name });
  }

  return { sent: true };
}
