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
  // B4, live audit 15 Sep 2026: that colour was soft gold, which is also
  // the ACT's role accent, the Marking badge and the whole "Your day" box
  // on the MCT's Today -- four meanings for one tint. The pills sit on
  // card-inset now, one recognisable shape with no colour claim; hover =
  // the role ring like every other door. `tab` is kept for the
  // accessible name.
  return (
    <div className="flex flex-wrap gap-2" aria-label={`Also under ${tab}`}>
      {links.map((l) =>
        // A file the browser downloads (the calendar feed) or a document that
        // prints outside the hub is a plain link, not a client navigation.
        l.href.startsWith("/api/") ? (
          <a
            key={l.href}
            href={l.href}
            className="lift inline-flex h-9 items-center rounded-full border border-border bg-card-inset px-4 text-[13px] font-semibold text-ink"

          >
            {l.label}
          </a>
        ) : (
        <Link
          key={l.href}
          href={l.href}
          className="lift inline-flex h-9 items-center rounded-full border border-border bg-card-inset px-4 text-[13px] font-semibold text-ink"

        >
          {l.label}
        </Link>
        )
      )}
    </div>
  );
}
