import "server-only";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { resolveLandingPath } from "@/lib/auth/landing-path";
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
  // Turned away: send them to their OWN home, by the one function that knows
  // where each role lives. This used to build the path from the role name --
  // `/dashboard/${actualRole}` -- and there is no /dashboard/trainee page and
  // no /dashboard/platform_owner one either, only folders of sub-routes. So a
  // candidate who touched any staff-gated page, by a stale link or a shared
  // URL, landed on a 404 rather than their portfolio. Found 22 Sep 2026 while
  // working out why the Command Center would not install: signed in as a
  // candidate, /platform/command-center bounced to /dashboard/trainee and
  // Chrome was offered the generic manifest of a 404 page.
  if (!passes) redirect(await resolveLandingPath(session.profile));
  return session.profile;
}
