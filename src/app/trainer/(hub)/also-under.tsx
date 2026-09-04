import Link from "next/link";

// The pill row under a tab's header: the occasional pages that belong to
// this tab and are reached only from it.
//
// unpacking-the-kitchen-sink.md, Phase 2: "Tab = returned to during a
// course; sub-page = occasional, reached from its owning tab. Every tab
// gets an 'Also under …' pill row." One door per thing (Ramy, 31 Aug
// 2026): a page listed here is not also a header button or an inline link
// on the same tab. Renders nothing when there is nothing -- no
// reassurance copy.
export function AlsoUnder({ tab, links }: { tab: string; links: { href: string; label: string }[] }) {
  if (links.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span className="text-[10.5px] font-bold tracking-[0.11em] text-muted uppercase">Also under {tab}</span>
      <div className="flex flex-wrap gap-1.5">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-full border border-border px-2.5 py-1 text-[12px] text-muted transition-colors hover:border-[var(--hub-accent)] hover:text-ink"
          >
            {l.label} &rarr;
          </Link>
        ))}
      </div>
    </div>
  );
}
