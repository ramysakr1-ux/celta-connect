// The candidate's rooms, named once (trainee workspace A1, 16 Sep 2026).
//
// Three navigations listed the same destinations and disagreed about them:
// the desktop rail had five, the mobile bar six (with Progress, and "Today"
// for Course Stream), and the staff PortfolioTabs seven (adding Pre-course
// task and Progress). Two of those extra doors had already been retired in
// conversation and stayed in the markup:
//
//   - Progress, 29 Aug 2026: "CELTA 5 at the bottom where you're working on
//     it, and then something says Progress, and it's exactly the same. We
//     don't need both." CELTA 5 is the superset, so it is the one that stays
//     and /progress is a redirect now (A2).
//   - Pre-course task, 28 Aug 2026: "I don't think we need a shortcut to
//     pre-course task, because this is something that they will not use
//     during the course." It had left the rail and stayed on the staff list.
//
// shortLabel is for the phone bar, where "Written Assignments" cannot fit.
export const WORKSPACE_TABS = [
  {
    href: "",
    label: "Course Stream",
    shortLabel: "Today",
    metaKey: "courseStream",
    // Course Stream covers Today, the read-only timetable and tutorial
    // booking -- all reached from Today itself.
    alsoMatch: ["/timetable", "/individual-tutorial", "/stage2-tutorial"],
  },
  { href: "/resources", label: "Resource Hub", shortLabel: "Resources", metaKey: "resourceHub", alsoMatch: [] },
  { href: "/tp", label: "Teaching Practice", shortLabel: "My teaching", metaKey: "tp", alsoMatch: [] },
  { href: "/assignments", label: "Written Assignments", shortLabel: "Assignments", metaKey: "assignments", alsoMatch: [] },
  { href: "/celta5", label: "CELTA 5", shortLabel: "CELTA 5", metaKey: "celta5", alsoMatch: [] },
] as const;

export type WorkspaceTab = (typeof WORKSPACE_TABS)[number];
export type WorkspaceMetaKey = WorkspaceTab["metaKey"];

// The one destination the phone keeps that the rail does not: on a phone the
// timetable is a daily glance, and Course Stream is a scroll away from it.
export const MOBILE_EXTRA_TABS = [{ href: "/timetable", label: "Timetable", shortLabel: "Timetable" }] as const;

/** The phone bar: the rooms in the rail's order, with the timetable second. */
export const MOBILE_TABS = [
  WORKSPACE_TABS[0],
  MOBILE_EXTRA_TABS[0],
  WORKSPACE_TABS[2],
  WORKSPACE_TABS[3],
  WORKSPACE_TABS[1],
  WORKSPACE_TABS[4],
] as const;

export function isTabActive(pathname: string, base: string, tab: { href: string; alsoMatch?: readonly string[] }): boolean {
  if (tab.href === "") {
    return pathname === base || (tab.alsoMatch ?? []).some((extra) => pathname.startsWith(`${base}${extra}`));
  }
  return pathname.startsWith(`${base}${tab.href}`);
}
