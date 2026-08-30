"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { CENTRE_ROLES, type CentreRole, type GrantLevel } from "@/lib/auth/centre-permissions";

async function requireOwner() {
  const profile = await requireRole("admin");
  const ctx = await getCentreRoleContext(profile);
  if (!ctx.roles.includes("centre_owner")) throw new Error("Only the Centre owner can do this.");
  const centerId = ctx.activeCenterId ?? profile.center_id;
  return { profile, centerId };
}

async function logOwnerAction(centerId: string, actorId: string, action: string, targetTable: string, detail: Record<string, unknown>) {
  const admin = createAdminClient();
  await admin.from("centre_owner_actions").insert({ center_id: centerId, actor_profile_id: actorId, action, target_table: targetTable, detail });
}

export interface OwnerActionState {
  error: string | null;
}

// for-claude-code-centre-owner-role-customizer.md §1: directional, per
// branch pair, owner-only, default blocked. viewer/target order matters --
// "Downtown can see Riverside" and "Riverside can see Downtown" are two
// separate rows.
export async function setBranchVisibility(formData: FormData): Promise<void> {
  const { profile, centerId } = await requireOwner();
  const viewerCenterId = formData.get("viewer_center_id");
  const targetCenterId = formData.get("target_center_id");
  const visibility = formData.get("visibility");
  if (typeof viewerCenterId !== "string" || typeof targetCenterId !== "string" || (visibility !== "view_only" && visibility !== "blocked")) {
    return;
  }
  // Only an owner at one of the two branches involved may set this --
  // requireOwner() already proved owner somewhere, this confirms it's the
  // right somewhere. centerId is the owner's OWN active centre; the pair
  // must include it, otherwise they're trying to set visibility between two
  // branches neither of which they own.
  if (viewerCenterId !== centerId && targetCenterId !== centerId) return;

  const admin = createAdminClient();
  const { error } = await admin
    .from("centre_branch_visibility")
    .upsert(
      { viewer_center_id: viewerCenterId, target_center_id: targetCenterId, visibility, set_by: profile.id, set_at: new Date().toISOString() },
      { onConflict: "viewer_center_id,target_center_id" }
    );
  if (error) return;

  await logOwnerAction(centerId, profile.id, "branch_visibility.set", "centre_branch_visibility", { viewerCenterId, targetCenterId, visibility });
  revalidatePath("/centre/owner");
}

// Full -> View -> None -> Full, matching Centre Owner Landing.dc.html's own
// cycle() exactly. Writing "none" as an explicit override (rather than just
// deleting the row) matters when the built-in role's MATRIX default isn't
// already "none" -- e.g. tightening Course administrator's course.
// editRecord down to None has to actually say so, not just be absent.
export async function cycleCapabilityOverride(formData: FormData): Promise<void> {
  const { profile, centerId } = await requireOwner();
  const roleKey = formData.get("role_key");
  const capabilityKey = formData.get("capability_key");
  const currentLevel = formData.get("current_level");
  if (typeof roleKey !== "string" || typeof capabilityKey !== "string") return;
  const order: GrantLevel[] = ["full", "view", "none"];
  const from = order.includes(currentLevel as GrantLevel) ? (currentLevel as GrantLevel) : "none";
  const next = order[(order.indexOf(from) + 1) % order.length];

  const admin = createAdminClient();
  const { error } = await admin
    .from("centre_permission_overrides")
    .upsert(
      { center_id: centerId, role_key: roleKey, capability_key: capabilityKey, granted_level: next, set_by: profile.id, set_at: new Date().toISOString() },
      { onConflict: "center_id,role_key,capability_key" }
    );
  if (error) return;

  await logOwnerAction(centerId, profile.id, "permission_override.set", "centre_permission_overrides", { roleKey, capabilityKey, level: next });
  revalidatePath("/centre/owner");
  revalidatePath("/centre/roles");
}

