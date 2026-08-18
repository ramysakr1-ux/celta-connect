"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Today is the (hub) group's own index page (bare /trainer) -- not part of
// TABS/rosterOnly's slice-based logic below since it never shows for
// assessor sessions (checkpoint 2: Today is trainer-only operational
// material -- write actions, cohort-wide alerts -- same boundary already
// drawn for the rest of TABS vs. Grades Report).
const TODAY_TAB = { href: "", label: "Today" } as const;

const TABS = [
  { href: "/roster", label: "Roster" },
  { href: "/timetable", label: "Timetable" },
  { href: "/volunteers", label: "Volunteers" },
  // /rotation and /coursebooks are still real routes (the two cards on
  // this tab link into them) -- matched here too so the tab still reads
  // as active once you've clicked through into either one.
  { href: "/tp", label: "Teaching Practice", alsoMatch: ["/rotation", "/coursebooks"] },
  // build-spec.md: "Replace the Audio Library tab with a Resource hub tab."
  // /audio and /coursebooks keep working as direct routes (linked from the
  // hub's own cards) -- only the top-nav tab itself moved.
  { href: "/resource-hub", label: "Resource hub", alsoMatch: ["/audio"] },
  { href: "/trainer-in-training", label: "Trainer-in-Training" },
] as const;

// Grades Report is assessor-facing material, not an operational trainer
// tool -- unlike the rest of TABS, it stays visible for assessor sessions
// (rosterOnly) too.
const GRADES_REPORT_TAB = { href: "/grades-report", label: "Grades Report" } as const;

// Same route as the trainer's own "Volunteers" tab (TABS[2]) -- checkpoint
// 9 (Assessor pack) gave /volunteers a read-only branch for assessor
// sessions, but "Volunteers" reads like a management tool a trainer would
// use; the assessor's own vocabulary (build-spec.md item 14) is "the
// attendance register," so this tab gets its own label pointing at the
// identical URL rather than reusing TABS[2]'s.
const ATTENDANCE_REGISTER_TAB = { href: "/volunteers", label: "Attendance register" } as const;

export function TrainerTabs({ rosterOnly = false }: { rosterOnly?: boolean }) {
  const pathname = usePathname();
  const tabs = rosterOnly ? [TABS[0], ATTENDANCE_REGISTER_TAB, GRADES_REPORT_TAB] : [TODAY_TAB, ...TABS, GRADES_REPORT_TAB];

  // No wrapper bar of its own any more -- this is now inlined directly into
  // the (hub) shell's single header (see (hub)/layout.tsx), which supplies
  // the h-full/items-stretch row this relies on to make the active tab's
  // 2px underline land flush with the header's own bottom hairline.
  return (
    <div className="flex h-full items-center gap-6">
      {tabs.map((tab) => {
        const href = `/trainer${tab.href}`;
        const alsoMatch = "alsoMatch" in tab ? tab.alsoMatch : [];
        // Today's href is "" -> /trainer, which every other tab's pathname
        // ALSO starts with -- needs an exact match or it shows active
        // everywhere, same footgun portfolio-tabs.tsx already special-cases
        // for its own href:"" tab.
        const active =
          tab.href === ""
            ? pathname === href
            : pathname.startsWith(href) || alsoMatch.some((extra) => pathname.startsWith(`/trainer${extra}`));
        return (
          <Link
            key={tab.href}
            href={href}
            className={`flex h-full items-center border-b-2 text-sm font-medium ${
              active ? "border-primary text-primary" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
