import { LoginForm } from "@/app/login/login-form";
import { Wordmark } from "@/components/wordmark";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  return (
    <div className="entry-ground flex flex-1 flex-col">
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="frame w-full max-w-sm p-3">
        <div className="sheet-accent p-8">
          <Wordmark size="hero" />
          <p className="mt-3 text-sm text-muted">Sign in to your centre.</p>
          <p className="mt-2 text-xs text-muted">
            Assessors and volunteer students don&apos;t sign in -- you have your own link. Trainees sign in here too,
            after setting up an account from their join link.
          </p>
          {error === "invite_invalid" ? (
            <div className="sheet-accent-alert mt-4">
              <p className="text-sm text-ink">That invite link is invalid or has expired. Ask your admin to resend it.</p>
            </div>
          ) : null}
          {error === "session_expired" ? (
            <div className="sheet-accent-alert mt-4">
              <p className="text-sm text-ink">
                Your session expired before you could set a password. Ask your admin to resend the invite.
              </p>
            </div>
          ) : null}
          {error === "assessor_link_invalid" ? (
            <div className="sheet-accent-alert mt-4">
              <p className="text-sm text-ink">That assessor link is invalid or has expired. Ask the centre for a new one.</p>
            </div>
          ) : null}
          <LoginForm next={next} />
        </div>
        </div>
      </div>
    </div>
  );
}
