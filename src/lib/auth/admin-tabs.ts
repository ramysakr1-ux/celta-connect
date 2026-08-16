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
  if (canView(roles, "admissions.view")) tabs.push({ href: "/admissions", label: "Admissions" });
  if (canView(roles, "courseAdmin.view")) tabs.push({ href: "/admin/coursebooks", label: "TP Points Library" });
  // What the centre sends in its own name. Gated on admissions visibility
  // rather than settings: the people who write to candidates are the ones who
  // need to see what those emails actually look like.
  if (canView(roles, "admissions.view")) tabs.push({ href: "/admin/email-preview", label: "Emails" });
  if (can(roles, "centre.settings.edit")) tabs.push({ href: "/admin/settings", label: "Settings" });

  return tabs;
}
