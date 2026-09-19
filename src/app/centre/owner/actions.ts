"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { CENTRE_ROLES, type CentreRole, type GrantLevel } from "@/lib/auth/centre-permissions";
import { refuseIfDemoCentre, demoOr } from "@/lib/demo-guard";

async function requireOwner() {
  const profile = await requireRole("admin");
  const ctx = await getCentreRoleContext(profile);
  if (!ctx.roles.includes("centre_owner")) throw new Error("Only the Centre owner can do this.");
  const centerId = ctx.activeCenterId ?? profile.center_id;
  // Every action in this file writes through the admin client, which the
  // demo's write-blocking trigger never sees -- so the role builder, custom
  // roles and branch visibility all persisted on the shared demo. One
  // chokepoint, since they all come through here.
  // Returned, not thrown: a throw inside a server action is a 500, and the
  // installed app showed "This page couldn't load" the moment a demo owner
  // clicked a pill in the Role builder (Ramy, 20 Sep 2026).
  const demo = await refuseIfDemoCentre(centerId);
  return { profile, centerId, ctx, demo };
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
  const { profile, centerId, demo } = await requireOwner();
  if (demo) return;
  const viewerCenterId = formData.get("viewer_center_id");
  const targetCenterId = formData.get("target_center_id");
  const visibility = formData.get("visibility");
  if (typeof viewerCenterId !== "string" || typeof targetCenterId !== "string" || (visibility !== "view_only" && visibility !== "blocked")) {
    return;
  }
  if (viewerCenterId === targetCenterId) return;

  // Owner at BOTH sides, not merely at one of them.
  //
  // The old check accepted the pair as long as one half was the owner's own
  // centre, so a row could be written pointing at a centre with no
  // relationship to them -- and this table is a grant, read as one the
  // moment anything beyond this page reads it. Owning both is also exactly
  // what this screen offers: an owner configuring their own branches
  // (walked 15 Sep 2026).
  const ownsBoth = (
    await Promise.all(
      [viewerCenterId, targetCenterId].map(async (id) => {
        const at = await getCentreRoleContext({ ...profile, active_center_id: id });
        return at.activeCenterId === id && at.roles.includes("centre_owner");
      })
    )
  ).every(Boolean);
  if (!ownsBoth) return;

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
  const { profile, centerId, demo } = await requireOwner();
  if (demo) return;
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
  const { profile, centerId, demo } = await requireOwner();
  if (demo) return;
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
  const { profile, centerId, demo } = await requireOwner();
  if (demo) return { error: demo };
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
  if (overrideError) {
    // The message above is what the person reads; this is what we read.
    console.error("[centre/owner:addCustomCapability]", overrideError);
    return { error: demoOr(overrideError, "Added the capability, but couldn't grant it -- try setting it from the table below.") };
  }

  await logOwnerAction(centerId, profile.id, "custom_capability.add", "centre_custom_capabilities", { capabilityKey, label, grantToRole });
  revalidatePath("/centre/owner");
  revalidatePath("/centre/roles");
  return { error: null };
}

