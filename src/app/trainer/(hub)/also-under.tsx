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
  // Ramy, 5 Sep 2026: no "Also under" label, no arrows ("where is that
  // arrow pointing?"), a pill with a permanent colour, a little bigger.
  // Soft gold, the same tint as the announcement template pill, so every
  // sub-page door in the hub is one recognisable thing; hover = the role
  // ring like every other door. `tab` is kept for the accessible name.
  return (
    <div className="flex flex-wrap gap-2" aria-label={`Also under ${tab}`}>
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className="trainer-hover inline-flex h-9 items-center rounded-full border px-4 text-[13px] font-semibold"
          style={{
            background: "color-mix(in oklab, var(--color-gold) 18%, var(--color-card))",
            borderColor: "color-mix(in oklab, var(--color-gold) 45%, transparent)",
            color: "oklch(40% 0.09 68)",
          }}
        >
          {l.label}
        </Link>
      ))}
    </div>
  );
}
