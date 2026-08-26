import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { can, type OverrideMatrix } from "@/lib/auth/centre-permissions";
import { sendApplicantEmail, type ApplicantEmailType } from "@/lib/admissions-email";
import { sendPushToOwners } from "@/lib/push/send";

// Ramy, 27 Aug 2026: "the right person gets pinged... this would be set by
// the centre owner" -- everyone currently holding a centre_roles grant
// (built-in or custom) whose effective admissions.manage capability isn't
// "none". Deliberately the centre_roles/capability-matrix system, not
// profiles.role/requireAdmissionsHandler() (a separate, narrower "who's
// allowed to open the admissions pages" gate) -- the owner assigns
// capabilities to roles via /centre/owner, and "who gets notified" should
// follow that same assignment, not a hardcoded profile.role check.
export async function getAdmissionsHandlerProfileIds(admin: SupabaseClient<Database>, centerId: string): Promise<string[]> {
  const [{ data: roleRows }, { data: overrideRows }] = await Promise.all([
    admin.from("centre_roles").select("profile_id, role").eq("center_id", centerId).is("revoked_at", null),
    admin.from("centre_permission_overrides").select("role_key, capability_key, granted_level").eq("center_id", centerId),
  ]);

  const overrides: OverrideMatrix = {};
  for (const row of overrideRows ?? []) {
    overrides[row.role_key] = overrides[row.role_key] ?? {};
    overrides[row.role_key][row.capability_key] = row.granted_level;
  }

  const profileIds = new Set<string>();
  for (const row of roleRows ?? []) {
    if (can([row.role], "admissions.manage", overrides)) profileIds.add(row.profile_id);
  }
  return [...profileIds];
}

// Delivers an already-written admissions_notifications event to every
// current admissions handler at the centre, by both channels -- push
// (silent no-op for anyone without a subscription) and email (every send
// still goes through sendApplicantEmail, so it's logged in applicant_emails
// and shows in the existing EmailHistoryPanel same as any other send).
export async function notifyAdmissionsHandlers(
  admin: SupabaseClient<Database>,
  input: {
    centerId: string;
    applicantId: string | null;
    emailType: ApplicantEmailType;
    subject: string;
    pushBody: string;
    pushUrl: string;
    buildEmailHtml: (recipientName: string) => string;
  }
): Promise<void> {
  const profileIds = await getAdmissionsHandlerProfileIds(admin, input.centerId);
  if (profileIds.length === 0) return;

  const [{ data: recipients }, { data: center }] = await Promise.all([
    admin.from("profiles").select("id, full_name, email").in("id", profileIds),
    admin.from("centers").select("name, admissions_email").eq("id", input.centerId).maybeSingle(),
  ]);

  await Promise.all([
    sendPushToOwners({ profileIds }, { title: input.subject, body: input.pushBody, url: input.pushUrl }),
    ...(recipients ?? [])
      .filter((r) => r.email)
      .map((r) =>
        sendApplicantEmail({
          centerName: center?.name ?? "Your centre",
          centerAdmissionsEmail: center?.admissions_email ?? null,
          to: r.email!,
          recipientName: r.full_name,
          subject: input.subject,
          html: input.buildEmailHtml(r.full_name),
          centerId: input.centerId,
          applicantId: input.applicantId,
          type: input.emailType,
          sentBy: null,
        })
      ),
  ]);
}
