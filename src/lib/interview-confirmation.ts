import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { sendApplicantEmail, interviewConfirmationEmailHtml } from "@/lib/admissions-email";
import { interviewWhen } from "@/lib/interview-time";

// The applicant's own booking confirmation -- which, until 3 Sep 2026, did
// not exist. Booking an interview (by either route) emailed the interviewer
// and whoever holds admissions, and the applicant nothing: the page said
// "you're booked in" and the next thing they heard was the reminder an hour
// before.
//
// Ramy, on where to say that the interview can be moved: "that should be
// done earlier... be good for them to know that they can change it once, but
// they have a time frame" -- and not in a way that "is encouraging them to
// change as well." So it is one calm sentence at the foot of a confirmation,
// not a button, not a heading, and it is gone from the one-hour reminder
// where it was a promise the page could no longer keep.
//
// Called from the applicant's own claim and from a staff booking alike, so
// the applicant hears the same thing however the slot was taken.
export async function sendInterviewConfirmationToApplicant(
  admin: SupabaseClient<Database>,
  input: { applicantId: string; slotId: string; centerId: string }
): Promise<void> {
  // A confirmation failure must never undo a booking that already happened.
  try {
    const [{ data: slot }, { data: applicant }, { data: center }] = await Promise.all([
      admin.from("interview_slots").select("slot_date, slot_time, mode").eq("id", input.slotId).maybeSingle(),
      admin
        .from("applicants")
        .select("full_name, email, intake_course_id, time_zone, interview_invite_token, interview_rescheduled_at")
        .eq("id", input.applicantId)
        .maybeSingle(),
      admin.from("centers").select("name, admissions_email, time_zone").eq("id", input.centerId).maybeSingle(),
    ]);
    if (!slot || !applicant?.email || !center) return;

    const { data: course } = await admin.from("courses").select("name").eq("id", applicant.intake_course_id).maybeSingle();
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.celtaconnect.com";

    await sendApplicantEmail({
      centerName: center.name,
      centerAdmissionsEmail: center.admissions_email,
      to: applicant.email,
      subject: "Your interview is booked",
      centerId: input.centerId,
      applicantId: input.applicantId,
      type: "interview_confirmation",
      recipientName: applicant.full_name,
      html: interviewConfirmationEmailHtml({
        applicantName: applicant.full_name,
        courseName: course?.name ?? "the course",
        centerName: center.name,
        when: interviewWhen({
          slot: { slotDate: slot.slot_date, slotTime: slot.slot_time },
          centreTimeZone: center.time_zone,
          applicantTimeZone: applicant.time_zone,
          centreName: center.name,
        }),
        mode: slot.mode,
        // Someone who has already spent their one change is booked for the
        // second time; telling them they can move it once would be untrue.
        rescheduleUrl:
          applicant.interview_invite_token && !applicant.interview_rescheduled_at
            ? `${base}/interview/${applicant.interview_invite_token}`
            : null,
      }),
    });
  } catch {
    // Deliberately swallowed, as above.
  }
}
