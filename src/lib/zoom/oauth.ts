import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// zoom-auto-attendance.md §1 -- OAuth authorization-code flow against
// Zoom's app, one connection per centre (a centre's meetings are hosted
// under its own Zoom account). Mirrors src/lib/google/oauth.ts's shape;
// the one real difference is Zoom returns access_token + refresh_token +
// expires_in together (Google's Drive scope only ever returns a
// refresh_token here, minting access tokens on demand) -- so this stores
// and refreshes an actual access_token/expires_at pair instead.

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set in .env.local yet.`);
  return value;
}

export function buildZoomAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: requiredEnv("ZOOM_CLIENT_ID"),
    redirect_uri: requiredEnv("ZOOM_REDIRECT_URI"),
    state,
  });
  return `https://zoom.us/oauth/authorize?${params.toString()}`;
}

interface ZoomTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

interface ZoomTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

function basicAuthHeader(): string {
  const id = requiredEnv("ZOOM_CLIENT_ID");
  const secret = requiredEnv("ZOOM_CLIENT_SECRET");
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

function tokensFromResponse(data: ZoomTokenResponse): ZoomTokens {
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  };
}

export async function exchangeCodeForTokens(code: string): Promise<ZoomTokens> {
  const response = await fetch("https://zoom.us/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: basicAuthHeader() },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: requiredEnv("ZOOM_REDIRECT_URI") }),
  });
  if (!response.ok) throw new Error(`Zoom token exchange failed: ${await response.text()}`);
  return tokensFromResponse((await response.json()) as ZoomTokenResponse);
}

// Zoom rotates the refresh_token on every use -- the caller must persist
// the new one, not just the new access_token, or the next refresh fails.
async function refreshZoomTokens(refreshToken: string): Promise<ZoomTokens> {
  const response = await fetch("https://zoom.us/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: basicAuthHeader() },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  });
  if (!response.ok) throw new Error(`Zoom token refresh failed: ${await response.text()}`);
  return tokensFromResponse((await response.json()) as ZoomTokenResponse);
}

export async function fetchZoomAccountEmail(accessToken: string): Promise<string | null> {
  const response = await fetch("https://api.zoom.us/v2/users/me", { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) return null;
  const data = (await response.json()) as { email?: string };
  return data.email ?? null;
}

// Every future call against Zoom's API (there are none yet in this app
// beyond the one-time fetchZoomAccountEmail at connect time) should go
// through this rather than reading centre_zoom_connections.access_token
// directly, so it never uses a token past expiry.
export async function getValidZoomAccessToken(
  admin: SupabaseClient<Database>,
  centerId: string
): Promise<string | null> {
  const { data: connection } = await admin
    .from("centre_zoom_connections")
    .select("access_token, refresh_token, expires_at")
    .eq("center_id", centerId)
    .maybeSingle();
  if (!connection) return null;

  const bufferMs = 5 * 60 * 1000;
  if (new Date(connection.expires_at).getTime() - bufferMs > Date.now()) {
    return connection.access_token;
  }

  const refreshed = await refreshZoomTokens(connection.refresh_token);
  await admin
    .from("centre_zoom_connections")
    .update({ access_token: refreshed.accessToken, refresh_token: refreshed.refreshToken, expires_at: refreshed.expiresAt })
    .eq("center_id", centerId);
  return refreshed.accessToken;
}
