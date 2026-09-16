import Link from "next/link";
import { Wordmark } from "@/components/wordmark";

// The one screen a dead link lands on. Gates spec A3 (for-claude-code-gates-
// volunteer-email-motion.md, 16 Sep 2026): six gates used to show a bare red
// sentence under the mark, each worded its own way. One treatment now -- the
// entry sheet with a heading that says what happened and a body that says who
// to ask -- and the rule in plain brown, not red: a dead link is not an alarm.
export function EntryNotice({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div className="entry-ground flex min-h-screen flex-1 items-center justify-center p-8">
      <div className="frame w-full max-w-sm p-3">
        <div className="sheet-entry sheet-entry-plain p-8">
          <Link href="/" className="inline-block hover:opacity-80">
            <Wordmark size="hero" />
          </Link>
          <h1 className="mt-4 font-serif text-h2 leading-[1.25] font-semibold text-ink">{heading}</h1>
          <p className="mt-2 text-sm text-muted">{children}</p>
        </div>
      </div>
    </div>
  );
}
