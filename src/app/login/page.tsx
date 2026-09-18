import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/app/login/login-form";
import { Wordmark } from "@/components/wordmark";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { resolveLandingPath } from "@/lib/auth/landing-path";
import { safeRedirectPath } from "@/lib/safe-redirect";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  // Somebody who is already signed in does not need to sign in again.
  //
  // The installed app opens on "/" and "/" sends everyone here, so Ramy's
  // own Connect icon put a sign-in form in front of him every time, session
  // or no session (18 Sep 2026: "I logged in and it did take me to the
  // command center" -- he should not have had to). resolveLandingPath is
  // the same answer the sign-in action gives, so the door and the form
  // agree: Command Center for a platform owner, the hub for a tutor, their
  // own workspace for a candidate.
  //
  // Not when there is an `error` to show -- that message is the reason the
  // person was sent here, and forwarding would swallow it. An assessor or a
  // volunteer has a token and no session, so they still get the form, and
  // so does a signed-in account with no profile yet (/dashboard explains
  // that case rather than bouncing them somewhere they cannot use).
  if (!error) {
    const session = await getCurrentProfile();
    if (session) {
      const landing = session.profile ? await resolveLandingPath(session.profile) : "/dashboard";
      redirect(safeRedirectPath(next, landing));
    }
  }

  return (
    <div className="entry-ground flex flex-1 flex-col">
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="frame w-full max-w-sm p-3">
        <div className="sheet-entry p-8">
          <Link href="/" className="inline-block hover:opacity-80">
            <Wordmark size="hero" />
          </Link>
          <p className="mt-3 text-body text-muted">Sign in to your centre.</p>
          <p className="mt-2 text-label text-muted">
            Assessors and volunteer students don&apos;t sign in -- you have your own link. Trainees sign in here too,
            after setting up an account from their join link.
          </p>
          {error === "invite_invalid" ? (
            <div className="sheet-accent-alert mt-4">
              <p className="text-body text-ink">That invite link is invalid or has expired. Ask your admin to resend it.</p>
            </div>
          ) : null}
          {error === "session_expired" ? (
            <div className="sheet-accent-alert mt-4">
              <p className="text-body text-ink">
                Your session expired before you could set a password. Ask your admin to resend the invite.
              </p>
            </div>
          ) : null}
          {error === "assessor_link_invalid" ? (
            <div className="sheet-accent-alert mt-4">
              <p className="text-body text-ink">That assessor link is invalid or has expired. Ask the centre for a new one.</p>
            </div>
          ) : null}
          <LoginForm next={next} />
        </div>
        </div>
      </div>
    </div>
  );
}
