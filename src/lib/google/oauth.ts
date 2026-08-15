import "server-only";
import { createHash, randomBytes } from "node:crypto";

const SCOPE = "https://www.googleapis.com/auth/drive.file";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set in .env.local yet.`);
  return value;
}

// PKCE (RFC 7636) -- Google Cloud Console flags confidential clients that skip
// this as vulnerable to authorization-code interception/impersonation. The
// verifier is a per-attempt secret held server-side (cookie); only its SHA-256
// hash goes out in the authorization request, and the verifier itself is sent
// once, at token exchange, so Google can confirm the same party that started
// the flow is the one completing it.
export function generatePkcePair(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  return { codeVerifier, codeChallenge };
}

export function buildGoogleAuthUrl(state: string, codeChallenge: string): string {
  const params = new URLSearchParams({
    client_id: requiredEnv("GOOGLE_CLIENT_ID"),
    redirect_uri: requiredEnv("GOOGLE_REDIRECT_URI"),
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: SCOPE,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForRefreshToken(code: string, codeVerifier: string): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: requiredEnv("GOOGLE_CLIENT_ID"),
      client_secret: requiredEnv("GOOGLE_CLIENT_SECRET"),
      redirect_uri: requiredEnv("GOOGLE_REDIRECT_URI"),
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
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
