import { canView, can, type CentreRole } from "@/lib/auth/centre-permissions";

export interface AdminTab {
  href: string;
  label: string;
}

/**
 * Which admin nav tabs this person gets, decided by the Centre Admin
 * permission layer rather than role === "admin". The spec's read-only role is
 * structural -- "the buttons simply are not there" -- and a nav tab is a
 * button, so a Centre manager gets the screens they may read and nothing else.
 *
 * Deliberately NOT in admin-tabs.tsx: that file is "use client", and a server
 * component cannot call a function exported from a client module. Computing
 * this next to the session and passing the result down keeps the permission
 * check on the server, where it belongs.
 */
export function visibleAdminTabs(roles: CentreRole[]): AdminTab[] {
  const tabs: AdminTab[] = [];

  // Centre Admin's three tabs live in its OWN chrome now (src/app/centre/
  // centre-tabs.tsx), outside /dashboard -- the layout spec gives that screen
  // its own header and tab bar. What remains here is the Course Admin side.

  // Course Admin's screen and the shared centre material. A Centre manager may
  // read the course admin screen but not act on it, so the tab stays.
  if (canView(roles, "courseAdmin.view")) tabs.push({ href: "/admin", label: "Course admin" });
  if (canView(roles, "courseAdmin.view")) tabs.push({ href: "/admin/coursebooks", label: "TP Points Library" });
  if (can(roles, "centre.settings.edit")) tabs.push({ href: "/admin/settings", label: "Settings" });

  // Corrected 2026-08-20: Admissions and Emails (candidate-communication
  // preview) were showing here too, both gated on the same admissions.view
  // capability -- but for-claude-code-course-admin.md is explicit: "Not
  // covered here -- separate spec needed: Centre Admin proper: ...
  // admissions pipeline oversight... Do not build these into Course Admin."
  // Admissions already has its own real home (Centre Admin's Overview links
  // to /dashboard/admissions as a card) -- it doesn't need a second,
  // competing entry point inside Course Admin's own chrome.

  return tabs;
}
