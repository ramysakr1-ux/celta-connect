import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { buildZoomAuthUrl } from "@/lib/zoom/oauth";

// Mirrors src/app/api/google/connect/route.ts's shape. No PKCE here --
// Zoom's OAuth app type for this flow is a confidential client
// (client_secret held server-side, never in the browser), unlike Google's
// which flagged a confidential client skipping PKCE as a risk; a plain
// state cookie is the standard CSRF guard for this flow.
export async function GET() {
  await requireRole("admin");

  const state = crypto.randomUUID();
  const cookieStore = await cookies();
  cookieStore.set("zoom_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  redirect(buildZoomAuthUrl(state));
}
