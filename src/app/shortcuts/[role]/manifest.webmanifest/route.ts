import { ROLE_SHORTCUTS, SPLASH_BACKGROUND, connectRelatedApplications, isRoleShortcut, roleShortcutIcons } from "@/lib/role-shortcuts";

// One manifest per role (design_handoff_role_shortcuts §2). The app-wide
// manifest.ts stays the generic Connect a plain visitor gets; each landing
// points its <link rel="manifest"> here instead, so "install this app" from
// a candidate's Course Stream installs the candidate shortcut -- their
// colour on the icon and, on Android, on the status bar.
//
// The segment is validated against the slug table and anything else is a
// 404: start_url comes out of this table, never out of the URL, so there is
// nothing here to point somewhere else.
export async function GET(request: Request, { params }: { params: Promise<{ role: string }> }) {
  const { role } = await params;
  if (!isRoleShortcut(role)) return new Response("Not found", { status: 404 });
  const r = ROLE_SHORTCUTS[role];
  // Taken from the request so it can never disagree with the host the page was
  // served from (apex vs www would make the related_applications match below
  // silently fail).
  const origin = new URL(request.url).origin;
  return Response.json(
    {
      name: `Connect — ${r.label}`,
      short_name: r.label,
      description: r.description,
      start_url: r.startUrl,
      // Explicit, because a manifest's scope defaults to the directory it is
      // served from -- /shortcuts/<role>/ -- and a start_url outside its scope
      // makes the manifest invalid, which Chrome answers with silence: no
      // install event, no dialog, the pill left showing the gesture note
      // (Ramy, 17 Sep 2026: "still getting the tutorial").
      scope: "/",
      // standalone, with minimal-ui asked for on top. Chrome on macOS will not
      // install a plain minimal-ui manifest at all -- no address-bar icon, no
      // install event -- which is what stopped every "add to home screen" on
      // Ramy's Mac on 17 Sep 2026 (found by bisecting with three test pages).
      // display_override keeps the address bar he wants in the installed
      // window, on browsers that honour it.
      display: "standalone",
      display_override: ["minimal-ui"],
      background_color: SPLASH_BACKGROUND,
      theme_color: r.theme,
      icons: roleShortcutIcons(role),
      // The manifest names itself, which is what lets a PAGE ask Chrome
      // whether this app is already installed (navigator.getInstalledRelatedApps
      // in install-prompt.tsx). Without it there is no way to tell from an
      // ordinary tab, and the pill kept offering "Add to home screen" to
      // someone who already had the app -- clicking it then fell through to
      // the gesture note. Ramy, 17 Sep 2026: "I'm getting a tutorial instead
      // of a home screen button."
      related_applications: connectRelatedApplications(origin),
    },
    {
      headers: {
        "Content-Type": "application/manifest+json",
        // Revalidate every time, like the generic manifest. A one-hour
        // max-age kept Ramy's Chrome on the pre-scope copy for the rest of
        // the afternoon after the fix had shipped (17 Sep 2026).
        "Cache-Control": "public, max-age=0, must-revalidate",
      },
    }
  );
}
