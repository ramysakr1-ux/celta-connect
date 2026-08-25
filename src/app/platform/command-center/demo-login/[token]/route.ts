import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// command-center-full-spec.md's own flagged gap: generate/list/copy/revoke
// are real (platform_demo_login_links), but actually signing someone in as
// the chosen role isn't built -- that needs either a synthetic profile
// (mct/act/trainee/centre_admin) or a course_access_tokens row (assessor/
// volunteer), neither of which this link creates yet. Visiting a copied
// link says so honestly instead of 404ing or silently doing nothing, and
// still records last_used_at so a real click shows up if this gets built
// on top later.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: link } = await admin
    .from("platform_demo_login_links")
    .select("id, role_key, expires_at, revoked_at")
    .eq("login_token", token)
    .maybeSingle();

  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
  const valid = link && !link.revoked_at && new Date(link.expires_at) > new Date();
  if (!valid) {
    return NextResponse.redirect(new URL("/", siteUrl));
  }

  await admin.from("platform_demo_login_links").update({ last_used_at: new Date().toISOString() }).eq("id", link.id);

  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><title>Demo link</title></head><body style="font-family:system-ui,sans-serif;max-width:480px;margin:80px auto;padding:0 24px;color:#3a2f1f;line-height:1.6"><h1 style="font-size:20px">This demo link isn't wired up yet</h1><p>It's valid and logged, but signing in as this role (${link.role_key}) isn't built yet -- only generate/copy/revoke are real so far.</p></body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } }
  );
}
