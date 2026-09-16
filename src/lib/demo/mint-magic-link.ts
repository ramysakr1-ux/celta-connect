import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEMO_DAY_COOKIE } from "@/lib/demo-clock";

// Shared by every /demo/<role> entry point (build-spec.md's "Demo -- a
// flagged clone of the real app," extended per
// connect-multi-role-demo-spec-2026-08-22.md to five roles). Mints a fresh
// single-use magic-link session for one seeded demo account and lands the
// visitor already logged in.
//
// Sharing one account across every visitor rests on a write block, and that
// block is narrower than this comment used to claim. Migration 0079's
// trigger fires only for `auth.role() = 'authenticated'`; the service role
// is exempt so the seed can write the demo, so every action that goes
// through createAdminClient() walks past it. src/lib/demo-guard.ts closes
// that at the chokepoints Centre Management writes through
// (requireCapability, requireOwner, and the centre-settings/roles/money
// actions); the trainer and trainee write paths are the same class and are
// NOT yet covered (walked 15 Sep 2026).
export async function mintDemoMagicLink(
  email: string,
  next: string | ((profileId: string) => string),
  /** `?day=N` off the demo link -- pins the demo clock (for-claude-code-demo-clock.md). */
  demoDay?: number | null
) {
  const admin = createAdminClient();
  // SITE_URL must be the CANONICAL host, including www where the domain
  // redirects to it. Every URL below is built from it, so a value of
  // https://celtaconnect.com (no www) puts an extra 308 in front of every
  // hop -- measured 30 Aug 2026 at ~300ms each, on a chain that is five
  // responses long: mint -> confirm -> resolve landing -> land. That is
  // most of the "why is the demo login so slow" and none of it is the
  // database being in Singapore.
  //
  // It also affects every magic link, invite, offer and interview email,
  // since they all build their URLs the same way.
  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
  const fallback = () => NextResponse.redirect(new URL("/", siteUrl));

  // Look the account up by its email, then confirm the centre it belongs to
  // is a demo one -- rather than finding "the" demo centre first.
  //
  // This used to be .eq("is_demo", true).maybeSingle(), which returns
  // nothing the moment a second demo centre exists. Adding an Izmir branch
  // so a centre owner could hold two centres silently took out every demo
  // entry point at once: no centre, no profile, straight to /login. The
  // singular assumption was invisible until the day it was false.
  const { data: profile } = await admin
    .from("profiles")
    .select("id, center_id")
    .eq("email", email)
    .maybeSingle();
  if (!profile?.center_id) return fallback();

  const { data: demoCenter } = await admin
    .from("centers")
    .select("id")
    .eq("id", profile.center_id)
    .eq("is_demo", true)
    .maybeSingle();
  if (!demoCenter) return fallback();

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: siteUrl },
  });
  if (error || !data.properties?.hashed_token) return fallback();

  const confirmUrl = new URL("/auth/confirm", siteUrl);
  confirmUrl.searchParams.set("token_hash", data.properties.hashed_token);
  confirmUrl.searchParams.set("type", "magiclink");
  confirmUrl.searchParams.set("next", typeof next === "function" ? next(profile.id) : next);
  const response = NextResponse.redirect(confirmUrl);
  // The demo clock rides a cookie rather than the URL, so it survives the
  // magic-link hop (mint -> confirm -> landing) and every click after it.
  // Setting it to null clears it, which is how a link with no ?day= puts a
  // visitor back on the real clock instead of leaving them wherever the last
  // link left them.
  if (demoDay === null || demoDay === undefined) {
    response.cookies.delete(DEMO_DAY_COOKIE);
  } else {
    response.cookies.set(DEMO_DAY_COOKIE, String(demoDay), {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 12,
    });
  }
  return response;
}
