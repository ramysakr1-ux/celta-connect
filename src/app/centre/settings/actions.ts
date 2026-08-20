"use server";

import "server-only";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { esc } from "@/lib/email-layout";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { can } from "@/lib/auth/centre-permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendApplicantEmail } from "@/lib/admissions-email";
import { signOut } from "@/app/login/actions";
import { ensureCourseArchived } from "@/lib/course-close-out/export";

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
  const filmsTpSessions = formData.get("films_tp_sessions") === "on";
  if (!name) return { error: "Enter the centre name." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("centers")
    .update({
      name,
      address,
      primary_contact_email: primaryContactEmail,
      time_zone: timeZone,
      currency,
      films_tp_sessions: filmsTpSessions,
    })
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

export interface RequestDeleteCodeState {
  error: string | null;
  sent: boolean;
}

// "Delete specifically also gets identity re-verification on top of the
// role gate and type-to-confirm: ... a confirmation code emailed to the
// owner." Chosen over password re-entry -- same guarantee, without a
// password ever passing through a server action's plain-text formData.
// The code is never returned to the client here; it only ever reaches the
// owner by email, which is the actual point of the check.
export async function requestCentreDeleteCode(_prevState: RequestDeleteCodeState, _formData: FormData): Promise<RequestDeleteCodeState> {
  const session = await getCurrentProfile();
  const profile = session?.profile;
  if (!profile) return { error: "Not signed in.", sent: false };
  const ctx = await getCentreRoleContext(profile);
  if (!ctx.roles.includes("centre_owner")) return { error: "Only the centre owner can delete the centre.", sent: false };

  const centerId = ctx.activeCenterId ?? profile.center_id;
  const admin = createAdminClient();
  const { data: center } = await admin.from("centers").select("name").eq("id", centerId).maybeSingle();
  if (!center) return { error: "Centre not found.", sent: false };

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const { error: insertError } = await admin
    .from("centre_delete_codes")
    .insert({ center_id: centerId, requested_by: profile.id, code, expires_at: expiresAt });
  if (insertError) return { error: "Could not send a code. Try again.", sent: false };

  // for-claude-code-email-delivery-tracking.md -- was a raw resend.emails.
  // send() call, untracked. Routed through sendApplicantEmail; this one
  // keeps its own error surfaced to the caller (unlike the account-recovery
  // flows above, there's no privacy reason to hide a failure here).
  const { error: sendError } = await sendApplicantEmail({
    centerName: center.name,
    centerAdmissionsEmail: null,
    to: profile.email,
    subject: "confirm deleting this centre",
    html: `<p>Someone -- hopefully you -- asked to permanently delete ${esc(center.name)} on Connect.</p><p>Confirmation code: <strong style="font-size:20px;letter-spacing:2px;">${code}</strong></p><p>This code expires in 15 minutes and works once. If you didn't request this, ignore this email -- nothing happens without the code.</p>`,
    centerId,
    applicantId: null,
    type: "centre_delete_code",
  });
  if (sendError) {
    return { error: "Could not send the email. Try again.", sent: false };
  }

  return { error: null, sent: true };
}

export interface DeleteCentreState {
  error: string | null;
}

// "Every course, candidate record, and CELTA 5 in the centre becomes
// inaccessible; anything covered by Cambridge's own retention rules is
// kept regardless of this action" -- hard delete, immediately, confirmed
// with Ramy 2026-08-19, WITH that retention carve-out (also confirmed
// 2026-08-19, after the first pass of this feature missed it): every
// course gets archived to the centre's Drive first, via the exact same
// export close-out already uses, before anything irreversible starts.
// That's the "kept" copy -- there's no separate retention store, the
// close-out archive already IS what Cambridge's records requirement
// means everywhere else in this app.
//
// profiles.center_id is `on delete restrict` by design, so every account
// at this centre must be removed via the Auth Admin API FIRST (deleting
// an auth.users row cascades its profiles row) -- centre_hard_delete
// (migration 0156) is only the "everything else" half and refuses if any
// profile is still left, so a wrong call order fails loudly rather than
// leaving a half-deleted centre.
//
// If either the archive pass or the account-removal loop fails partway
// through, this stops and reports the error WITHOUT calling
// centre_hard_delete -- nothing about the centre's course/candidate data
// has been touched at that point, and the action is safe to retry
// (already-archived courses and already-removed accounts simply won't
// need redoing next time).
export async function deleteCentre(_prevState: DeleteCentreState, formData: FormData): Promise<DeleteCentreState> {
  const session = await getCurrentProfile();
  const profile = session?.profile;
  if (!profile) return { error: "Not signed in." };
  const ctx = await getCentreRoleContext(profile);
  if (!ctx.roles.includes("centre_owner")) return { error: "Only the centre owner can delete the centre." };

  const centerId = ctx.activeCenterId ?? profile.center_id;
  const confirmName = (formData.get("confirm_name") as string | null)?.trim();
  const code = (formData.get("code") as string | null)?.trim();
  if (!code) return { error: "Enter the code from the email." };

  const admin = createAdminClient();
  const { data: center } = await admin.from("centers").select("name").eq("id", centerId).maybeSingle();
  if (!center) return { error: "Centre not found." };
  if (confirmName !== center.name) return { error: "Type the centre's exact name to confirm." };

  const nowIso = new Date().toISOString();
  const { data: codeRow } = await admin
    .from("centre_delete_codes")
    .select("id")
    .eq("center_id", centerId)
    .eq("requested_by", profile.id)
    .eq("code", code)
    .is("consumed_at", null)
    .gt("expires_at", nowIso)
    .order("created_at", { ascending: false })
    .maybeSingle();
  if (!codeRow) return { error: "That code is wrong or has expired. Request a new one." };

  const { data: courses } = await admin.from("courses").select("id, name").eq("center_id", centerId);
  for (const course of courses ?? []) {
    try {
      await ensureCourseArchived(course.id, centerId, profile.id);
    } catch (err) {
      return {
        error: `Could not archive "${course.name}" to Drive before deleting (${
          err instanceof Error ? err.message : "unknown error"
        }). Nothing was touched -- fix this and run delete again.`,
      };
    }
  }

  await admin.from("centre_delete_codes").update({ consumed_at: nowIso }).eq("id", codeRow.id);

  const { data: allProfiles } = await admin.from("profiles").select("id").eq("center_id", centerId);
  for (const p of allProfiles ?? []) {
    const { error: deleteUserError } = await admin.auth.admin.deleteUser(p.id);
    if (deleteUserError) {
      return {
        error: `Stopped partway through removing accounts (${deleteUserError.message}). Nothing else was touched -- run delete again to pick up where this left off.`,
      };
    }
  }

  const { error: rpcError } = await admin.rpc("centre_hard_delete", { p_center_id: centerId });
  if (rpcError) {
    return { error: `Accounts were removed, but the rest of the delete failed (${rpcError.message}). Run delete again.` };
  }

  // The owner's own account is now gone -- their session is no longer
  // valid for anything. signOut() clears it and redirects to /login.
  await signOut();
  redirect("/login");
}
