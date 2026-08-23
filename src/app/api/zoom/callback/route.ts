import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { exchangeCodeForTokens, fetchZoomAccountEmail } from "@/lib/zoom/oauth";
import { createAdminClient } from "@/lib/supabase/admin";

// Mirrors src/app/api/google/callback/route.ts's shape.
export async function GET(request: NextRequest) {
  const profile = await requireRole("admin");

  const settingsUrl = "/centre/settings";
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const oauthError = request.nextUrl.searchParams.get("error");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("zoom_oauth_state")?.value;
  cookieStore.delete("zoom_oauth_state");

  if (oauthError) {
    redirect(`${settingsUrl}?zoom_error=${encodeURIComponent(oauthError)}`);
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    redirect(`${settingsUrl}?zoom_error=invalid_state`);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    // One real API call at connect time, both to confirm the token
    // actually works and to show which account got connected -- everything
    // after this is webhook-driven, no further calls are needed for the
    // MVP scope (no live "who's in the meeting" view, per the spec).
    const zoomAccountEmail = await fetchZoomAccountEmail(tokens.accessToken);

    const admin = createAdminClient();
    const { error } = await admin.from("centre_zoom_connections").upsert(
      {
        center_id: profile.center_id,
        connected_by: profile.id,
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expires_at: tokens.expiresAt,
        zoom_account_email: zoomAccountEmail,
        connected_at: new Date().toISOString(),
      },
      { onConflict: "center_id" }
    );
    if (error) throw error;
  } catch {
    redirect(`${settingsUrl}?zoom_error=token_exchange_failed`);
  }

  redirect(`${settingsUrl}?zoom_connected=1`);
}
