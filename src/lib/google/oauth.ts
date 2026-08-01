import "server-only";

const SCOPE = "https://www.googleapis.com/auth/drive.file";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set in .env.local yet.`);
  return value;
}

export function buildGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: requiredEnv("GOOGLE_CLIENT_ID"),
    redirect_uri: requiredEnv("GOOGLE_REDIRECT_URI"),
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: SCOPE,
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForRefreshToken(code: string): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: requiredEnv("GOOGLE_CLIENT_ID"),
      client_secret: requiredEnv("GOOGLE_CLIENT_SECRET"),
      redirect_uri: requiredEnv("GOOGLE_REDIRECT_URI"),
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    throw new Error(`Google token exchange failed: ${await response.text()}`);
  }

  const data = (await response.json()) as { refresh_token?: string };
  if (!data.refresh_token) {
    throw new Error(
      "Google did not return a refresh token. The center admin needs to " +
        "revoke this app's access at https://myaccount.google.com/permissions " +
        "and reconnect, so Google issues a fresh one."
    );
  }
  return data.refresh_token;
}

export async function getAccessTokenFromRefreshToken(refreshToken: string): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: requiredEnv("GOOGLE_CLIENT_ID"),
      client_secret: requiredEnv("GOOGLE_CLIENT_SECRET"),
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error(`Google access token refresh failed: ${await response.text()}`);
  }

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}
