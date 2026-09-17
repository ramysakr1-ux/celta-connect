import { createAdminClient } from "@/lib/supabase/admin";
import { ROLE_SHORTCUTS, SPLASH_BACKGROUND, roleShortcutIcons } from "@/lib/role-shortcuts";

// A volunteer's own manifest, so an installed Connect opens on THEIR page.
//
// The app-wide manifest (src/app/manifest.ts) sets start_url: "/", which is
// right for staff and trainees -- they have accounts and "/" resolves to
// their dashboard. For a volunteer it would be a trap: they have no account
// at all, their token IS their identity, and an app icon that opens the
// login screen is worse than no app icon, because it looks like the thing
// is broken rather than not installed.
//
// So the volunteer page points <link rel="manifest"> at this instead, and
// start_url carries the token. Scoped to the token path so the installed
// window keeps the archive download and the unsubscribe page inside it.
//
// iOS never reads any of this for "Add to Home Screen" -- it bookmarks
// whatever URL is on screen, which already carries the token -- so this is
// specifically for the Chrome/Edge/Android install path, which does.

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: accessToken } = await admin
    .from("course_access_tokens")
    .select("volunteer_student_id, course_id, expires_at")
    .eq("token", token)
    .eq("role", "volunteer_student")
    .maybeSingle();

  if (!accessToken?.volunteer_student_id || new Date(accessToken.expires_at) < new Date()) {
    return new Response("Not found", { status: 404 });
  }

  const { data: course } = await admin.from("courses").select("name").eq("id", accessToken.course_id).maybeSingle();

  return Response.json(
    {
      name: course?.name ? `Connect — ${course.name}` : "Connect",
      short_name: "Connect",
      description: "Your classes, materials and hours.",
      start_url: `/student/${token}`,
      scope: `/student/${token}`,
      // Named so a volunteer's page can ask whether this app is already
      // installed -- see the note in the role manifest route.
      related_applications: [{ platform: "webapp", url: new URL(request.url).href }],
      // standalone, with minimal-ui asked for on top. Chrome on macOS will not
      // install a plain minimal-ui manifest at all -- no address-bar icon, no
      // install event -- which is what stopped every "add to home screen" on
      // Ramy's Mac on 17 Sep 2026 (found by bisecting with three test pages).
      // display_override keeps the address bar he wants in the installed
      // window, on browsers that honour it.
      display: "standalone",
      display_override: ["minimal-ui"],
      background_color: SPLASH_BACKGROUND,
      // The student shortcut (design_handoff_role_shortcuts): teal ground,
      // "S" badge -- the volunteer student's own icon, not the generic mark.
      theme_color: ROLE_SHORTCUTS.student.theme,
      icons: roleShortcutIcons("student"),
    },
    {
      headers: {
        "Content-Type": "application/manifest+json",
        // The token is in here, so it must never sit in a shared cache.
        "Cache-Control": "private, no-store",
      },
    }
  );
}
