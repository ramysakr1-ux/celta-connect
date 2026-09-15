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

/**
 * May this person move the centre's money?
 *
 * canDecideAdmissions() above answers a different question -- who decides an
 * application -- and it answers it from profiles.role, where "admin" covers
 * the whole centre-admin family and "trainer" covers every tutor on every
 * course. Refunds were gated on it, so a trainer, a Course administrator and
 * the READ-ONLY Centre observer could all agree and settle a refund of the
 * centre's money (walked 15 Sep 2026). The permission matrix is explicit
 * that money is the Centre manager's and the Centre owner's: "money is
 * exclusively the Centre manager's domain" is why course_administrator lost
 * payments.view and payments.edit in the first place.
 *
 * A dedicated admissions officer keeps the power -- they have no centre_roles
 * row to check, can_decide_admissions IS their grant, and a refund is
 * ordinarily the tail of an admissions decision they made.
 */
export async function canAgreeRefunds(profile: Profile, centerId: string): Promise<boolean> {
  if (profile.role === "platform_owner") return true;
  if (profile.role === "admissions") return Boolean(profile.can_decide_admissions);
  if (profile.role !== "admin") return false;
  const { canAtCentre } = await import("@/lib/auth/centre-roles");
  return canAtCentre(profile, "payments.edit", centerId);
}
