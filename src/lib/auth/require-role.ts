import "server-only";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import type { UserRole } from "@/lib/supabase/types";

export async function requireRole(role: UserRole) {
  const session = await getCurrentProfile();
  if (!session) redirect("/login");
  if (!session.profile) redirect("/dashboard");
  if (session.profile.role !== role) redirect(`/dashboard/${session.profile.role}`);
  return session.profile;
}
