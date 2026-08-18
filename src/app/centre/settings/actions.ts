"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { can } from "@/lib/auth/centre-permissions";
import { createAdminClient } from "@/lib/supabase/admin";

export interface FormState {
  error: string | null;
}

// for-claude-code-centre-settings.md, "1. Profile & Drive": name +
// Cambridge centre number (read-only here, unlike the older /dashboard/
// admin/settings form -- "Set by Cambridge, not editable here") + the
// four new fields this spec adds. Deliberately does not touch is_uk_
// centre/admissions_email/volunteer threshold -- out of this spec's
// scope, and still live on the older settings page.
export async function updateCentreProfile(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await getCurrentProfile();
  const profile = session?.profile;
  if (!profile) return { error: "Not signed in." };
  const ctx = await getCentreRoleContext(profile);
  if (!can(ctx.roles, "centre.settings.edit")) return { error: "You can't edit centre settings." };

  const centerId = ctx.activeCenterId ?? profile.center_id;
  const name = (formData.get("name") as string | null)?.trim();
  const address = (formData.get("address") as string | null)?.trim() || null;
  const primaryContactEmail = (formData.get("primary_contact_email") as string | null)?.trim() || null;
  const timeZone = (formData.get("time_zone") as string | null)?.trim() || null;
  const currency = (formData.get("currency") as string | null)?.trim() || null;
  if (!name) return { error: "Enter the centre name." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("centers")
    .update({ name, address, primary_contact_email: primaryContactEmail, time_zone: timeZone, currency })
    .eq("id", centerId);
  if (error) return { error: "Could not save. Try again." };

  revalidatePath("/centre/settings");
  return { error: null };
}

export interface TransferOwnershipState {
  error: string | null;
}

// "Transfer centre ownership -- hands the centre-owner role to someone
// else; they take on everything that role can do, including restoring
// deleted courses and appointing administrators." Owner-only, per the
// danger-zone addendum's own access rule -- checked here, not just hidden
// in the UI, since a role gate is "the real security boundary," not the
// type-to-confirm step.
export async function transferCentreOwnership(_prevState: TransferOwnershipState, formData: FormData): Promise<TransferOwnershipState> {
  const session = await getCurrentProfile();
  const profile = session?.profile;
  if (!profile) return { error: "Not signed in." };
  const ctx = await getCentreRoleContext(profile);
  if (!ctx.roles.includes("centre_owner")) return { error: "Only the centre owner can transfer ownership." };

  const centerId = ctx.activeCenterId ?? profile.center_id;
  const confirmName = (formData.get("confirm_name") as string | null)?.trim();
  const newOwnerEmail = (formData.get("new_owner_email") as string | null)?.trim().toLowerCase();
  if (!newOwnerEmail) return { error: "Enter the email of who you're transferring to." };

  const admin = createAdminClient();
  const { data: center } = await admin.from("centers").select("name").eq("id", centerId).maybeSingle();
  if (!center) return { error: "Centre not found." };
  if (confirmName !== center.name) return { error: "Type the centre's exact name to confirm." };

  const { data: newOwner } = await admin.from("profiles").select("id, center_id").eq("email", newOwnerEmail).maybeSingle();
  if (!newOwner || newOwner.center_id !== centerId) {
    return { error: "That person doesn't have an account at this centre yet -- invite them first, from Admin roster." };
  }

  const now = new Date().toISOString();
  const { data: currentGrant } = await admin
    .from("centre_roles")
    .select("id")
    .eq("center_id", centerId)
    .eq("profile_id", profile.id)
    .eq("role", "centre_owner")
    .is("revoked_at", null)
    .maybeSingle();
  if (!currentGrant) return { error: "Could not find your own owner grant. Try again." };

  await admin.from("centre_roles").update({ revoked_at: now }).eq("id", currentGrant.id);
  const { error: grantError } = await admin
    .from("centre_roles")
    .insert({ center_id: centerId, profile_id: newOwner.id, role: "centre_owner", granted_by: profile.id });
  if (grantError) {
    // Roll back the revoke rather than leaving the centre ownerless.
    await admin.from("centre_roles").update({ revoked_at: null }).eq("id", currentGrant.id);
    return { error: "Could not complete the transfer. Try again." };
  }

  await admin.from("centre_owner_actions").insert({
    center_id: centerId,
    actor_profile_id: profile.id,
    action: `Transferred ownership to ${newOwnerEmail}`,
  });

  revalidatePath("/centre/settings");
  revalidatePath("/centre/roles");
  return { error: null };
}
