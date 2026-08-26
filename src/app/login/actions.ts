"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { centerInfoForUserId, joinLinkSender } from "@/lib/resend/client";
import { sendApplicantEmail } from "@/lib/admissions-email";
import { authEmailShell, p } from "@/lib/email-layout";
import { isAuthRateLimited } from "@/lib/auth-rate-limit";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { resolveLandingPath } from "@/lib/auth/landing-path";

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

  // Public, unauthenticated, and generateLink() below is real Supabase Auth
  // work even before any email goes out -- rate-limited the same way /apply
  // is (see src/lib/auth-rate-limit.ts).
  if (await isAuthRateLimited(admin, "sign_in_link")) {
    return { error: "Too many attempts. Try again in an hour.", sent: false };
  }

  const { data, error: generateError } = await admin.auth.admin.generateLink({ type: "magiclink", email });

  // Same wording regardless of whether the email has an account -- standard
  // practice, doesn't leak which emails are registered.
  if (generateError || !data) {
    return { error: null, sent: true };
  }

  const next = safeRedirectPath(formData.get("next") as string | null, "/dashboard");
  const confirmUrl = `${siteUrl}/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink&next=${encodeURIComponent(next)}`;

  // for-claude-code-email-delivery-tracking.md -- was a raw resend.emails.
  // send() call, untracked. Routed through sendApplicantEmail; failures are
  // swallowed here same as before (the outer response is deliberately the
  // same wording regardless of outcome, so as not to leak which emails have
  // accounts), but the send itself is now recorded either way.
  try {
    const centerInfo = data.user ? await centerInfoForUserId(admin, data.user.id) : null;
    const centerName = centerInfo?.name ?? "Connect";
    await sendApplicantEmail({
      centerName,
      centerAdmissionsEmail: null,
      to: email,
      subject: "your sign-in link",
      html: authEmailShell({
        centerName,
        heading: "Sign in to Connect",
        body: p("Click below to sign in -- no password needed."),
        cta: { label: "Sign in", url: confirmUrl },
        footnote: "If you didn't request this, you can safely ignore this email.",
      }),
      centerId: centerInfo?.id,
      applicantId: null,
      type: "sign_in_link",
      from: joinLinkSender(centerInfo?.name ?? null),
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

  // Public, unauthenticated password-guessing surface -- same rate limit as
  // the passwordless flows above (see src/lib/auth-rate-limit.ts).
  if (await isAuthRateLimited(createAdminClient(), "sign_in_password")) {
    return { error: "Too many attempts. Try again in an hour." };
  }

  const supabase = await createClient();
  const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Incorrect email or password." };
  }

  // Redirect straight to the real landing page instead of through
  // /dashboard -- that page just re-fetches this same profile and runs
  // this same role logic before redirecting again, an entire extra
  // request/render round trip on every single sign-in. An explicit `next`
  // (e.g. bounced here from a protected deep link) still wins either way.
  const next = formData.get("next") as string | null;
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    redirect(next);
  }
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", authData.user.id).maybeSingle();
  redirect(profile ? await resolveLandingPath(profile) : "/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
