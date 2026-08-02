"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createResendClient, JOIN_LINK_SENDER } from "@/lib/resend/client";

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

  try {
    const resend = createResendClient();
    await resend.emails.send({
      from: JOIN_LINK_SENDER,
      to: email,
      subject: "Reset your Celta Connect password",
      html: `
        <h2>Reset your password</h2>
        <p>Someone requested a password reset for your Celta Connect account.</p>
        <p><a href="${confirmUrl}">Reset your password &rarr;</a></p>
        <p style="color:#888;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
      `,
    });
  } catch {
    // Swallow -- still report generic success either way.
  }

  return { error: null, sent: true };
}
