"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
const PATH_LABELS: { test: (p: string) => boolean; label: string }[] = [
  { test: (p) => p === "/trainer", label: "Today" },
  { test: (p) => p.startsWith("/trainer/grades-report"), label: "Grades report" },
  { test: (p) => p.startsWith("/trainer/roster"), label: "Roster" },
  { test: (p) => p.startsWith("/trainer/volunteers"), label: "Attendance register" },
  { test: (p) => p.startsWith("/trainer/timetable"), label: "Timetable" },
  { test: (p) => p.startsWith("/trainer/resource-hub"), label: "Resource hub" },
  { test: (p) => p.startsWith("/trainer/tp"), label: "Teaching Practice" },
  { test: (p) => p.startsWith("/trainer/rotation"), label: "Rotation" },
  { test: (p) => p.startsWith("/trainer/coursebooks"), label: "Coursebooks" },
  { test: (p) => p.startsWith("/trainer/trainer-in-training"), label: "Trainer-in-Training" },
  // Portfolio routes: matched before the generic fallback so a bare
  // /portfolio/[id] (last segment is the trainee's uuid) never ends up
  // humanized into gibberish.
  { test: (p) => /^\/portfolio\/[^/]+$/.test(p), label: "Portfolio overview" },
  { test: (p) => /^\/portfolio\/[^/]+\/assignments(\/|$)/.test(p), label: "Assignments" },
  { test: (p) => /^\/portfolio\/[^/]+\/celta5$/.test(p), label: "CELTA 5 record" },
  { test: (p) => /^\/portfolio\/[^/]+\/progress$/.test(p), label: "Progress" },
  { test: (p) => /^\/portfolio\/[^/]+\/tp(\/|$)/.test(p), label: "Teaching practice" },
  { test: (p) => /^\/portfolio\/[^/]+\/resources$/.test(p), label: "Resources" },
  { test: (p) => /^\/portfolio\/[^/]+\/pre-course-task$/.test(p), label: "Pre-course task" },
  { test: (p) => /^\/portfolio\/[^/]+\/timetable$/.test(p), label: "Timetable" },
];

function labelForPath(pathname: string): string {
  const known = PATH_LABELS.find((p) => p.test(pathname));
  if (known) return known.label;
  const last = pathname.split("/").filter(Boolean).pop() ?? "";
  // A bare uuid segment (any unmatched /portfolio/[id]/... shape) reads as
  // gibberish humanized -- fall back to something honest instead.
  if (!last || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(last)) return "Content";
  return last
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function AssessorReadOnlyBanner({ subject }: { subject?: string }) {
  const pathname = usePathname();
  const pageLabel = labelForPath(pathname);
  const contextLabel = subject
    ? `You're viewing ${subject}'s ${pageLabel.toLowerCase()} as part of the assessor pack.`
    : `You're viewing the trainer's ${pageLabel.toLowerCase()} as part of the assessor pack.`;

  return (
    <div
      className="sticky top-0 z-30 flex items-center justify-between gap-4 px-5 py-2.5"
      style={{ background: "oklch(23.5% 0.017 65)" }}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className="shrink-0 rounded px-2.5 py-0.5 text-[10.5px] font-bold tracking-[0.08em] uppercase"
          style={{ color: "oklch(85% 0.02 195)", background: "color-mix(in oklab, oklch(38% 0.072 195) 40%, oklch(23.5% 0.017 65))" }}
        >
          Read-only
        </span>
        <span className="truncate text-[12.5px]" style={{ color: "oklch(88% 0.01 85)" }}>
          {contextLabel}
        </span>
      </div>
      <Link
        href="/assessor"
        className="flex shrink-0 items-center gap-1.5 rounded-md px-3.5 py-1.5 text-[12.5px] font-semibold text-white no-underline"
        style={{ background: "color-mix(in oklab, oklch(38% 0.072 195) 55%, oklch(23.5% 0.017 65))" }}
      >
        ← Back to assessor pack
      </Link>
    </div>
  );
}
