import { ROLE_SHORTCUTS, SPLASH_BACKGROUND, isRoleShortcut, roleShortcutIcons } from "@/lib/role-shortcuts";

// One manifest per role (design_handoff_role_shortcuts §2). The app-wide
// manifest.ts stays the generic Connect a plain visitor gets; each landing
// points its <link rel="manifest"> here instead, so "install this app" from
// a candidate's Course Stream installs the candidate shortcut -- their
// colour on the icon and, on Android, on the status bar.
//
// The segment is validated against the slug table and anything else is a
// 404: start_url comes out of this table, never out of the URL, so there is
// nothing here to point somewhere else.
export async function GET(_request: Request, { params }: { params: Promise<{ role: string }> }) {
  const { role } = await params;
  if (!isRoleShortcut(role)) return new Response("Not found", { status: 404 });
  const r = ROLE_SHORTCUTS[role];
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
      // minimal-ui, not the handoff's standalone: Ramy, 17 Sep 2026, wants
      // the address visible in the installed window.
      display: "minimal-ui",
      background_color: SPLASH_BACKGROUND,
      theme_color: r.theme,
      icons: roleShortcutIcons(role),
    },
    { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" } }
  );
}
