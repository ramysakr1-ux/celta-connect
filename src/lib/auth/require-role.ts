import "server-only";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import type { UserRole } from "@/lib/supabase/types";

export async function requireRole(role: UserRole | UserRole[]) {
  const session = await getCurrentProfile();
  if (!session) redirect("/login");
  if (!session.profile) redirect("/dashboard");
  const allowed = Array.isArray(role) ? role : [role];
  const actualRole = session.profile.role;
  // platform_owner sits above admin and satisfies any admin-gated route
  // without every call site needing to list it explicitly (connect-
  // platform-owner-role-spec-2026-08-22.md's own stated preference, kept
  // as one central rule rather than touching each requireRole("admin")
  // call). Deliberately one-directional: this widens an admin check to
  // also accept platform_owner, but a platform_owner-only check is not
  // satisfied by plain admin.
  const passes = allowed.includes(actualRole) || (actualRole === "platform_owner" && allowed.includes("admin"));
  if (!passes) redirect(actualRole === "platform_owner" ? "/platform" : `/dashboard/${actualRole}`);
  return session.profile;
}
