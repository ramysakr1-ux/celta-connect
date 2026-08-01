import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { exchangeCodeForRefreshToken } from "@/lib/google/oauth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const profile = await requireRole("admin");

  const settingsUrl = "/dashboard/admin/settings";
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const oauthError = request.nextUrl.searchParams.get("error");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("google_oauth_state")?.value;
  cookieStore.delete("google_oauth_state");

  if (oauthError) {
    redirect(`${settingsUrl}?google_error=${encodeURIComponent(oauthError)}`);
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    redirect(`${settingsUrl}?google_error=invalid_state`);
  }

  try {
    const refreshToken = await exchangeCodeForRefreshToken(code);
    const admin = createAdminClient();
    const { error } = await admin
      .from("center_google_connections")
      .upsert(
        {
          center_id: profile.center_id,
          connected_by: profile.id,
          refresh_token: refreshToken,
          connected_at: new Date().toISOString(),
        },
        { onConflict: "center_id" }
      );
    if (error) throw error;
  } catch {
    redirect(`${settingsUrl}?google_error=token_exchange_failed`);
  }

  redirect(`${settingsUrl}?google_connected=1`);
}
