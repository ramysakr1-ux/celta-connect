"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/supabase/types";

export interface CreateCentreState {
  error?: string;
  createdToken?: string;
  centerName?: string;
}

/**
 * The bootstrap step platform_owner exists for: a brand new centre has no
 * admin yet, so there's nobody there to invite in the normal way. Reuses
 * the exact same centre_admin_invites -> /join-centre/[token] machinery an
 * existing centre_owner already uses to add a SECOND admin (migration
 * 0144) -- the new person still creates their own account and password
 * through the real join flow; this just mints the very first invite for a
 * centre that has nobody in it yet.
 */
export async function createCentreAndFirstAdmin(_prev: CreateCentreState, formData: FormData): Promise<CreateCentreState> {
  const profile = await requireRole("platform_owner");

  const name = (formData.get("name") as string | null)?.trim();
  const centerNumber = (formData.get("center_number") as string | null)?.trim();
  if (!name) return { error: "Give the centre a name." };
  if (!centerNumber) return { error: "Give the centre its Cambridge-assigned centre number." };

  const admin = createAdminClient();
  const { data: center, error: centerErr } = await admin
    .from("centers")
    .insert({ name, center_number: centerNumber })
    .select("id")
    .single();
  if (centerErr) return { error: `Could not create that centre: ${centerErr.message}` };

  const { data: invite, error: inviteErr } = await admin
    .from("centre_admin_invites")
    .insert({ center_id: center.id, role: "centre_owner", created_by: profile.id })
    .select("token")
    .single();
  if (inviteErr) return { error: `Centre created, but the invite failed: ${inviteErr.message}` };

  revalidatePath("/platform");
  return { createdToken: invite.token, centerName: name };
}

export interface ChangeRoleState {
  error?: string;
  notice?: string;
}

const ASSIGNABLE_ROLES: UserRole[] = ["trainee", "trainer", "admin", "admissions", "platform_owner"];

/**
 * "Ability to promote/demote other users' roles" -- the flat top-level
 * profiles.role, not the finer centre_roles family (an admin can already
 * hand those out themselves via /centre/roles once they hold admin at
 * all). Deliberately refuses to touch your own account, so a platform
 * owner can't fat-finger themselves out of the role with no one else able
 * to grant it back.
 */
export async function changeUserRole(_prev: ChangeRoleState, formData: FormData): Promise<ChangeRoleState> {
  const profile = await requireRole("platform_owner");

  const email = (formData.get("email") as string | null)?.trim().toLowerCase();
  const role = formData.get("role") as UserRole | null;
  if (!email) return { error: "Who is this for?" };
  if (!role || !ASSIGNABLE_ROLES.includes(role)) return { error: "Pick a role." };

  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("id, full_name, email").eq("email", email).maybeSingle();
  if (!target) return { error: "Nobody with that email has an account yet." };
  if (target.id === profile.id) return { error: "Change your own role from a different account, not this one." };

  const { error } = await admin.from("profiles").update({ role }).eq("id", target.id);
  if (error) return { error: `Could not change that role: ${error.message}` };

  revalidatePath("/platform");
  return { notice: `${target.full_name} is now ${role}.` };
}
