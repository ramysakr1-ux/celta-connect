"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { centerInfoForUserId, joinLinkSender } from "@/lib/resend/client";
import { sendApplicantEmail } from "@/lib/admissions-email";
import { isAuthRateLimited } from "@/lib/auth-rate-limit";

export interface ForgotPasswordState {
  error: string | null;
  sent: boolean;
}

export async function requestPasswordReset(
  _prevState: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const email = formData.get("email");
  if (typeof email !== "string" || !email) {
    return { error: "Enter your email.", sent: false };
  }

  const siteUrl = process.env.SITE_URL;
  if (!siteUrl) {
    return { error: "Password reset isn't set up yet -- SITE_URL is missing.", sent: false };
  }

  // Deliberately bypasses Supabase's own resetPasswordForEmail() + email
  // template entirely -- generateLink() gives us the token_hash directly, so
  // we can send our own branded email (via the same Resend setup as join
  // links) pointing at our own server-side /auth/confirm verification route.
  // This sidesteps the whole fragment/stale-session ambiguity that broke the
  // old flow (see project_password_reset_session_bug memory).
  const adminClient = createAdminClient();

  // Public, unauthenticated, and generateLink() below is real Supabase Auth
  // work even before any email goes out -- rate-limited the same way /apply
  // is (see src/lib/auth-rate-limit.ts).
  if (await isAuthRateLimited(adminClient, "password_reset")) {
    return { error: "Too many attempts. Try again in an hour.", sent: false };
  }

  const { data, error: generateError } = await adminClient.auth.admin.generateLink({
    type: "recovery",
    email,
  });

  // Always report success regardless of whether the email is registered --
  // standard practice, avoids leaking which emails have accounts.
  if (generateError || !data) {
    return { error: null, sent: true };
  }

  const confirmUrl = `${siteUrl}/auth/confirm?token_hash=${data.properties.hashed_token}&type=recovery&next=/auth/set-password`;

  // for-claude-code-email-delivery-tracking.md -- was a raw resend.emails.
  // send() call, untracked. Routed through sendApplicantEmail; failures are
  // swallowed here same as before (the outer response stays the same
  // wording regardless of outcome, so as not to leak which emails have
  // accounts), but the send itself is now recorded either way.
  try {
    const centerInfo = data.user ? await centerInfoForUserId(adminClient, data.user.id) : null;
    await sendApplicantEmail({
      centerName: centerInfo?.name ?? "Connect",
      centerAdmissionsEmail: null,
      to: email,
      subject: "reset your password",
      html: `
        <h2>Reset your password</h2>
        <p>Someone requested a password reset for your Connect account.</p>
        <p><a href="${confirmUrl}">Reset your password &rarr;</a></p>
        <p style="color:#888;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
      `,
      centerId: centerInfo?.id,
      applicantId: null,
      type: "password_reset",
      from: joinLinkSender(centerInfo?.name ?? null),
    });
  } catch {
    // Swallow -- still report generic success either way.
  }

  return { error: null, sent: true };
}
