// The trainee's mobile bottom-tab-bar destinations. Desktop nav is
// TraineeSidebarNav's own separate, differently-grouped seven-item rail
// (Trainee Walkthrough.dc.html) -- this six-item set is mobile-only now,
// kept simple since "Pre-course task"/"Written Assignments"/"Resource
// Hub"/"CELTA 5" as full labels would be unreadable crammed into a bottom
// bar. Route repointed 2026-08-19 (for-claude-code-progress-tab-build.md)
// from /celta5 to /progress -- /celta5 still holds real actions /progress
// doesn't duplicate (sign-off once the matrix is released, Stage 3's
// tutor assessment, the final report download), reached from /progress's
// own links rather than losing access to them here.
export const TRAINEE_NAV_TABS = [
  { href: "", label: "Today" },
  { href: "/timetable", label: "Timetable" },
  { href: "/tp", label: "My teaching" },
  { href: "/assignments", label: "Assignments" },
  { href: "/resources", label: "Resources" },
  { href: "/progress", label: "Progress" },
] as const;

export function isTraineeTabActive(pathname: string, base: string, tabHref: string): boolean {
  return tabHref === "" ? pathname === base : pathname.startsWith(`${base}${tabHref}`);
}
