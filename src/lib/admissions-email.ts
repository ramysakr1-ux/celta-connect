import "server-only";
import { createResendClient } from "@/lib/resend/client";

// "Every email is from the centre... sender is the centre's name, reply-to
// is a centre address. Connect never appears in anyone's inbox." The
// verified sending domain stays celtaconnect.com (Resend needs a verified
// domain), but the visible display name is the centre's own -- nowhere in
// the recipient's inbox does the word "Connect" appear. Reply-to is the
// centre's real admissions address when one's configured; falls back to
// the sending address (still no "Connect" branding visible) otherwise.
export type ApplicantEmailType =
  | "offer"
  | "rejection"
  | "waiting_list"
  | "place_freed"
  | "not_this_time"
  | "interview_invitation"
  | "welcome";

export async function sendApplicantEmail(input: {
  centerName: string;
  centerAdmissionsEmail: string | null;
  to: string;
  subject: string;
  html: string;
  // Logging context. Optional only so an unrelated future caller can't be
  // blocked from sending -- but every caller in the app passes them, and
  // without them the send simply isn't recorded.
  centerId?: string;
  applicantId?: string | null;
  type?: ApplicantEmailType;
  sentBy?: string | null;
}): Promise<{ error: string | null }> {
  let failure: string | null = null;
  try {
    const resend = createResendClient();
    const { error } = await resend.emails.send({
      from: `${input.centerName} <noreply@celtaconnect.com>`,
      to: input.to,
      replyTo: input.centerAdmissionsEmail ?? undefined,
      subject: input.subject,
      html: input.html,
    });
    failure = error ? error.message : null;
  } catch (err) {
    failure = err instanceof Error ? err.message : "Could not send the email.";
  }

  // Logged here rather than at each call site so a new email type cannot
  // forget to record itself -- and failures are logged too, since a bounced
  // email is exactly the one a centre needs to see. Never throws: a logging
  // problem must not turn a sent email into a reported failure.
  if (input.centerId && input.type) {
    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      await createAdminClient().from("applicant_emails").insert({
        center_id: input.centerId,
        applicant_id: input.applicantId ?? null,
        type: input.type,
        to_email: input.to,
        subject: input.subject,
        status: failure ? "failed" : "sent",
        error: failure,
        sent_by: input.sentBy ?? null,
      });
    } catch {
      // Deliberately swallowed -- see above.
    }
  }

  return { error: failure };
}

export function offerEmailHtml(input: {
  applicantName: string;
  courseName: string;
  feeAmount: number | null;
  feeCurrency: string | null;
  acceptBy: string;
  offerUrl: string;
}): string {
  return `
    <p>Dear ${input.applicantName},</p>
    <p>We're pleased to offer you a place on ${input.courseName}.</p>
    ${input.feeAmount ? `<p>The course fee is ${input.feeAmount} ${input.feeCurrency}.</p>` : ""}
    <p>To confirm your place, set up your account, and receive your pre-course task, follow this link by ${input.acceptBy}:</p>
    <p><a href="${input.offerUrl}">${input.offerUrl}</a></p>
    <p>If we don't hear from you by then, we'll assume the place is no longer needed and offer it to someone else.</p>
  `;
}

export function rejectionEmailHtml(input: { applicantName: string; courseName: string; reason: string }): string {
  return `
    <p>Dear ${input.applicantName},</p>
    <p>Thank you for applying to ${input.courseName}. We're not able to offer you a place at this time.</p>
    <p>${input.reason}</p>
    <p>This isn't final, and we'd welcome a future application if the above changes.</p>
  `;
}

// "Position, the course, and a date by which they will hear either way.
// Without that date it is just an unanswered application." Sent once, when
// added to the list -- not the "place has come free" email below.
export function waitingListEmailHtml(input: { applicantName: string; courseName: string; position: number; hearBy: string }): string {
  return `
    <p>Dear ${input.applicantName},</p>
    <p>${input.courseName} is full, but we're keeping your application on our waiting list -- you're currently number ${input.position}.</p>
    <p>You'll hear from us either way by ${input.hearBy}. Your application and any task or interview you've already completed stay on file, so you won't need to repeat them.</p>
    <p>If a place frees up before then, we'll be in touch straight away.</p>
  `;
}

// "A named day and hour, not a number of days... the button carries the
// countdown." Reuses the same /offer/[token] link and accept flow as a
// fresh offer -- accepting this literally is accepting the offer.
export function placeFreedEmailHtml(input: { applicantName: string; courseName: string; expiresAt: string; offerUrl: string }): string {
  return `
    <p>Dear ${input.applicantName},</p>
    <p>A place has come free on ${input.courseName}, and you're next on our waiting list.</p>
    <p>To confirm your place, set up your account, and receive your pre-course task, follow this link by <strong>${input.expiresAt}</strong>:</p>
    <p><a href="${input.offerUrl}">${input.offerUrl}</a></p>
    <p>If we don't hear from you by then, we'll offer the place to the next person on the list. Declining costs you nothing -- your application carries forward to the next intake, with your task and interview still on file.</p>
  `;
}

// "Sends automatically when the waiting-list deadline passes with no place
// freed... apologises, explains that the course filled, and carries them
// to the next intake unless they opt out." No human sentence -- nobody is
// being judged, so unlike the two rejection emails this is never gated on
// a written reason.
export function notThisTimeEmailHtml(input: { applicantName: string; courseName: string }): string {
  return `
    <p>Dear ${input.applicantName},</p>
    <p>We're sorry -- ${input.courseName} filled before a place came free for you from the waiting list.</p>
    <p>This isn't a reflection on your application. We'll carry your details forward and be in touch about our next intake, unless you'd rather we didn't -- just reply to let us know.</p>
  `;
}
