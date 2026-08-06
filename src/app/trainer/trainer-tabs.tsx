"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/roster", label: "Roster" },
  { href: "/timetable", label: "Timetable" },
  { href: "/volunteers", label: "Volunteers" },
  // /rotation and /coursebooks are still real routes (the two cards on
  // this tab link into them) -- matched here too so the tab still reads
  // as active once you've clicked through into either one.
  { href: "/tp", label: "Teaching Practice", alsoMatch: ["/rotation", "/coursebooks"] },
  { href: "/audio", label: "Audio Library" },
] as const;

// Grades Report is assessor-facing material, not an operational trainer
// tool -- unlike the rest of TABS, it stays visible for assessor sessions
// (rosterOnly) too.
const GRADES_REPORT_TAB = { href: "/grades-report", label: "Grades Report" } as const;

export function TrainerTabs({ rosterOnly = false }: { rosterOnly?: boolean }) {
  const pathname = usePathname();
  const tabs = rosterOnly ? [TABS[0], GRADES_REPORT_TAB] : [...TABS, GRADES_REPORT_TAB];

  return (
    <div className="border-b border-border bg-card">
      <div className="container flex gap-8">
        {tabs.map((tab) => {
          const href = `/trainer${tab.href}`;
          const alsoMatch = "alsoMatch" in tab ? tab.alsoMatch : [];
          const active = pathname.startsWith(href) || alsoMatch.some((extra) => pathname.startsWith(`/trainer${extra}`));
          return (
            <Link
              key={tab.href}
              href={href}
              className={`border-b-2 py-3 text-sm font-medium ${
                active ? "border-primary text-primary" : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