// Puts every capability back to what the code says the role is.
//
// Found 2026-08-30 while checking this screen with Ramy: every pill click
// persists immediately and nothing could undo it, so exploring the role
// builder permanently reshapes the centre. Both real centres had already
// drifted into nonsense that way -- "Centre observer", the read-only role,
// holding full Create courses, Invite/grant centre roles and Centre
// settings, while Centre manager had been stripped of payments, which the
// spec says is exclusively its domain. Nobody set out to do that; it is
// what a screen with a cycle button and no reset produces.
//
// Deletes the override rows rather than writing "default" values into them,
// so the matrix in centre-permissions.ts stays the single source of truth
// and a later change to a default reaches a reset centre. Logged like every
// other owner intervention. Custom roles and capabilities are untouched --
// those are things the owner deliberately created, not drift.
export async function resetCapabilityOverrides(formData: FormData): Promise<void> {
  const { profile, centerId } = await requireOwner();
  const roleKey = formData.get("role_key");

  const admin = createAdminClient();
  let query = admin.from("centre_permission_overrides").delete().eq("center_id", centerId);
  // A single column can be reset on its own; no role_key resets the lot.
  if (typeof roleKey === "string" && roleKey) query = query.eq("role_key", roleKey);
  const { error } = await query;
  if (error) return;

  await logOwnerAction(centerId, profile.id, "permission_override.reset", "centre_permission_overrides", {
    scope: typeof roleKey === "string" && roleKey ? roleKey : "all_roles",
  });
  revalidatePath("/centre/owner");
  revalidatePath("/centre/roles");
}

export async function addCustomCapability(_prevState: OwnerActionState, formData: FormData): Promise<OwnerActionState> {
  const { profile, centerId } = await requireOwner();
  const label = (formData.get("label") as string | null)?.trim();
  const grantToRole = formData.get("grant_to_role") as string | null;
  if (!label) return { error: "Name the capability first." };
  if (!grantToRole) return { error: "Pick who gets it." };

  const capabilityKey = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!capabilityKey) return { error: "That name didn't leave anything usable -- try letters or numbers." };

  const admin = createAdminClient();
  const { error: capError } = await admin.from("centre_custom_capabilities").insert({ center_id: centerId, capability_key: capabilityKey, label, created_by: profile.id });
  if (capError) return { error: capError.code === "23505" ? "A capability with that name already exists." : "Could not add that capability." };

  const { error: overrideError } = await admin
    .from("centre_permission_overrides")
    .insert({ center_id: centerId, role_key: grantToRole, capability_key: capabilityKey, granted_level: "full", set_by: profile.id });
  if (overrideError) return { error: "Added the capability, but couldn't grant it -- try setting it from the table below." };

  await logOwnerAction(centerId, profile.id, "custom_capability.add", "centre_custom_capabilities", { capabilityKey, label, grantToRole });
  revalidatePath("/centre/owner");
  revalidatePath("/centre/roles");
  return { error: null };
}

export async function addCustomRole(_prevState: OwnerActionState, formData: FormData): Promise<OwnerActionState> {
  const { profile, centerId } = await requireOwner();
  const label = (formData.get("label") as string | null)?.trim();
  if (!label) return { error: "Name the role first." };

  const roleKey = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!roleKey) return { error: "That name didn't leave anything usable -- try letters or numbers." };
  if (CENTRE_ROLES.includes(roleKey as CentreRole)) return { error: "That name collides with a built-in role." };

  const admin = createAdminClient();
  const { error } = await admin.from("centre_custom_roles").insert({ center_id: centerId, role_key: roleKey, label, created_by: profile.id });
  if (error) return { error: error.code === "23505" ? "A role with that name already exists." : "Could not add that role." };

  await logOwnerAction(centerId, profile.id, "custom_role.add", "centre_custom_roles", { roleKey, label });
  revalidatePath("/centre/owner");
  revalidatePath("/centre/roles");
  return { error: null };
}
