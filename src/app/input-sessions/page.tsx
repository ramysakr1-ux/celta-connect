import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { INPUT_SESSIONS } from "@/app/input-sessions/registry";
import { viewerHubAccent } from "@/lib/hub-accent";

// Fixed content, reachable by anyone on a real course (trainer, admin, or
// trainee) -- not nested under /portfolio/[traineeId] or /trainer since
// nothing here is per-candidate data, same reasoning as the GTKY bank
// staying out of the resource-hub's per-centre upload model.
export default async function InputSessionsIndexPage({ searchParams }: { searchParams: Promise<{ back?: string }> }) {
  const session = await getCurrentProfile();
  if (!session?.profile) redirect("/login");

  const { back } = await searchParams;
  const backHref = back && back.startsWith("/") && !back.startsWith("//") ? back : null;
  const query = backHref ? `?back=${encodeURIComponent(backHref)}` : "";

  // Ramy, 6 Sep 2026: "when you open input sessions, and the ring -- does the
  // colour need to be consistent?" It does. This page is a door out of the
  // Resource hub, so a tutor arriving from a garnet hub should not have the
  // ring turn teal under them. A candidate gets nothing set and keeps the
  // platform teal: role colour is the tutor's identity and means nothing to
  // them. Only the ROW hover is role-coloured -- the teal inside a session
  // (revealed answers, correct matches) is content, not identity, and garnet
  // on a correct answer would read as an error.
  const role = await viewerHubAccent(session.profile);

  return (
    <div
      className="mx-auto flex max-w-3xl flex-col gap-6 p-6 sm:p-10"
      style={
        role
          ? ({
              "--hub-accent": role.accent,
              "--hub-accent-deep": role.accentDeep,
              // globals.css already defaults this to teal at :root, so a
              // candidate needs nothing set and still gets the platform ring.
              "--hub-row-shadow": `inset 0 0 0 1px ${role.accent}, 0 3px 8px -3px color-mix(in oklab, ${role.accent} 45%, transparent)`,
            } as React.CSSProperties)
          : undefined
      }
    >
      <div>
        {backHref ? (
          <BackLink href={backHref} label={"Resource hub"} />
        ) : null}
        <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Resource hub</p>
        <h1 className="mt-1 font-serif text-2xl text-ink">Input sessions</h1>
        <p className="mt-2 text-sm text-muted">Interactive versions of the centre&apos;s input sessions — the same content whether you&apos;re running one or working through it.</p>
      </div>
      <div className="flex flex-col gap-2">
        {INPUT_SESSIONS.map((s) => (
          <Link
            key={s.slug}
            href={`/input-sessions/${s.slug}${query}`}
            className="trainer-hover flex items-center justify-between gap-4 rounded-[8px] border border-border bg-card px-4 py-3"
          >
            <div>
              <p className="text-sm font-semibold text-ink">{s.title}</p>
              <p className="text-xs text-muted">{s.kind}</p>
            </div>
            <p className="text-xs text-muted">{s.minutes}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
