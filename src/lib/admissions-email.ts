import "server-only";
import { createResendClient } from "@/lib/resend/client";

// "Every email is from the centre... sender is the centre's name, reply-to
// is a centre address. Connect never appears in anyone's inbox." The
// verified sending domain stays celtaconnect.com (Resend needs a verified
// domain), but the visible display name is the centre's own -- nowhere in
// the recipient's inbox does the word "Connect" appear. Reply-to is the
// centre's real admissions address when one's configured; falls back to
// the sending address (still no "Connect" branding visible) otherwise.
export async function sendApplicantEmail(input: {
  centerName: string;
  centerAdmissionsEmail: string | null;
  to: string;
  subject: string;
  html: string;
}): Promise<{ error: string | null }> {
  try {
    const resend = createResendClient();
    const { error } = await resend.emails.send({
      from: `${input.centerName} <noreply@celtaconnect.com>`,
      to: input.to,
      replyTo: input.centerAdmissionsEmail ?? undefined,
      subject: input.subject,
      html: input.html,
    });
    if (error) return { error: error.message };
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not send the email." };
  }
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
