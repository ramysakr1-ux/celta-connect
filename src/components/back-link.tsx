import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// The one back control, everywhere.
//
// Ramy, 27 Aug 2026: "we need something more visually appealing than just
// an arrow heading back" -- which replaced the plain "← Label" text link
// with a bordered pill. Then 29 Aug: "it's a pill everywhere now in the
// resource hub, inside all the input sessions, inside all the other docs...
// I think we agreed it will have a bit of colour to it. Keep it
// consistent, same place, same pill, same colour, so it's easy to spot."
//
// The colour is the gold the Resource Hub masthead already used
// (oklch(60% 0.11 70) on dark ink). That pill was filled and unmissable
// while this component was a neutral grey one, so the same control looked
// like two different things depending on which page you were on.
//
// Gold is the app's sparing accent -- the wordmark, Pass A, the JOIN pill.
// Back belongs with them: it is the one control a candidate reaches for
// when they are lost, and it should be findable without hunting.
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      // self-start and w-fit because inline-flex does not protect a flex
      // ITEM from stretching: dropped straight into a `flex flex-col`
      // parent -- which is how the TP lesson-plan pages use it -- the pill
      // stretched to the container's full width and rendered as a
      // full-width gold bar, while the identical pill above it sat at its
      // natural 127px. Found 31 Aug 2026 in the pre-demo sweep. Fixed here
      // rather than by wrapping each call site, so it cannot happen again
      // the next time someone drops it into a column.
      className="inline-flex w-fit shrink-0 self-start items-center gap-1.5 rounded-full px-3 py-[5px] text-[12px] font-bold transition-colors hover:brightness-95"
      style={{ background: "oklch(60% 0.11 70)", color: "oklch(23.5% 0.017 65)" }}
    >
      <ArrowLeft className="size-3.5" aria-hidden="true" />
      {label}
    </Link>
  );
}
