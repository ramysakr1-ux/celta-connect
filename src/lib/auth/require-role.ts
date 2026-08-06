import "server-only";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import type { UserRole } from "@/lib/supabase/types";

export async function requireRole(role: UserRole | UserRole[]) {
  const session = await getCurrentProfile();
  if (!session) redirect("/login");
  if (!session.profile) redirect("/dashboard");
  const allowed = Array.isArray(role) ? role : [role];
  if (!allowed.includes(session.profile.role)) redirect(`/dashboard/${session.profile.role}`);
  return session.profile;
}
