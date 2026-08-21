import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Shared by every /demo/<role> entry point (build-spec.md's "Demo -- a
// flagged clone of the real app," extended per
// connect-multi-role-demo-spec-2026-08-22.md to five roles). Mints a fresh
// single-use magic-link session for one seeded demo account and lands the
// visitor already logged in. Every write any of them might attempt is
// blocked at the database layer regardless (migration 0079's trigger,
// scoped to centers.is_demo), so sharing these accounts across every
// visitor concurrently is safe -- nothing any of them do can affect what
// the next visitor sees.
export async function mintDemoMagicLink(email: string, next: string | ((profileId: string) => string)) {
  const admin = createAdminClient();
  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
  const fallback = () => NextResponse.redirect(new URL("/", siteUrl));

  const { data: demoCenter } = await admin.from("centers").select("id").eq("is_demo", true).maybeSingle();
  if (!demoCenter) return fallback();

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("center_id", demoCenter.id)
    .eq("email", email)
    .maybeSingle();
  if (!profile) return fallback();

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
  return NextResponse.redirect(confirmUrl);
}
