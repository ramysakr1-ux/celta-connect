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
// `scope` is what lets two of these live side by side. Chrome will not offer
// to install a page an installed app's scope already covers, so while every
// manifest here said scope "/" the first Connect app installed -- of any role
// -- silenced the offer on every page of the site. Measured 22 Sep 2026: with
// the generic app installed the install event never fired on production and
// fired at once when it was removed. Distinct scopes are how an origin carries
// several apps at all (gmail and calendar on google.com are the everyday
// example), so each role is scoped to its own tree.
//
// Two rules, and the manifest is invalid if either is broken: startUrl must
// sit inside scope, and a scope is a path PREFIX, not a list.
//
// The candidate is the exception and stays at "/". Their workspace genuinely
// spans two trees -- /dashboard for the plan, the assignments and CELTA 5,
// /portfolio for the record -- and a scope can only name one. Scoping them to
// either would put the other outside the app window on the first click. So a
// candidate installs one app, which is all they need, and the pill explains
// itself if they somehow want a second (install-prompt.tsx).
export const ROLE_SHORTCUTS = {
  candidate: { label: "Candidate", startUrl: "/dashboard", scope: "/", theme: "#3e2818", description: "Your course, day by day." },
  "trainer-mct": { label: "Tutor", startUrl: "/trainer", scope: "/trainer", theme: "#862723", description: "Today, the roster and the timetable." },
  "trainer-act": { label: "Tutor", startUrl: "/trainer", scope: "/trainer", theme: "#885627", description: "Today, the roster and the timetable." },
  student: { label: "Student", startUrl: "/student", scope: "/student", theme: "#0f4a4b", description: "Your classes, materials and hours." },
  centre: { label: "Centre", startUrl: "/centre", scope: "/centre", theme: "#241d16", description: "Courses, people and money at your centre." },
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
  // Scoped to /platform, not to the room itself, so the Command Center's own
  // sub-pages stay inside the installed window.
  owner: { label: "Command Center", startUrl: "/platform/command-center", scope: "/platform", theme: "#bc7300", description: "Every centre, every course, the whole platform." },
} as const;
export type RoleShortcut = keyof typeof ROLE_SHORTCUTS;

/** --color-background, oklch(92.5% 0.012 85), through Oklab. The splash
 *  screen opens on the page ground the app then paints. */
export const SPLASH_BACKGROUND = "#eae6dd";

/** Every Connect manifest, as `related_applications` entries.
 *
 *  Each manifest used to name only ITSELF, which answers "is THIS app
 *  installed" and nothing else. That is not the question the pill needs
 *  answered. Chrome will not offer to install a page already covered by an
 *  installed app, and every one of these declares scope "/" -- so one
 *  installed Connect app, of any role, silently stops the offer on every page
 *  of the site. The pill could not see that (it only ever asked about its own
 *  manifest), so it went on offering, the click fell through to the gesture
 *  note, and there was nothing to tell anyone why. Ramy hit exactly this from
 *  17 to 22 Sep 2026 with the generic Connect installed: measured, the install
 *  event fired on localhost and never on production, and started firing on
 *  production the moment that app was properly removed.
 *
 *  Naming all of them means getInstalledRelatedApps() answers "which Connect
 *  app is installed", which is what install-prompt.tsx needs to tell the two
 *  cases apart. prefer_related_applications stays unset, so this changes
 *  nothing about installability itself.
 *
 *  The student's per-token manifest cannot be enumerated and is left out; a
 *  volunteer holding one is offered the token link, not a second app. */
export function connectRelatedApplications(origin: string) {
  const at = (path: string) => ({ platform: "webapp", url: `${origin}${path}` });
  return [at("/manifest.webmanifest"), ...Object.keys(ROLE_SHORTCUTS).map((r) => at(`/shortcuts/${r}/manifest.webmanifest`))];
}

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
