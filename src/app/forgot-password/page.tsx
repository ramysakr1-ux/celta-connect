import { ForgotPasswordForm } from "@/app/forgot-password/forgot-password-form";
import { Wordmark } from "@/components/wordmark";

// Was the only entry gate still on a plain .card with no wordmark --
// specs/entry-screens PDF (2026-08-15) flagged it explicitly: "Same accent
// sheet, same width, same mark as everything else."
export default function ForgotPasswordPage() {
  return (
    <div className="entry-ground flex flex-1 items-center justify-center p-8">
      <div className="frame w-full max-w-sm p-3">
      <div className="sheet-entry p-8">
        <Wordmark size="hero" />
        <h1 className="mt-4 font-serif text-2xl text-ink">Reset your password</h1>
        <p className="mt-1 text-sm text-muted">Enter your email and we&apos;ll send you a reset link.</p>
        <p className="mt-2 text-xs text-muted">Only staff accounts have passwords. If you hold a workspace or assessor link, use that instead.</p>
        <ForgotPasswordForm />
      </div>
      </div>
    </div>
  );
}
