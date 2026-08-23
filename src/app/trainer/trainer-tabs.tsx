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

// for-claude-code-assessor-tour-mode.md: a touring assessor gets the real
// trainer tab set, not the pack's own trimmed one -- but only for the
// areas actually widened for an assessor session (Today, Roster,
// Timetable, Volunteers, Resource hub, Grades Report). Teaching Practice
// and Trainer-in-Training aren't in that list on purpose -- they were never
// widened to accept an assessor session, and a tour tab that dead-ends at
// a login redirect would be worse than one that's just not there.
export function TrainerTabs({
  rosterOnly = false,
  tourMode = false,
  dark = false,
}: {
  rosterOnly?: boolean;
  tourMode?: boolean;
  // for-claude-code-trainer-role-color-system-final.md: active tab is full-
  // opacity white + white underline, inactive ~65% opacity white, hover
  // reads --hub-hover-accent (set per-role by the (hub) layout) -- only for
  // the real MCT/ACT header, which is now a dark ink/garnet band. An
  // assessor session's header stays the plain light one this component
  // already rendered before that change, so it keeps the old primary/muted
  // treatment untouched.
  dark?: boolean;
}) {
  const pathname = usePathname();
  const tabs = rosterOnly
    ? [TABS[0], ATTENDANCE_REGISTER_TAB, GRADES_REPORT_TAB]
    : tourMode
      ? [TODAY_TAB, TABS[0], TABS[1], TABS[2], TABS[4], GRADES_REPORT_TAB]
      : [TODAY_TAB, ...TABS, GRADES_REPORT_TAB];

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
            className={
              dark
                ? `flex h-full items-center border-b-2 text-sm font-medium transition-colors duration-150 hover:text-[var(--hub-hover-accent)] hover:border-[var(--hub-hover-accent)] ${
                    active ? "border-white text-white" : "border-transparent text-[color-mix(in_oklab,white_65%,transparent)]"
                  }`
                : `flex h-full items-center border-b-2 text-sm font-medium transition-colors duration-150 ${
                    active ? "border-primary text-primary" : "border-transparent text-muted hover:border-primary/40 hover:text-primary"
                  }`
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
