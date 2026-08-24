import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";

// "Every Invited access event must write to that centre's own activity/
// audit log" (for-claude-code-command-center.md) -- this is that write,
// fired the moment Ramy actually clicks in from the Command Center's
// centres table, not just when he loads the list. Refuses silently (302 to
// the Command Center, no error detail leaked) if there's no live invite
// for this centre, same fail-closed shape as every other access check in
// this app.
export async function GET(_req: Request, { params }: { params: Promise<{ centerId: string }> }) {
  const { centerId } = await params;
  const profile = await requireRole("platform_owner");
  const admin = createAdminClient();

  const { data: invite } = await admin
    .from("platform_owner_invites")
    .select("id")
    .eq("center_id", centerId)
    .is("revoked_at", null)
    .maybeSingle();

  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
  if (!invite) return NextResponse.redirect(new URL("/platform/command-center", siteUrl));

  await admin.from("platform_owner_access_log").insert({
    invite_id: invite.id,
    center_id: centerId,
    accessed_by: profile.id,
    page: "/centre",
  });

  // Note (flagged in the report back, not silently glossed over): this
  // redirects into the real /centre app, but that app's own access check
  // (getCentreRoleContext, centre-roles.ts) only recognizes centre_roles
  // grants today -- it doesn't yet know platform_owner_invites exists, so
  // it won't actually grant a view here without a follow-up change to that
  // function (and the matching current_center_id() RLS function, which the
  // app-side logic is required to agree with). The disclosure log write
  // above is real and correct regardless; the view itself isn't wired yet.
  return NextResponse.redirect(new URL("/centre", siteUrl));
}
