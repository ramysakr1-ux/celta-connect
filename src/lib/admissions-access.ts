import "server-only";
import { requireRole } from "@/lib/auth/require-role";
import type { Database } from "@/lib/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

// Mirrors can_handle_admissions()/can_decide_admissions() in migration
// 0081 -- "distinguishes handling an application (booking, chasing,
// correspondence) from deciding on one (interview, marking, accept/
// reject), and only verified tutors or nominees can do the second."
export async function requireAdmissionsHandler(): Promise<Profile> {
  return requireRole(["admin", "trainer", "admissions"]);
}

export function canDecideAdmissions(profile: Profile): boolean {
  return profile.role === "admin" || profile.role === "trainer" || (profile.role === "admissions" && profile.can_decide_admissions);
}