export async function addCustomRole(_prevState: OwnerActionState, formData: FormData): Promise<OwnerActionState> {
  const { profile, centerId, demo } = await requireOwner();
  if (demo) return { error: demo };
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

export interface ReassignState {
  error: string | null;
  ok: string | null;
}

/**
 * Hand an orphaned course to a course administrator.
 *
 * The owner stays read-only on course administration -- this writes a scope
 * row saying WHO administers a course, and touches nothing inside it. Ramy,
 * 1 Sep 2026: "reassign, then, if it's like a last line of defence."
 *
 * Guarded three ways beyond owner-only: the course must belong to a centre
 * this owner actually holds, the grant must be a live course_administrator
 * grant at that same centre, and the course must still be unowned when the
 * write happens -- two owners in two tabs must not both hand out the same
 * course, and the check-then-write is only atomic if the last check is here
 * rather than in the render that drew the button.
 */
export async function reassignUnownedCourse(_prev: ReassignState, formData: FormData): Promise<ReassignState> {
  const { profile, demo } = await requireOwner();
  if (demo) return { error: demo, ok: null };
  const courseId = formData.get("courseId");
  const centreRoleId = formData.get("centreRoleId");
  if (typeof courseId !== "string" || typeof centreRoleId !== "string" || !courseId || !centreRoleId) {
    return { error: "Pick a course and somebody to hand it to.", ok: null };
  }

  const admin = createAdminClient();

  const { data: course } = await admin.from("courses").select("id, name, center_id").eq("id", courseId).maybeSingle();
  if (!course) return { error: "That course is not at a centre you own.", ok: null };
  // Owner AT THAT CENTRE. This asked availableCenterIds -- every centre they
  // can switch into -- while requireOwner() had only proved owner at the one
  // they were acting in, so an owner of one branch who is a read-only
  // observer at another could hand out that branch's courses. The message
  // said "a centre you own"; the check said "a centre you can reach"
  // (walked 15 Sep 2026).
  const atCourseCentre = await getCentreRoleContext({ ...profile, active_center_id: course.center_id });
  if (atCourseCentre.activeCenterId !== course.center_id || !atCourseCentre.roles.includes("centre_owner")) {
    return { error: "That course is not at a centre you own.", ok: null };
  }

  const { data: grant } = await admin
    .from("centre_roles")
    .select("id, profile_id, role, center_id, revoked_at")
    .eq("id", centreRoleId)
    .maybeSingle();
  if (!grant || grant.revoked_at || grant.role !== "course_administrator" || grant.center_id !== course.center_id) {
    return { error: "That person no longer holds a Course administrator role at this centre.", ok: null };
  }

  // Re-check emptiness at write time, not at render time.
  const { data: existing } = await admin
    .from("course_administrator_scope")
    .select("id, centre_role_id")
    .eq("course_id", courseId);
  const liveRoleIds = (existing ?? []).map((r) => r.centre_role_id);
  if (liveRoleIds.length > 0) {
    const { data: live } = await admin
      .from("centre_roles")
      .select("id")
      .in("id", liveRoleIds)
      .is("revoked_at", null);
    if ((live ?? []).length > 0) {
      return { error: "Somebody has already been given this course.", ok: null };
    }
  }

  const { error } = await admin
    .from("course_administrator_scope")
    .insert({ centre_role_id: centreRoleId, course_id: courseId });
  if (error) return { error: demoOr(error, "Could not assign the course. Nothing was changed."), ok: null };

  const { data: person } = await admin.from("profiles").select("full_name").eq("id", grant.profile_id).maybeSingle();
  await logOwnerAction(course.center_id, profile.id, "course.reassign_unowned", "course_administrator_scope", {
    course_id: courseId,
    course_name: course.name,
    assigned_to: grant.profile_id,
  });

  revalidatePath("/centre/owner");
  return { error: null, ok: `${course.name} is now administered by ${person?.full_name ?? "them"}.` };
}

// The other half of addCustomRole. Only a role nobody holds can go -- the
// people come off it on the Roles tab first, so a removal never silently
// strips anyone's access. Its overrides go with it; the owner log keeps
// what it was (Ramy, 20 Sep 2026: "yes, add the remove role action").
export async function removeCustomRole(_prevState: OwnerActionState, formData: FormData): Promise<OwnerActionState> {
  const { profile, centerId, demo } = await requireOwner();
  if (demo) return { error: demo };
  const roleKey = (formData.get("role_key") as string | null)?.trim();
  if (!roleKey) return { error: "Which role?" };
  if (CENTRE_ROLES.includes(roleKey as CentreRole)) return { error: "Built-in roles can't be removed." };

  const admin = createAdminClient();
  const { data: role } = await admin.from("centre_custom_roles").select("role_key, label").eq("center_id", centerId).eq("role_key", roleKey).maybeSingle();
  if (!role) return { error: "That role isn't one of this centre's." };
  const { count: holders } = await admin.from("centre_roles").select("id", { count: "exact", head: true }).eq("center_id", centerId).eq("role", roleKey).is("revoked_at", null);
  if (holders && holders > 0) {
    return { error: `${holders === 1 ? "One person holds" : `${holders} people hold`} this role -- remove it from them on the Roles tab first.` };
  }
  const { data: overrides } = await admin.from("centre_permission_overrides").select("capability_key, granted_level").eq("center_id", centerId).eq("role_key", roleKey);
  await admin.from("centre_permission_overrides").delete().eq("center_id", centerId).eq("role_key", roleKey);
  const { error } = await admin.from("centre_custom_roles").delete().eq("center_id", centerId).eq("role_key", roleKey);
  if (error) return { error: "Could not remove that role. Nothing was changed." };

  await logOwnerAction(centerId, profile.id, "custom_role.remove", "centre_custom_roles", { roleKey, label: role.label, overrides: overrides ?? [] });
  revalidatePath("/centre/owner");
  revalidatePath("/centre/roles");
  return { error: null };
}
