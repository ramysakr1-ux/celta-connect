import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { can } from "@/lib/auth/centre-permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ProfileDriveForm } from "@/app/centre/settings/profile-drive-form";
import { AdminRoster, type RosterRow } from "@/app/centre/settings/admin-roster";
import { TransferOwnershipCard, DeleteCentreCard } from "@/app/centre/settings/danger-zone";
import { SettingsTabs } from "@/app/centre/settings/settings-tabs";
import { SupportAccessTab, type SupportGrantRow } from "@/app/centre/settings/support-access-tab";
import { ProviderList } from "@/app/centre/payments/provider-list";
import type { PaymentProviderKey } from "@/lib/payments/providers";
import type { CentreRole } from "@/lib/auth/centre-permissions";
import { computeGrantStatus } from "@/lib/platform-support";

// for-claude-code-centre-settings.md: the real Centre Settings hub,
// replacing the old placeholder link from Centre Admin's "Open settings"
// card. "This screen holds things true of the whole centre, across every
// course" -- chat retention deliberately stays out (moved to Course
// Admin, migration 0154 -- the correction this spec itself confirms).
export default async function CentreSettingsPage() {
  const session = await getCurrentProfile();
  if (!session?.profile) redirect("/login");
  const profile = session.profile;

  const ctx = await getCentreRoleContext(profile);
  if (ctx.roles.length === 0) redirect("/dashboard");

  const centerId = ctx.activeCenterId ?? profile.center_id;
  const canEdit = can(ctx.roles, "centre.settings.edit");
  const mayAppoint = can(ctx.roles, "roles.grant");
  const isOwner = ctx.roles.includes("centre_owner");

  const admin = createAdminClient();
  const [{ data: center }, { data: driveConnection }, { data: grants }, { data: invites }, { data: supportGrants }] = await Promise.all([
    admin
      .from("centers")
      .select(
        "name, center_number, address, primary_contact_email, time_zone, currency, payment_provider, payment_provider_connected_at"
      )
      .eq("id", centerId)
      .maybeSingle(),
    admin.from("center_google_connections").select("connected_at, template_doc_id, output_folder_id").eq("center_id", centerId).maybeSingle(),
    admin.from("centre_roles").select("id, role, profile_id").eq("center_id", centerId).is("revoked_at", null).order("granted_at"),
    mayAppoint
      ? admin
          .from("centre_admin_invites")
          .select("id, role, created_at")
          .eq("center_id", centerId)
          .is("used_at", null)
          .is("revoked_at", null)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    admin.from("platform_support_grants").select("*").eq("center_id", centerId).order("granted_at", { ascending: false }),
  ]);

  if (!center) redirect("/centre");

  // Same server-side check /centre/payments itself uses -- "connected" on
  // paper (a provider chosen) can still have no server-side key, in which
  // case the first real checkout throws.
  const credentialsPresent = center.payment_provider === "stripe" ? Boolean(process.env.STRIPE_SECRET_KEY) : false;

  const grantProfileIds = [...new Set((grants ?? []).map((g) => g.profile_id))];
  const { data: people } = grantProfileIds.length
    ? await (await createClient()).from("profiles").select("id, full_name, email, course_id").in("id", grantProfileIds)
    : { data: [] };
  const personById = new Map((people ?? []).map((p) => [p.id, p]));

  const courseIds = [...new Set((people ?? []).map((p) => p.course_id).filter((id): id is string => !!id))];
  const { data: courses } = courseIds.length
    ? await admin.from("courses").select("id, name").in("id", courseIds)
    : { data: [] };
  const courseNameById = new Map((courses ?? []).map((c) => [c.id, c.name]));

  const rosterRows: RosterRow[] = (grants ?? []).map((g) => {
    const person = personById.get(g.profile_id);
    return {
      grantId: g.id,
      name: person?.full_name ?? "Unknown",
      email: person?.email ?? "",
      role: g.role as CentreRole,
      scope: g.role === "course_administrator" && person?.course_id ? (courseNameById.get(person.course_id) ?? "A course") : "Whole centre",
    };
  });

  const supportGranterIds = [...new Set((supportGrants ?? []).map((g) => g.granted_by))];
  const supportCourseIds = [...new Set((supportGrants ?? []).map((g) => g.course_id).filter((id): id is string => !!id))];
  const [{ data: supportGranters }, { data: supportCourses }] = await Promise.all([
    supportGranterIds.length ? admin.from("profiles").select("id, full_name").in("id", supportGranterIds) : Promise.resolve({ data: [] }),
    supportCourseIds.length ? admin.from("courses").select("id, name").in("id", supportCourseIds) : Promise.resolve({ data: [] }),
  ]);
  const granterNameById = new Map((supportGranters ?? []).map((p) => [p.id, p.full_name]));
  const supportCourseNameById = new Map((supportCourses ?? []).map((c) => [c.id, c.name]));

  const supportGrantRows: SupportGrantRow[] = (supportGrants ?? []).map((g) => ({
    id: g.id,
    scope: g.scope,
    courseName: g.course_id ? (supportCourseNameById.get(g.course_id) ?? null) : null,
    reason: g.reason,
    grantedByName: granterNameById.get(g.granted_by) ?? "Unknown",
    grantedAt: g.granted_at,
    durationHours: g.duration_hours,
    status: computeGrantStatus(g),
    chatIncluded: g.chat_included,
  }));
  const canGrantBilling = ctx.roles.includes("centre_administrator") || ctx.roles.includes("centre_owner");

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-6">
        <div className="flex items-center gap-3">
          <Link href="/centre" className="text-sm text-muted hover:text-ink">
            &larr; Centre Admin
          </Link>
          <span className="rounded-[5px] border border-primary/25 bg-primary/10 px-2.5 py-1 text-[11px] font-bold tracking-[0.1em] text-primary uppercase">
            Centre settings
          </span>
        </div>
        <h1 className="mt-2 font-serif text-xl text-ink">Settings</h1>
        <p className="mt-1 text-muted">Things true of the whole centre, across every course.</p>
      </div>

      <SettingsTabs
        profile={
          canEdit ? (
            <ProfileDriveForm
              name={center.name}
              centerNumber={center.center_number}
              address={center.address}
              primaryContactEmail={center.primary_contact_email}
              timeZone={center.time_zone}
              currency={center.currency}
              driveConnection={driveConnection}
            />
          ) : (
            <p className="text-sm text-muted">You don&apos;t hold a role that can edit centre settings.</p>
          )
        }
        payments={
          canEdit ? (
            <div className="flex flex-col gap-4">
              <div className="rounded-[8px] border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-ink">
                Connect never holds or moves money. It stores a reference to a payment made through the centre&apos;s
                own provider — balances shown everywhere else in Connect are read from that reference, not moved by
                Connect.
              </div>
              <ProviderList
                connectedKey={(center.payment_provider ?? null) as PaymentProviderKey | null}
                connectedAt={center.payment_provider_connected_at}
                credentialsPresent={credentialsPresent}
              />
              <Link href="/centre/payments" className="self-start text-sm font-medium text-primary hover:underline">
                Refund history &rarr;
              </Link>
            </div>
          ) : (
            <p className="text-sm text-muted">You don&apos;t hold a role that can manage payment providers.</p>
          )
        }
        people={<AdminRoster rows={rosterRows} invites={(invites ?? []) as { id: string; role: CentreRole; created_at: string }[]} mayAppoint={mayAppoint} />}
        support={<SupportAccessTab canGrantBilling={canGrantBilling} grants={supportGrantRows} />}
        danger={
          isOwner ? (
            <div className="flex flex-col gap-4">
              <TransferOwnershipCard centreName={center.name} />
              <DeleteCentreCard centreName={center.name} />
            </div>
          ) : null
        }
      />
    </div>
  );
}
