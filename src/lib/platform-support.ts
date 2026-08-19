import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type PlatformSupportScope = "course" | "billing";
export type PlatformSupportDurationHours = 6 | 24 | 72;
export type PlatformSupportGrantStatus = "active" | "expired" | "revoked";

export type PlatformSupportGrant = Database["public"]["Tables"]["platform_support_grants"]["Row"];

export function computeGrantStatus(grant: Pick<PlatformSupportGrant, "expires_at" | "revoked_at">): PlatformSupportGrantStatus {
  if (grant.revoked_at) return "revoked";
  if (new Date(grant.expires_at) < new Date()) return "expired";
  return "active";
}

// specs/for-claude-code-platform-support-access.md, "Course scope... granted
// by that course's main tutor." Checked directly against course_tutors
// rather than the separate centre_roles system (centre-roles.ts) -- being
// the MCT of a course is its own thing, not a centre_roles grant, and the
// two systems don't overlap.
export async function isCourseMct(
  supabase: SupabaseClient<Database>,
  profileId: string,
  courseId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("course_tutors")
    .select("id")
    .eq("course_id", courseId)
    .eq("profile_id", profileId)
    .eq("tutor_role", "main_course_tutor")
    .is("left_at", null)
    .maybeSingle();
  return !!data;
}

export async function createCourseGrant(
  supabase: SupabaseClient<Database>,
  input: {
    centerId: string;
    courseId: string;
    reason: string;
    durationHours: PlatformSupportDurationHours;
    chatIncluded: boolean;
    grantedBy: string;
  }
): Promise<{ error: string | null }> {
  if (!input.reason.trim()) return { error: "A reason is required." };

  const expiresAt = new Date(Date.now() + input.durationHours * 60 * 60 * 1000).toISOString();
  const { error } = await supabase.from("platform_support_grants").insert({
    center_id: input.centerId,
    course_id: input.courseId,
    scope: "course",
    chat_included: input.chatIncluded,
    reason: input.reason.trim(),
    duration_hours: input.durationHours,
    granted_by: input.grantedBy,
    expires_at: expiresAt,
  });
  return { error: error ? "Could not create the grant. Try again." : null };
}

export async function createBillingGrant(
  supabase: SupabaseClient<Database>,
  input: {
    centerId: string;
    reason: string;
    durationHours: PlatformSupportDurationHours;
    grantedBy: string;
  }
): Promise<{ error: string | null }> {
  if (!input.reason.trim()) return { error: "A reason is required." };

  const expiresAt = new Date(Date.now() + input.durationHours * 60 * 60 * 1000).toISOString();
  const { error } = await supabase.from("platform_support_grants").insert({
    center_id: input.centerId,
    course_id: null,
    scope: "billing",
    chat_included: false,
    reason: input.reason.trim(),
    duration_hours: input.durationHours,
    granted_by: input.grantedBy,
    expires_at: expiresAt,
  });
  return { error: error ? "Could not create the grant. Try again." : null };
}

export async function resolveActiveGrantByToken(
  supabase: SupabaseClient<Database>,
  token: string
): Promise<PlatformSupportGrant | null> {
  const { data } = await supabase.from("platform_support_grants").select("*").eq("token", token).maybeSingle();
  if (!data) return null;
  return computeGrantStatus(data) === "active" ? data : null;
}

export async function logGrantActivity(supabase: SupabaseClient<Database>, grantId: string, page: string): Promise<void> {
  await supabase.from("platform_support_grant_activity").insert({ grant_id: grantId, page });
}
