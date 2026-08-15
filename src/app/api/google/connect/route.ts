import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { buildGoogleAuthUrl, generatePkcePair } from "@/lib/google/oauth";

export async function GET() {
  await requireRole("admin");

  const state = crypto.randomUUID();
  const { codeVerifier, codeChallenge } = generatePkcePair();
  const cookieStore = await cookies();
  cookieStore.set("google_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  cookieStore.set("google_oauth_code_verifier", codeVerifier, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  redirect(buildGoogleAuthUrl(state, codeChallenge));
}
