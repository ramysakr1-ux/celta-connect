"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { RailStatus } from "@/lib/trainee-rail-status";

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
export function TraineeSidebarNav({ traineeId, status }: { traineeId: string; status?: RailStatus | null }) {
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
        const door = status?.byHref[tab.href] ?? null;
        return (
          <Link
            key={tab.href}
            href={href}
            // trainee-hover-fill, not the ring: these are tab-like bounded
            // controls, which is the half of the 24 Aug rule that takes a
            // fill. They had only hover:text-ink, so the rail was the one
            // part of the trainee's chrome that did not respond to the
            // pointer at all.
            className={`trainee-hover-fill flex flex-col gap-px rounded-[6px] border-l-[3px] px-2.5 py-[9px] transition-colors ${
              active ? "border-l-primary font-semibold text-primary" : "border-l-transparent font-medium text-muted hover:text-ink"
            }`}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="text-[13px]">{tab.label}</span>
              {/* design_handoff_trainee_landing: a gold dot on any door with
                  something live today. It is the only thing in the rail that
                  is allowed to be gold, so it stays legible as "look here". */}
              {door?.live ? <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-gold" /> : null}
            </span>
            {door ? (
              <span
                className={`text-[11.5px] leading-[1.35] font-normal ${door.urgent ? "text-garnet" : "text-muted"}`}
              >
                {door.status}
              </span>
            ) : null}
          </Link>
        );
      })}
      {status && (status.weekNumber || status.tpNumber) ? (
        <div className="mt-auto border-t border-border pt-3.5">
          <div className="flex justify-between px-0.5 pb-[7px] text-[11px] tabular-nums text-muted">
            <span>{status.weekNumber && status.weekTotal ? `Week ${status.weekNumber} of ${status.weekTotal}` : ""}</span>
            <span>{status.tpNumber && status.tpTotal ? `TP${status.tpNumber} of ${status.tpTotal}` : ""}</span>
          </div>
          {status.weekTotal ? (
            <div className="flex gap-[3px] px-0.5">
              {Array.from({ length: status.weekTotal }).map((_, i) => {
                const n = i + 1;
                const week = status.weekNumber ?? 0;
                return (
                  <span
                    key={n}
                    className={`h-[3px] flex-1 rounded-[2px] ${n < week ? "bg-primary" : n === week ? "bg-gold" : "bg-border"}`}
                  />
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
