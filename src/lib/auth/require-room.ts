import "server-only";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { can, canView } from "@/lib/auth/centre-permissions";

// The door, not just the signage. The headers already hid the Course admin
// and Admissions links from a centre role that lacks the capability; the
// pages themselves still opened to a typed URL. Found 20 Sep 2026 by
// creating a "Centre Director" with two capabilities and signing in as her:
// no link to Admissions, but /dashboard/admissions rendered in full.
//
// Same rule as the header (dashboard/layout.tsx): an admin with no centre
// roles at all is the legacy flat admin with full access; anyone outside
// the admin family (the admissions user_role, a trainer on a course page)
// is not this gate's business.
export async function requireRoomCapability(capability: "courseAdmin.view" | "admissions.view"): Promise<{ readOnly: boolean }> {
  const session = await getCurrentProfile();
  const profile = session?.profile;
  if (!profile) return { readOnly: false };
  if (profile.role !== "admin" && profile.role !== "platform_owner") return { readOnly: false };
  const ctx = await getCentreRoleContext(profile);
  if (ctx.roles.length === 0) return { readOnly: false }; // legacy flat admin
  if (!canView(ctx.roles, capability, ctx.overrides)) redirect("/centre");
  // A view-level grant (the Centre observer: "wants the numbers, changes
  // nothing") reads the room; its forms are shown disabled rather than
  // offered and refused. The server actions refuse regardless -- this is
  // the honest surface, found on the observer walk (20 Sep 2026).
  return { readOnly: !can(ctx.roles, capability, ctx.overrides) };
}
