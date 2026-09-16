"use client";

import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { usePathname } from "next/navigation";
import { labelForPath } from "@/lib/portfolio-page-label";

// for-claude-code-assessor-readonly-banner.md: replaces the bare "← Assessor
// pack" link marking-guidance/page.tsx and the two trainer-hub-family
// layouts used -- that link scrolls out of view on any report longer than
// one screen, so an assessor mid-scroll on Grades report had no visible way
// back again. Sticky, not fixed: pins to the top of the scroll area (this
// renders inside each layout's own content column, above everything else
// in it) without overlapping the app's own header the way a viewport-fixed
// bar would.
//
// One shared component reused across every trainer-hub page an assessor
// session reaches, per the spec's "any future ones" -- labelForPath's
// fallback (humanize the last path segment) means a page added later
// without an explicit case here still gets a reasonable label instead of
// a blank one.
export function AssessorReadOnlyBanner({ subject, portfolioHref }: { subject?: string; portfolioHref?: string }) {
  const pathname = usePathname();
  // With the candidate's workspace rail gone for assessors (Ramy, 30 Aug
  // 2026: "it should be the whole page"), this banner is the only way back
  // out of a record. Two steps, so neither is a dead end: up to the
  // candidate's portfolio, then out to the pack.
  const showPortfolioLink = Boolean(portfolioHref) && pathname !== portfolioHref;
  const pageLabel = labelForPath(pathname);
  const contextLabel = subject
    ? `You're viewing ${subject}'s ${pageLabel.toLowerCase()} as part of the assessor pack.`
    : `You're viewing the trainer's ${pageLabel.toLowerCase()} as part of the assessor pack.`;

  // for-claude-code-trainee-assessor-card-system.md: the assessor's own
  // header (Assessor Visit.dc.html) moved from a generic ink header to a
  // dedicated ink-brown + gold identity, distinct from MCT's cooler ink --
  // this banner is the same session, so it follows.
  const WARM = "oklch(30% 0.042 58)";
  const GOLD = "oklch(60% 0.11 70)";
  return (
    <div
      className="sticky top-0 z-30 flex items-center justify-between gap-4 px-5 py-2.5"
      style={{ background: WARM }}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className="shrink-0 rounded px-2.5 py-0.5 text-micro font-bold tracking-[0.08em] uppercase"
          style={{ color: WARM, background: `color-mix(in oklab, ${GOLD} 75%, transparent)` }}
        >
          Read-only
        </span>
        <span className="truncate text-meta" style={{ color: "oklch(88% 0.01 85)" }}>
          {contextLabel}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
      {showPortfolioLink ? (
        <Link
          href={portfolioHref!}
          className="flex shrink-0 items-center gap-1.5 rounded-md px-3.5 py-1.5 text-meta font-semibold no-underline"
          style={{
            color: "oklch(97% 0.008 88)",
            background: "color-mix(in oklab, oklch(97% 0.008 88) 12%, transparent)",
            border: "1px solid color-mix(in oklab, oklch(97% 0.008 88) 30%, transparent)",
          }}
        >
          ← {subject ? `${subject}'s portfolio` : "The portfolio"}
        </Link>
      ) : null}
      {/* The app's one back control, not a bespoke text link.
      
          Ramy, 30 Aug 2026: "we will need a return pill because there isn't
          one." There was one -- right here -- but it was a "← Back to
          assessor pack" text link in the banner's own colours, while every
          other way back in the app is the gold BackLink pill. He was looking
          for a pill and did not find one, which is what an inconsistent
          control costs: he had already said "same place, same pill, same
          colour, so it's easy to spot" and this was the exception.
      
          Same destination, same words, recognisable now. */}
      <div className="shrink-0">
        <BackLink href="/assessor" label="Assessor pack" />
      </div>
      </div>
    </div>
  );
}
