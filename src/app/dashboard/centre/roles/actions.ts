"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { can, CENTRE_ROLES, CENTRE_ROLE_LABELS, type CentreRole } from "@/lib/auth/centre-permissions";

export interface GrantRoleState {
  error?: string;
  granted?: string;
}

/**
 * "Roles are invited, never self-selected -- the invitation itself carries the
 * role; there is no screen anywhere that promotes an account. A forwarded
 * invite link cannot create an administrator."
 *
 * centre_roles therefore has no insert policy at all (migration 0103): a
 * session literally cannot write it. Granting happens here, through the admin
 * client, only after confirming the caller holds roles.grant -- which is a
 * Centre owner power.
 */
export async function grantCentreRole(_prev: GrantRoleState, formData: FormData): Promise<GrantRoleState> {
  const profile = await requireRole("admin");
  const ctx = await getCentreRoleContext(profile);
  if (!can(ctx.roles, "roles.grant")) {
    return { error: "Only a Centre owner can appoint administrators." };
  }

  const targetEmail = (formData.get("email") as string | null)?.trim().toLowerCase();
  const role = formData.get("role") as CentreRole | null;
  if (!targetEmail) return { error: "Who is this for?" };
  if (!role || !CENTRE_ROLES.includes(role)) return { error: "Pick a role." };

  const centerId = ctx.activeCenterId ?? profile.center_id;
  const supabase = await createClient();

  // The person must already have an account in this centre. Creating one from
  // here would be an invitation, and inviting is its own deliberate flow --
  // this screen appoints, it doesn't recruit.
  const { data: target } = await supabase
    .from("profiles")
    .select("id, full_name, email, center_id")
    .eq("email", targetEmail)
    .maybeSingle();
  if (!target) return { error: "Nobody with that email has an account yet." };
  if (target.center_id !== centerId) {
    return { error: "That account belongs to a different centre." };
  }

  const admin = createAdminClient();
  // Re-granting a revoked role reactivates it rather than failing on the
  // unique constraint -- someone coming back from leave shouldn't need a
  // different row, and the granted_by/granted_at on it should be the new one.
  const { error } = await admin
    .from("centre_roles")
    .upsert(
      {
        profile_id: target.id,
        center_id: centerId,
        role,
        granted_by: profile.id,
        granted_at: new Date().toISOString(),
        revoked_at: null,
      },
      { onConflict: "profile_id,center_id,role" }
    );
  if (error) return { error: `Could not grant that role: ${error.message}` };

  await logOwnerAction(centerId, profile.id, "roles.grant", {
    target_email: targetEmail,
    role,
  });

  revalidatePath("/dashboard/centre/roles");
  return { granted: `${CENTRE_ROLE_LABELS[role]} granted to ${target.full_name}` };
}

export interface RevokeRoleState {
  error?: string;
  revoked?: boolean;
}

export async function revokeCentreRole(_prev: RevokeRoleState, formData: FormData): Promise<RevokeRoleState> {
  const profile = await requireRole("admin");
  const ctx = await getCentreRoleContext(profile);
  if (!can(ctx.roles, "roles.grant")) {
    return { error: "Only a Centre owner can remove administrators." };
  }

  const grantId = formData.get("grant_id") as string | null;
  if (!grantId) return { error: "Missing the grant." };

  const centerId = ctx.activeCenterId ?? profile.center_id;
  const admin = createAdminClient();

  const { data: grant } = await admin
    .from("centre_roles")
    .select("id, profile_id, role, center_id")
    .eq("id", grantId)
    .eq("center_id", centerId)
    .maybeSingle();
  if (!grant) return { error: "That grant isn't in this centre." };

  // Removing the last owner would lock the centre out of appointing anyone
  // ever again -- roles.grant is owner-only, so there would be no way back.
  // The same bootstrap trap the Connect Hub setup page had.
  if (grant.role === "centre_owner") {
    const { data: owners } = await admin
      .from("centre_roles")
      .select("id")
      .eq("center_id", centerId)
      .eq("role", "centre_owner")
      .is("revoked_at", null);
    if ((owners ?? []).length <= 1) {
      return { error: "This is the centre's only owner. Appoint another before removing this one." };
    }
  }

  const { error } = await admin
    .from("centre_roles")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", grantId);
  if (error) return { error: `Could not remove that role: ${error.message}` };

  await logOwnerAction(centerId, profile.id, "roles.revoke", {
    target_profile_id: grant.profile_id,
    role: grant.role,
  });

  revalidatePath("/dashboard/centre/roles");
  return { revoked: true };
}

/**
 * "Every owner action leaves a digital footprint (who, what, when) -- visible
 * logging, not silent senior access."
 *
 * Written with the admin client because centre_owner_actions has no insert
 * policy: a log entry must not be forgeable or suppressible by its subject.
 */
async function logOwnerAction(
  centerId: string,
  actorId: string,
  action: string,
  detail: Record<string, unknown>
) {
  const admin = createAdminClient();
  await admin.from("centre_owner_actions").insert({
    center_id: centerId,
    actor_profile_id: actorId,
    action,
    target_table: "centre_roles",
    detail,
  });
}
