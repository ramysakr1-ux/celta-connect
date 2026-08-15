"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TRAINEE_NAV_TABS, isTraineeTabActive } from "@/app/portfolio/[traineeId]/trainee-top-nav";

// specs/build-spec.md §7: the trainee is the one role using this daily for
// five weeks, some "have no laptop" -- the six-tab TraineeTopNav (built for
// desktop, gap-6 horizontal) has no room to breathe below ~700px, so this
// is a genuinely different chrome shape for the same 6 destinations, not a
// squeeze of the same one. Fixed bottom bar, one tab per column, safe-area
// padding for the iOS home-indicator strip. `md:hidden` -- the desktop nav
// takes over at md and above (TraineeTopNav is `hidden md:flex`), so
// exactly one of the two ever renders.
export function TraineeMobileNav({ traineeId }: { traineeId: string }) {
  const pathname = usePathname();
  const base = `/portfolio/${traineeId}`;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-6 border-t border-border bg-card md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {TRAINEE_NAV_TABS.map((tab) => {
        const href = `${base}${tab.href}`;
        const active = isTraineeTabActive(pathname, base, tab.href);
        return (
          <Link
            key={tab.href}
            href={href}
            className={`flex h-14 flex-col items-center justify-center gap-0.5 text-center text-[10px] leading-tight font-medium ${
              active ? "text-primary" : "text-muted"
            }`}
          >
            <span className={`size-1.5 rounded-full ${active ? "bg-primary" : "bg-transparent"}`} />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
