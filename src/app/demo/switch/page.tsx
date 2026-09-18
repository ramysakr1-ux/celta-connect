import Link from "next/link";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/wordmark";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { CopyDemoLink } from "@/app/demo/switch/copy-demo-link";

// The one screen between a real session and a demo door.
//
// Ramy, 18 Sep 2026: "why does my Connect shortcut now take me to Diane
// Okonkwo... instead of the command center?" Because a demo link signs you
// in as that person for real, and the installed app shares Chrome's cookies
// with every other tab. He asked for the demo links to open in incognito or
// another Chrome profile; no web page can do that, so this does the next
// honest thing -- says what is about to happen, and hands over the link to
// paste into a private window if that is what he wanted.
//
// Only reached when somebody signed in to a REAL centre opens a demo door
// (demo-session-guard.ts). A visitor already on the demo centre, or signed
// in to nothing, goes straight through.
export const metadata = { title: "Open the demo?" };

export default async function DemoSwitchPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; name?: string; centre?: string }>;
}) {
  const { next, name, centre } = await searchParams;
  const target = safeRedirectPath(next, "");
  if (!target || !target.startsWith("/demo/")) redirect("/demo/story");

  return (
    <div className="entry-ground flex min-h-screen flex-1 flex-col">
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="frame w-full max-w-lg p-3">
          <div className="sheet-entry p-8">
            <Wordmark size="hero" />
            <h1 className="mt-4 font-serif text-h2 text-ink">This signs you out of your own account</h1>
            <p className="mt-3 text-body text-muted">
              The demo signs you in as one of its people for real. You are signed in as{" "}
              <span className="font-semibold text-ink">{name ?? "yourself"}</span>
              {centre ? (
                <>
                  {" "}
                  at <span className="font-semibold text-ink">{centre}</span>
                </>
              ) : null}
              , and opening this will replace that here and in an installed Connect, which shares the same browser.
            </p>
            <p className="mt-3 text-body text-muted">
              To keep both, open the demo in a private window instead. Copy the link, then paste it into a new incognito
              window or a second Chrome profile.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              <Link
                href={target}
                className="inline-flex h-10 items-center rounded-[8px] bg-primary px-4 text-body font-semibold text-primary-foreground"
              >
                Open the demo here
              </Link>
              <CopyDemoLink path={target} />
              <Link href="/demo/story" className="wash inline-flex h-10 items-center rounded-[8px] px-3 text-body text-ink">
                Back to the story
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
