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

  // Migration 0212 + centre-roles.ts now recognize a live platform_owner_
  // invites row (current_center_id() at the DB level, getCentreRoleContext
  // at the app level) -- this is what points both of those at the invited
  // centre, same mechanism switchActiveCourse already uses for course_id.
  await admin.from("profiles").update({ active_center_id: centerId }).eq("id", profile.id);

  return NextResponse.redirect(new URL("/centre", siteUrl));
}
