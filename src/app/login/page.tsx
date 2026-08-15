import { LoginForm } from "@/app/login/login-form";
import { Wordmark } from "@/components/wordmark";
import { DesignerCredit } from "@/components/designer-credit";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="sheet-accent w-full max-w-sm p-8">
          <Wordmark size="hero" />
          <p className="mt-1 text-sm text-muted">Teacher training platform. Built for CELTA and Delta centres.</p>
          <p className="mt-2 text-xs text-muted">
            Assessors and volunteer students don&apos;t sign in -- you have your own link. Trainees sign in here too,
            after setting up an account from their join link.
          </p>
          {error === "invite_invalid" ? (
            <p className="mt-4 text-sm text-destructive">
              That invite link is invalid or has expired. Ask your admin to resend it.
            </p>
          ) : null}
          {error === "session_expired" ? (
            <p className="mt-4 text-sm text-destructive">
              Your session expired before you could set a password. Ask your admin to resend the
              invite.
            </p>
          ) : null}
          {error === "assessor_link_invalid" ? (
            <p className="mt-4 text-sm text-destructive">
              That assessor link is invalid or has expired. Ask the centre for a new one.
            </p>
          ) : null}
          <LoginForm />
        </div>
      </div>
      <footer className="flex justify-center pb-6">
        <DesignerCredit />
      </footer>
    </div>
  );
}
