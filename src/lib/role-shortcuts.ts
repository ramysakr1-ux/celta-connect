// The six role shortcuts (design_handoff_role_shortcuts, 17 Sep 2026):
// somebody saves Connect to their desktop or dock and it opens their own
// room, with the mark in their colour and a badge letter saying whose it is.
//
// start_url is each role's front door as it exists today. A candidate's is
// /dashboard, not /portfolio: there is no bare /portfolio, and /dashboard
// resolves a signed-in trainee to /portfolio/<their id> (resolveLandingPath).
// A door that redirects is fine; one that lands on /login for a signed-in
// person is not, and none of these do.
//
// "volunteer" (Your group, /volunteer) is in the handoff's table but there
// is no such room in Connect -- the volunteer student's shortcut is the
// per-token student manifest, which uses the student set below. Its icons
// are exported all the same so the set stays whole.
export const ROLE_SHORTCUTS = {
  candidate: { label: "Candidate", startUrl: "/dashboard", theme: "#3e2818", description: "Your course, day by day." },
  "trainer-mct": { label: "Tutor", startUrl: "/trainer", theme: "#862723", description: "Today, the roster and the timetable." },
  "trainer-act": { label: "Tutor", startUrl: "/trainer", theme: "#885627", description: "Today, the roster and the timetable." },
  student: { label: "Student", startUrl: "/student", theme: "#0f4a4b", description: "Your classes, materials and hours." },
  centre: { label: "Centre", startUrl: "/centre", theme: "#241d16", description: "Courses, people and money at your centre." },
  // The platform owner, added 21 Sep 2026: Ramy's saved shortcut opened
  // someone else's room ("my home screen shortcut logs me in as a trainee
  // rather than to the command center"). Command Center declared no manifest
  // of its own, so installing from its own header handed out the generic
  // Connect app, whose start_url is the front door -- not this room.
  //
  // The only tile in the set that is not a role at a centre, and the only one
  // on a gold ground rather than a dark one, because that is what it is: the
  // platform, not a centre. Badge "C" as in Command Center -- Candidate's C
  // sits on deep brown and the two cannot be confused.
  owner: { label: "Command Center", startUrl: "/platform/command-center", theme: "#bc7300", description: "Every centre, every course, the whole platform." },
} as const;
export type RoleShortcut = keyof typeof ROLE_SHORTCUTS;

/** --color-background, oklch(92.5% 0.012 85), through Oklab. The splash
 *  screen opens on the page ground the app then paints. */
export const SPLASH_BACKGROUND = "#eae6dd";

export function roleShortcutIcons(slug: RoleShortcut | "volunteer") {
  const at = (px: number) => `/icons/connect-${slug}-${px}.png`;
  return [
    { src: at(16), sizes: "16x16", type: "image/png" },
    { src: at(32), sizes: "32x32", type: "image/png" },
    { src: at(48), sizes: "48x48", type: "image/png" },
    { src: at(192), sizes: "192x192", type: "image/png", purpose: "any" },
    { src: at(512), sizes: "512x512", type: "image/png", purpose: "any" },
    { src: at(192), sizes: "192x192", type: "image/png", purpose: "maskable" },
    { src: at(512), sizes: "512x512", type: "image/png", purpose: "maskable" },
  ];
}

export function isRoleShortcut(raw: string): raw is RoleShortcut {
  return Object.prototype.hasOwnProperty.call(ROLE_SHORTCUTS, raw);
}
