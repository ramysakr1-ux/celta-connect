import Link from "next/link";
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
        <Link href="/" className="inline-block hover:opacity-80">
          <Wordmark size="hero" />
        </Link>
        <h1 className="mt-4 font-serif text-2xl text-ink">Set or reset your password</h1>
        <p className="mt-1 text-sm text-muted">Enter your email and we&apos;ll send you a link to set one. Works whether you have a password already or have never had one.</p>
        <p className="mt-2 text-xs text-muted">Most accounts sign in by emailed link and never need a password &mdash; setting one is optional. If you hold a workspace or assessor link, use that instead.</p>
        <ForgotPasswordForm />
      </div>
      </div>
    </div>
  );
}
