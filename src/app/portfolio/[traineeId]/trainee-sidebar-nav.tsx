"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

// for-claude-code-trainee-assessor-card-system.md / Trainee Walkthrough.dc.html:
// a left "Workspace" rail, not TraineeTopNav's horizontal tabs -- and a
// genuinely different grouping, not just a different shape for the same
// destinations. Course Stream covers Today, the read-only Timetable, and
// tutorial booking (all reached via in-page links/buttons from Today, same
// as the mockup's own "My timetable" action button -- there's no separate
// top-level Timetable entry). Teaching Practice covers both the overview and
// a single lesson's detail page. CELTA 5 is its own destination here --
// it absorbed Progress on 29 Aug 2026, see the note on that entry below.
// Ramy, 28 Aug 2026: "I don't think we need a shortcut to pre-course task,
// because this is something that they will not use during the course" --
// dropped as its own sidebar item (it's still a real route, just reached
// through the Today landing page's hero/Waiting-on-you cards instead of a
// standing nav entry for something only relevant before day one).
const SIDEBAR_TABS = [
  { href: "", label: "Course Stream", alsoMatch: ["/timetable", "/individual-tutorial", "/stage2-tutorial"] },
  { href: "/resources", label: "Resource Hub" },
  { href: "/tp", label: "Teaching Practice" },
  { href: "/assignments", label: "Written Assignments" },
  // Ramy, 29 Aug 2026: "CELTA 5 at the bottom where you're working on it,
  // and then something says Progress, and it's exactly the same. We don't
  // need both."
  //
  // He is right, and the Progress page's own comment already conceded it:
  // "some query logic is duplicated with celta5/page.tsx's trainee branch
  // -- an accepted tradeoff." Same self-assessment block, same observation
  // tasks, same observations of experienced teachers. CELTA 5 is the
  // superset (criteria matrix, the three stages, signatures, attendance,
  // absences), so it is the one that stays. The /progress route still
  // exists and still works if linked directly; it is just not a tab.
  { href: "/celta5", label: "CELTA 5" },
] as const;

// Desktop only (`hidden md:flex`), same breakpoint TraineeTopNav used --
// TraineeMobileNav's own bottom bar (unrelated, unchanged) covers narrow
// viewports with its own simpler six-item set.
export function TraineeSidebarNav({ traineeId }: { traineeId: string }) {
  const pathname = usePathname();
  // A room (Resource Hub, and any later one) hides this rail entirely, so
  // there is nothing to bracket while you are inside it. Coming out, the
  // rail would otherwise snap to Course Stream -- as if you had never been
  // anywhere. Ramy, 30 Aug 2026: "when you come out of the room, you're at
  // the door." The room's back link carries ?from=/resources and the
  // bracket stays on that door for the one render you arrive on; clicking
  // anything clears it, because by then you have walked away from the door.
  const cameFrom = useSearchParams()?.get("from") ?? null;
  const base = `/portfolio/${traineeId}`;

  return (
    <div className="hidden w-[232px] shrink-0 flex-col gap-px border-r border-border py-1 pr-4 md:flex">
      <div className="px-2.5 pb-2.5 text-[10px] font-bold tracking-[0.12em] text-muted uppercase">Workspace</div>
      {SIDEBAR_TABS.map((tab) => {
        const href = `${base}${tab.href}`;
        const alsoMatch = "alsoMatch" in tab ? tab.alsoMatch : [];
        const atThisDoor = cameFrom !== null && cameFrom === tab.href;
        const anyDoorOpen = cameFrom !== null && SIDEBAR_TABS.some((t) => t.href === cameFrom);
        const active = anyDoorOpen
          ? atThisDoor
          : tab.href === ""
            ? pathname === href || alsoMatch.some((extra) => pathname.startsWith(`${base}${extra}`))
            : pathname.startsWith(href);
        return (
          <Link
            key={tab.href}
            href={href}
            // trainee-hover-fill, not the ring: these are tab-like bounded
            // controls, which is the half of the 24 Aug rule that takes a
            // fill. They had only hover:text-ink, so the rail was the one
            // part of the trainee's chrome that did not respond to the
            // pointer at all.
            className={`trainee-hover-fill rounded-[6px] border-l-[3px] px-2.5 py-2 text-[13px] transition-colors ${
              active ? "border-l-primary font-semibold text-primary" : "border-l-transparent font-medium text-muted hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
