"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { can } from "@/lib/auth/centre-permissions";
import { createAdminClient } from "@/lib/supabase/admin";

export interface PlatformAccessFormState {
  error: string | null;
}

// for-claude-code-command-center.md's access model, the centre-side half of
// it: "they can always send me an invite, and then I can go, and it will be
// logged" (Ramy, 2026-08-25). One standing invite per centre -- not
// time-boxed like platform_support_grants, since this is "come and help
// with our business" rather than a scoped support window. Revoking and
// re-inviting is how a centre would rotate/refresh it if that's ever wanted.
export async function invitePlatformOwner(_prev: PlatformAccessFormState, formData: FormData): Promise<PlatformAccessFormState> {
  const session = await getCurrentProfile();
  if (!session?.profile) return { error: "Not signed in." };
  const ctx = await getCentreRoleContext(session.profile);
  if (!can(ctx.roles, "centre.settings.edit", ctx.overrides)) return { error: "You don't have permission to do this." };
  const centerId = ctx.activeCenterId ?? session.profile.center_id;

  const note = (formData.get("note") as string | null)?.trim() || null;
  const admin = createAdminClient();

  const { data: existing } = await admin.from("platform_owner_invites").select("id").eq("center_id", centerId).is("revoked_at", null).maybeSingle();
  if (existing) return { error: "Ramy already has standing access to this centre." };

  const { error } = await admin.from("platform_owner_invites").insert({ center_id: centerId, invited_by: session.profile.id, note });
  if (error) {
    // The message above is what the person reads; this is what we read.
    console.error("[centre/settings/platform-access-actions.ts:invitePlatformOwner]", error);
    return { error: "Could not send the invite. Try again." };
  }

  revalidatePath("/centre/settings");
  return { error: null };
}

export async function revokePlatformOwnerInvite(formData: FormData): Promise<void> {
  const session = await getCurrentProfile();
  if (!session?.profile) return;
  const ctx = await getCentreRoleContext(session.profile);
  if (!can(ctx.roles, "centre.settings.edit", ctx.overrides)) return;
  const inviteId = formData.get("invite_id");
  if (typeof inviteId !== "string") return;

  const admin = createAdminClient();
  await admin.from("platform_owner_invites").update({ revoked_at: new Date().toISOString(), revoked_by: session.profile.id }).eq("id", inviteId);

  revalidatePath("/centre/settings");
}
