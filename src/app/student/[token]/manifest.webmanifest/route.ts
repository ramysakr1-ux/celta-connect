import { createAdminClient } from "@/lib/supabase/admin";

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

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
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
      display: "standalone",
      background_color: "#faf7f2",
      theme_color: "#3e2818",
      icons: [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
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
