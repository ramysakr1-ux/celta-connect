"use server";

import { demoOr } from "@/lib/demo-guard";
import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getCentreRoleContext, canAtCentre } from "@/lib/auth/centre-roles";
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
    return { error: demoOr(error, "Could not send the invite. Try again.") };
  }

  revalidatePath("/centre/settings");
  return { error: null };
}

export async function revokePlatformOwnerInvite(formData: FormData): Promise<void> {
  const session = await getCurrentProfile();
  if (!session?.profile) return;
  const inviteId = formData.get("invite_id");
  if (typeof inviteId !== "string") return;

  const admin = createAdminClient();
  // Whose invite is this?
  //
  // This checked the capability at whichever centre the person happened to
  // be acting in and then updated by id alone -- no centre on the row, none
  // on the update. A Centre manager at one centre could revoke any other
  // centre's standing invite in the system (walked 15 Sep 2026).
  const { data: invite } = await admin.from("platform_owner_invites").select("id, center_id").eq("id", inviteId).maybeSingle();
  if (!invite) return;
  if (!(await canAtCentre(session.profile, "centre.settings.edit", invite.center_id))) return;

  await admin
    .from("platform_owner_invites")
    .update({ revoked_at: new Date().toISOString(), revoked_by: session.profile.id })
    .eq("id", inviteId)
    .eq("center_id", invite.center_id);

  revalidatePath("/centre/settings");
}

/**
 * Answer a request from Connect's platform owner to be let in.
 *
 * Migration 0310 gave the owner a way to ASK; this is the half that matters,
 * because the answer stays the centre's. Granting writes the same standing
 * invite the centre could always have written by hand, so every visit made
 * under it is logged on this page exactly as before. Declining closes the
 * question and leaves nothing behind.
 */
async function answerAccessRequest(formData: FormData, outcome: "granted" | "declined"): Promise<void> {
  const session = await getCurrentProfile();
  if (!session?.profile) return;
  const requestId = formData.get("request_id");
  if (typeof requestId !== "string") return;

  const admin = createAdminClient();
  // Whose request is this? Read the centre off the ROW and check the
  // capability there -- the same fault revokePlatformOwnerInvite above had,
  // where a manager at one centre could answer for another (walked 15 Sep).
  const { data: request } = await admin
    .from("platform_access_requests")
    .select("id, center_id, resolved_at")
    .eq("id", requestId)
    .maybeSingle();
  if (!request || request.resolved_at) return;
  if (!(await canAtCentre(session.profile, "centre.settings.edit", request.center_id))) return;

  if (outcome === "granted") {
    const { data: existing } = await admin
      .from("platform_owner_invites")
      .select("id")
      .eq("center_id", request.center_id)
      .is("revoked_at", null)
      .maybeSingle();
    if (!existing) {
      await admin.from("platform_owner_invites").insert({
        center_id: request.center_id,
        invited_by: session.profile.id,
        note: "In answer to a request from Connect",
      });
    }
  }

  await admin
    .from("platform_access_requests")
    .update({ resolved_at: new Date().toISOString(), resolved_by: session.profile.id, outcome })
    .eq("id", request.id);

  revalidatePath("/centre/settings");
}

export async function grantAccessRequest(formData: FormData): Promise<void> {
  await answerAccessRequest(formData, "granted");
}

export async function declineAccessRequest(formData: FormData): Promise<void> {
  await answerAccessRequest(formData, "declined");
}
