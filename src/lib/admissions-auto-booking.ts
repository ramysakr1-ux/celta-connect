import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendInterviewInvite } from "@/lib/admissions-invite";
import { sendApplicantEmail, interviewInvitationEmailHtml } from "@/lib/admissions-email";

// specs/for-claude-code-email-inventory.md Part 1: "clear on every
// criterion -> invitation drafted, held 15 minutes, then auto-sent with
// interview times." admissions-ai-triage.ts sets interview_auto_send_at
// (now + 15 minutes) the moment a "clear" reading lands on a centre with
// autobook on; this is the sweep that actually fires once that time has
// passed, unless a human clicked Hold in the meantime.
//
// Ramy, 2026-08-18 (specs/for-claude-code-auto-booked-interview.md then
// superseded by the interview-slot-picker note): "auto-sent" no longer
// means booking a slot on the applicant's behalf -- it means sending the
// same picker-link invite a human sends for the borderline lane. Nothing
// is claimed here; sendInterviewInvite only ever emails a link.
//
// Runs from its own route (/api/cron/admissions-auto-book) on its own
// tight schedule, fired every few minutes by a Supabase pg_cron job
// (migration 0152) -- independent of the Vercel Hobby plan's cron limits,
// since pg_cron runs inside the database itself rather than through
// Vercel's scheduler.
export async function runAdmissionsAutoBookCron(): Promise<{ invited: number; reminded: number }> {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: due } = await admin
    .from("applicants")
    .select("id")
    .eq("ai_reading_lane", "clear")
    .not("interview_auto_send_at", "is", null)
    .lte("interview_auto_send_at", nowIso)
    .is("interview_auto_send_cancelled_at", null)
    .is("interview_auto_send_sent_at", null);

  let invited = 0;
  for (const applicant of due ?? []) {
    const result = await sendInterviewInvite(admin, applicant.id);
    if (result.sent) {
      await admin.from("applicants").update({ interview_auto_send_sent_at: nowIso }).eq("id", applicant.id);
      invited++;
    }
  }

  invited += await runInvitedButUnbookedReminders(admin, nowIso);

  return { invited, reminded: invited };
}

// "Send a reminder email 48 hours after the invite if no slot's been
// picked yet (a nudge, not a deadline) -- same picker link, new copy: 'A
// few times are still open.'" Applies to every invite regardless of which
// lane sent it -- interview_invite_sent_at is set by sendInterviewInvite
// either way.
async function runInvitedButUnbookedReminders(admin: ReturnType<typeof createAdminClient>, nowIso: string): Promise<number> {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const { data: overdue } = await admin
    .from("applicants")
    .select("id, full_name, email, center_id, interview_invite_token")
    .not("interview_invite_sent_at", "is", null)
    .lte("interview_invite_sent_at", cutoff)
    .is("interview_invite_reminder_sent_at", null)
    .neq("stage", "interview_booked");

  let reminded = 0;
  for (const applicant of overdue ?? []) {
    if (!applicant.email) continue;
    const { data: center } = await admin.from("centers").select("name, admissions_email").eq("id", applicant.center_id).maybeSingle();
    if (!center) continue;

    const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://celtaconnect.com";
    const { error } = await sendApplicantEmail({
      centerName: center.name,
      centerAdmissionsEmail: center.admissions_email,
      to: applicant.email,
      subject: "a few times are still open",
      centerId: applicant.center_id,
      applicantId: applicant.id,
      type: "interview_invitation",
      html: interviewInvitationEmailHtml({
        applicantName: applicant.full_name,
        bookingUrl: `${base}/interview/${applicant.interview_invite_token}`,
        slotsNote: "A few times are still open -- first come, first served.",
      }),
    });
    if (error) continue;

    await admin.from("applicants").update({ interview_invite_reminder_sent_at: nowIso }).eq("id", applicant.id);
    reminded++;
  }
  return reminded;
}
