"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createResendClient, centerNameForUserId, joinLinkSender } from "@/lib/resend/client";

export interface SignInState {
  error: string | null;
}

export interface SignInLinkState {
  error: string | null;
  sent: boolean;
}

// "Trainees sign in here too, after setting up an account from their join
// link" -- this is that same real login, just a passwordless alternative
// for anyone who's forgotten theirs. Same generateLink+Resend pattern as
// requestPasswordReset (forgot-password/actions.ts): bypasses Supabase's
// own magic-link email template so it goes out through the centre's own
// branded sender, verified server-side via /auth/confirm.
export async function sendSignInLink(_prevState: SignInLinkState, formData: FormData): Promise<SignInLinkState> {
  const email = formData.get("email");
  if (typeof email !== "string" || !email) {
    return { error: "Enter your email.", sent: false };
  }

  const siteUrl = process.env.SITE_URL;
  if (!siteUrl) {
    return { error: "Sign-in links aren't set up yet -- SITE_URL is missing.", sent: false };
  }

  const admin = createAdminClient();
  const { data, error: generateError } = await admin.auth.admin.generateLink({ type: "magiclink", email });

  // Same wording regardless of whether the email has an account -- standard
  // practice, doesn't leak which emails are registered.
  if (generateError || !data) {
    return { error: null, sent: true };
  }

  const confirmUrl = `${siteUrl}/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink&next=/dashboard`;

  try {
    const centerName = data.user ? await centerNameForUserId(admin, data.user.id) : null;
    const resend = createResendClient();
    await resend.emails.send({
      from: joinLinkSender(centerName),
      to: email,
      subject: "Your Connect sign-in link",
      html: `
        <h2>Sign in to Connect</h2>
        <p>Click below to sign in -- no password needed.</p>
        <p><a href="${confirmUrl}">Sign in &rarr;</a></p>
        <p style="color:#888;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
      `,
    });
  } catch {
    // Swallow -- still report generic success either way.
  }

  return { error: null, sent: true };
}

export async function signIn(
  _prevState: SignInState,
  formData: FormData
): Promise<SignInState> {
  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Incorrect email or password." };
  }

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
