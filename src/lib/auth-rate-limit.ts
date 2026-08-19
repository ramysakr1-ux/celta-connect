import "server-only";
import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// Shared by sendSignInLink, requestPasswordReset, and signIn -- all public,
// unauthenticated, and (the first two) now trigger a real tracked email
// send per for-claude-code-email-delivery-tracking.md. Same shape of
// cost/abuse vector /apply had before 0165_apply_rate_limit.sql; this is
// that same pattern for the auth-flow routes. 5 per hour per IP is
// generous for genuine use while making scripted abuse expensive.
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60 * 60 * 1000;

export type AuthRateLimitKind = "sign_in_link" | "password_reset" | "sign_in_password";

export async function clientIp(): Promise<string> {
  const h = await headers();
  // Vercel sets x-forwarded-for with the real client IP first in the list.
  const forwardedFor = h.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}

/** True if this IP has already hit the limit for this kind -- caller should refuse. */
export async function isAuthRateLimited(admin: SupabaseClient<Database>, kind: AuthRateLimitKind): Promise<boolean> {
  const ip = await clientIp();
  const { count } = await admin
    .from("auth_ip_attempts")
    .select("*", { count: "exact", head: true })
    .eq("kind", kind)
    .eq("ip_address", ip)
    .gte("created_at", new Date(Date.now() - WINDOW_MS).toISOString());
  if ((count ?? 0) >= MAX_ATTEMPTS) return true;

  await admin.from("auth_ip_attempts").insert({ kind, ip_address: ip });
  return false;
}
