"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// for-claude-code-trainee-assessor-card-system.md / Trainee Walkthrough.dc.html:
// a left "Workspace" rail, not TraineeTopNav's horizontal tabs -- and a
// genuinely different grouping, not just a different shape for the same six
// destinations. Course Stream covers Today, the read-only Timetable, and
// tutorial booking (all reached via in-page links/buttons from Today, same
// as the mockup's own "My timetable" action button -- there's no separate
// top-level Timetable entry). Teaching Practice covers both the overview and
// a single lesson's detail page. CELTA 5 is its own destination here,
// alongside Progress, matching the mockup's seven items exactly.
const SIDEBAR_TABS = [
  { href: "", label: "Course Stream", alsoMatch: ["/timetable", "/individual-tutorial", "/stage2-tutorial"] },
  { href: "/pre-course-task", label: "Pre-course task" },
  { href: "/resources", label: "Resource Hub" },
  { href: "/tp", label: "Teaching Practice" },
  { href: "/assignments", label: "Written Assignments" },
  { href: "/celta5", label: "CELTA 5" },
  { href: "/progress", label: "Progress" },
] as const;

// Desktop only (`hidden md:flex`), same breakpoint TraineeTopNav used --
// TraineeMobileNav's own bottom bar (unrelated, unchanged) covers narrow
// viewports with its own simpler six-item set.
export function TraineeSidebarNav({ traineeId }: { traineeId: string }) {
  const pathname = usePathname();
  const base = `/portfolio/${traineeId}`;

  return (
    <div className="hidden w-[232px] shrink-0 flex-col gap-px py-1 md:flex">
      <div className="px-2.5 pb-2.5 text-[10px] font-bold tracking-[0.12em] text-muted uppercase">Workspace</div>
      {SIDEBAR_TABS.map((tab) => {
        const href = `${base}${tab.href}`;
        const alsoMatch = "alsoMatch" in tab ? tab.alsoMatch : [];
        const active =
          tab.href === ""
            ? pathname === href || alsoMatch.some((extra) => pathname.startsWith(`${base}${extra}`))
            : pathname.startsWith(href);
        return (
          <Link
            key={tab.href}
            href={href}
            className={`rounded-[6px] border-l-[3px] px-2.5 py-2 text-[13px] ${
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
