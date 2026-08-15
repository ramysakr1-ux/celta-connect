"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// for-claude-code-trainee-interface.md's 5-tab nav (Today, Timetable, My
// teaching, Assignments, Resources), plus a 6th kept per Ramy's own call
// (2026-08-15) on the spec's "no grades tab" line: the underlying grade
// itself is already hidden from trainees at the DB layer (get_my_celta5_
// record(), migration 0034) -- what actually lives under this tab is
// required certification workflow (Stage 2 self-assessment/sign-off,
// observation-hours logging), not a grade display, so it keeps a real tab
// rather than being buried in links only. Route path stays /celta5
// (unchanged, avoids a link-rot churn); only the visible label changes.
// Shared with trainee-mobile-nav.tsx's bottom tab bar -- same 6
// destinations, two different chrome shapes (desktop top tabs vs. mobile
// bottom bar), one list.
export const TRAINEE_NAV_TABS = [
  { href: "", label: "Today" },
  { href: "/timetable", label: "Timetable" },
  { href: "/tp", label: "My teaching" },
  { href: "/assignments", label: "Assignments" },
  { href: "/resources", label: "Resources" },
  { href: "/celta5", label: "Progress" },
] as const;

export function isTraineeTabActive(pathname: string, base: string, tabHref: string): boolean {
  return tabHref === "" ? pathname === base : pathname.startsWith(`${base}${tabHref}`);
}

// Only rendered for a real trainee viewing their own portfolio (see
// layout.tsx's isStaffView branch) -- staff/assessor viewing a candidate
// keep the existing PortfolioTabs sidebar, a deliberately different tool
// for a different job (browsing one candidate's whole record vs. a
// trainee's own daily briefing). Desktop/tablet only (`hidden md:flex`) --
// below `md`, trainee-mobile-nav.tsx's bottom tab bar takes over instead of
// shrinking this into an unusable six-item horizontal squeeze.
export function TraineeTopNav({ traineeId }: { traineeId: string }) {
  const pathname = usePathname();
  const base = `/portfolio/${traineeId}`;

  return (
    <nav className="hidden h-full items-center gap-6 md:flex">
      {TRAINEE_NAV_TABS.map((tab) => {
        const href = `${base}${tab.href}`;
        const active = isTraineeTabActive(pathname, base, tab.href);
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
    </nav>
  );
}
