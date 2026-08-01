import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { buildGoogleAuthUrl } from "@/lib/google/oauth";

export async function GET() {
  await requireRole("admin");

  const state = crypto.randomUUID();
  const cookieStore = await cookies();
  cookieStore.set("google_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  redirect(buildGoogleAuthUrl(state));
}
