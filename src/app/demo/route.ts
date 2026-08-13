import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Public, unauthenticated entry point for build-spec.md's "Demo -- a
// flagged clone of the real app." Mints a fresh single-use magic-link
// session (same server-side token_hash exchange /auth/confirm already
// does for real invites/password resets) for the one seeded demo trainer
// account, then lands the visitor on /trainer already logged in. Every
// write they might attempt is blocked at the database layer regardless
// (migration 0079's trigger, scoped to centers.is_demo), so sharing this
// one account across every visitor concurrently is safe -- nothing any of
// them do can affect what the next visitor sees.
export async function GET() {
  const admin = createAdminClient();

  const { data: demoCenter } = await admin.from("centers").select("id").eq("is_demo", true).maybeSingle();
  if (!demoCenter) {
    return NextResponse.redirect(new URL("/", process.env.SITE_URL ?? "http://localhost:3000"));
  }

  const { data: demoTrainer } = await admin
    .from("profiles")
    .select("email")
    .eq("center_id", demoCenter.id)
    .eq("role", "trainer")
    .maybeSingle();
  if (!demoTrainer) {
    return NextResponse.redirect(new URL("/", process.env.SITE_URL ?? "http://localhost:3000"));
  }

  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: demoTrainer.email,
    options: { redirectTo: siteUrl },
  });
  if (error || !data.properties?.hashed_token) {
    return NextResponse.redirect(new URL("/", siteUrl));
  }

  const confirmUrl = new URL("/auth/confirm", siteUrl);
  confirmUrl.searchParams.set("token_hash", data.properties.hashed_token);
  confirmUrl.searchParams.set("type", "magiclink");
  confirmUrl.searchParams.set("next", "/trainer");

  return NextResponse.redirect(confirmUrl);
}
