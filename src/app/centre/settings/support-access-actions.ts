"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createBillingGrant, isCourseMct, createCourseGrant, type PlatformSupportDurationHours } from "@/lib/platform-support";

export interface SupportGrantFormState {
  error: string | null;
}

const VALID_DURATIONS: PlatformSupportDurationHours[] = [6, 24, 72];

function parseDuration(formData: FormData): PlatformSupportDurationHours | null {
  const raw = Number(formData.get("duration_hours"));
  return VALID_DURATIONS.includes(raw as PlatformSupportDurationHours) ? (raw as PlatformSupportDurationHours) : null;
}

// specs/for-claude-code-platform-support-access.md: "Billing/admin scope...
// granted by a Centre administrator or the Centre owner." Checked directly
// against those two centre_roles, not the capability matrix -- this is a
// new, distinct decision from anything already in Capability, not a
// rewording of one of the existing ones. "Centre administrator" here is the
// centre_administrator slug, displayed as "Centre manager" since the
// 2026-08-23 rename -- the check itself is unchanged.
export async function grantBillingSupportAccess(_prevState: SupportGrantFormState, formData: FormData): Promise<SupportGrantFormState> {
  const session = await getCurrentProfile();
  const profile = session?.profile;
  if (!profile) return { error: "Not signed in." };
  const ctx = await getCentreRoleContext(profile);
  if (!ctx.roles.includes("centre_administrator") && !ctx.roles.includes("centre_owner")) {
    return { error: "Only a Centre manager or the Centre owner can grant billing access." };
  }

  const reason = (formData.get("reason") as string | null) ?? "";
  const durationHours = parseDuration(formData);
  if (!durationHours) return { error: "Choose a duration." };

  const centerId = ctx.activeCenterId ?? profile.center_id;
  const admin = createAdminClient();
  const result = await createBillingGrant(admin, { centerId, reason, durationHours, grantedBy: profile.id });
  if (!result.error) revalidatePath("/centre/settings");
  return result;
}

// The MCT-facing counterpart -- lives here too (rather than a second
// actions file under /trainer) so both grant paths write through the same
// two functions in platform-support.ts and can't drift.
export async function grantCourseSupportAccess(_prevState: SupportGrantFormState, formData: FormData): Promise<SupportGrantFormState> {
  const session = await getCurrentProfile();
  const profile = session?.profile;
  if (!profile || !profile.course_id) return { error: "Not signed in." };

  const admin = createAdminClient();
  const isMct = await isCourseMct(admin, profile.id, profile.course_id);
  if (!isMct) return { error: "Only this course's main tutor can grant platform support access." };

  const reason = (formData.get("reason") as string | null) ?? "";
  const durationHours = parseDuration(formData);
  if (!durationHours) return { error: "Choose a duration." };
  // "Closed to every admin role including the owner, no exception, unless
  // ... separately and explicitly approved by the main tutor." The MCT is
  // the only person who can even reach this form, so ticking this box IS
  // that approval -- see the migration's note on why a fuller support@-
  // initiated request/decline exchange isn't built.
  const chatIncluded = formData.get("chat_included") === "on";

  const result = await createCourseGrant(admin, {
    centerId: profile.center_id,
    courseId: profile.course_id,
    reason,
    durationHours,
    chatIncluded,
    grantedBy: profile.id,
  });
  if (!result.error) revalidatePath("/trainer/support-access");
  return result;
}

export async function revokeSupportGrant(formData: FormData): Promise<void> {
  const session = await getCurrentProfile();
  const profile = session?.profile;
  if (!profile) return;
  const grantId = formData.get("grant_id");
  if (typeof grantId !== "string") return;

  const admin = createAdminClient();
  const { data: grant } = await admin.from("platform_support_grants").select("id, center_id, course_id, scope, granted_by").eq("id", grantId).maybeSingle();
  if (!grant) return;

  // Whoever could have granted this can revoke it: a centre_roles holder
  // for the centre, or the course's own MCT for a course-scope grant. Not
  // limited to the original granter -- a grant made by an MCT who has
  // since left should still be revocable by the centre.
  const ctx = await getCentreRoleContext(profile);
  const centreAuthorized = ctx.roles.includes("centre_administrator") || ctx.roles.includes("centre_owner") || ctx.roles.includes("centre_manager");
  const mctAuthorized = grant.scope === "course" && grant.course_id ? await isCourseMct(admin, profile.id, grant.course_id) : false;
  if (!centreAuthorized && !mctAuthorized) return;

  await admin.from("platform_support_grants").update({ revoked_at: new Date().toISOString(), revoked_by: profile.id }).eq("id", grantId);
  revalidatePath("/centre/settings");
  revalidatePath("/trainer/support-access");
}
