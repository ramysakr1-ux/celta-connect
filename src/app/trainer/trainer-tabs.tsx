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
] as const;

// Visible only to the people the record concerns: the trainer-in-training,
// their supervisor, the MCT, anyone the MCT has granted, and a touring
// assessor (view-only). Ramy, 4 Sep 2026: "trainer in training will only
// appear if there is one" -- and only to those people. The (hub) layout
// decides (`tint` prop); migration 0267's tit_access_grants is the source.
const TINT_TAB = { href: "/trainer-in-training", label: "Trainer-in-Training" } as const;

// Grades Report is assessor-facing material, not an operational trainer
// tool -- unlike the rest of TABS, it stays visible for assessor sessions
// (rosterOnly) too.
const GRADES_REPORT_TAB = { href: "/grades-report", label: "Grade form" } as const;

// Same route as the trainer's own "Volunteers" tab (TABS[2]) -- checkpoint
// 9 (Assessor pack) gave /volunteers a read-only branch for assessor
// sessions, but "Volunteers" reads like a management tool a trainer would
// use; the assessor's own vocabulary (build-spec.md item 14) is "the
// attendance register," so this tab gets its own label pointing at the
// identical URL rather than reusing TABS[2]'s.
const ATTENDANCE_REGISTER_TAB = { href: "/volunteers", label: "Attendance register" } as const;

// MCT only. The assessor visit is the main course tutor's to run -- an ACT
// has no assessor contact to set and no pack to hand over -- so the tab is
// absent rather than present-and-empty for them (Ramy, 5 Sep 2026: "the
// assessor is just for the MCT"). Sits between Teaching Practice and
// Resource hub, the order he set: "assessor, resource hub, grade form".
const ASSESSOR_TAB = { href: "/assessor", label: "Assessor" } as const;

// for-claude-code-assessor-tour-mode.md: a touring assessor gets the real
// trainer tab set, not the pack's own trimmed one -- but only for the
// areas actually widened for an assessor session (Today, Roster,
// Timetable, Volunteers, Resource hub, Grades Report, and
// Trainer-in-Training when the course has one). Teaching Practice isn't in
// that list on purpose -- it was never widened to accept an assessor
// session, and a tour tab that dead-ends at a login redirect would be
// worse than one that's just not there.
//
// Look: design_handoff_trainer_homepage_v4 README, "Header (56px, white,
// 1px bottom border)": tabs 13px, padding 7px 11px, radius 6px, nowrap;
// active = cream bg + role accent-deep text, 700; hover = cream bg. The
// container hides overflow so the row never wraps. Role accent comes from
// the (hub) layout's --hub-accent-deep (garnet for MCT, gold for ACT, teal
// for an assessor session).
export function TrainerTabs({
  rosterOnly = false,
  tourMode = false,
  mct = false,
  tint = false,
}: {
  rosterOnly?: boolean;
  tourMode?: boolean;
  /** Main course tutor on the open course: adds the Assessor tab. */
  mct?: boolean;
  /** This person may see the course's trainer-in-training record. */
  tint?: boolean;
}) {
  const pathname = usePathname();
  const tabs = rosterOnly
    ? [TABS[0], ATTENDANCE_REGISTER_TAB, GRADES_REPORT_TAB]
    : tourMode
      ? [TODAY_TAB, TABS[0], TABS[1], TABS[2], TABS[4], ...(tint ? [TINT_TAB] : []), GRADES_REPORT_TAB]
      : [TODAY_TAB, TABS[0], TABS[1], TABS[2], TABS[3], ...(mct ? [ASSESSOR_TAB] : []), TABS[4], ...(tint ? [TINT_TAB] : []), GRADES_REPORT_TAB];

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
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
            className={`shrink-0 rounded-[6px] px-[11px] py-[7px] text-[13px] whitespace-nowrap transition-colors duration-150 ${
              active ? "bg-card-inset font-bold" : "font-medium text-muted hover:bg-card-inset hover:text-ink"
            }`}
            style={active ? { color: "var(--hub-accent-deep)" } : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
