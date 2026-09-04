import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { can } from "@/lib/auth/centre-permissions";
import { RoleStrip } from "@/app/centre/roles/role-strip";
import { GrantRoleForm, RevokeRoleButton, AssignAreaForm, CreateInviteForm, RevokeInviteButton } from "@/app/centre/roles/role-forms";
import { roleLabel } from "@/lib/auth/centre-permissions";
import { AREAS, AREA_LABELS } from "@/lib/auth/areas";
import { getAreaHolders } from "@/lib/auth/area-holders";
import { DELIVERY_LABEL, DELIVERY_PILL_CLASS, type EmailDeliveryStatus } from "@/lib/email-delivery-status";
import { Avatar } from "@/components/avatar";

// Centre Admin's Roles tab. Layout per the 2026-08-16 visual spec: a headline
// and subhead, then the four-segment selector strip, then the selected role's
// permissions and its cross-cutting rule as a tone-coloured band.
export default async function CentreRolesPage() {
  const session = await getCurrentProfile();
  if (!session?.profile) redirect("/login");
  const profile = session.profile;

  const ctx = await getCentreRoleContext(profile);
  if (ctx.roles.length === 0) redirect("/dashboard");

  const centerId = ctx.activeCenterId ?? profile.center_id;
  const mayAppoint = can(ctx.roles, "roles.grant", ctx.overrides);

  // Read through the admin client so the list is complete: centre_roles' own
  // select policy is scoped to your own grants plus your centre, and joining
  // profiles through it would depend on a second policy agreeing. The page is
  // already gated on holding a role in this centre.
  const admin = createAdminClient();
  const supabase = await createClient();
  const [{ data: grants }, { data: log }, { data: invites }] = await Promise.all([
    // single-centre: role grants belong to one branch; you appoint someone AT a centre
    admin.from("centre_roles").select("id, role, profile_id").eq("center_id", centerId).is("revoked_at", null).order("granted_at"),
    mayAppoint
      ? admin
          .from("centre_owner_actions")
          .select("action, created_at, actor_profile_id")
          // single-centre: role grants belong to one branch; you appoint someone AT a centre
          .eq("center_id", centerId)
          .order("created_at", { ascending: false })
          .limit(6)
      : Promise.resolve({ data: [] }),
    mayAppoint
      ? admin
          .from("centre_admin_invites")
          .select("id, role, created_at, email")
          // single-centre: role grants belong to one branch; you appoint someone AT a centre
          .eq("center_id", centerId)
          .is("used_at", null)
          .is("revoked_at", null)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  // for-claude-code-email-delivery-tracking-visible.md follow-up: same join
  // as the Course Admin roster (dashboard/admin/courses/[id]/page.tsx) --
  // to_email since centre_admin_invites has no provider_message_id of its
  // own, newest row per address kept.
  const inviteEmails = [...new Set((invites ?? []).map((i) => i.email).filter((e): e is string => !!e).map((e) => e.toLowerCase()))];
  const ids = [...new Set([...(grants ?? []).map((g) => g.profile_id), ...(log ?? []).map((l) => l.actor_profile_id)])];

  // Ramy, 27 Aug 2026 (round 2): inviteDeliveries (needs inviteEmails),
  // people (needs ids), and areaHolders (only needs centerId, independent of
  // both) were three sequential awaits with no real chain between them --
  // now one Promise.all.
  const [{ data: inviteDeliveries }, { data: people }, areaHolders] = await Promise.all([
    inviteEmails.length > 0
      ? admin
          .from("applicant_emails")
          .select("to_email, status, created_at")
          // single-centre: role grants belong to one branch; you appoint someone AT a centre
          .eq("center_id", centerId)
          .eq("type", "centre_admin_invite")
          .in("to_email", inviteEmails)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    ids.length ? supabase.from("profiles").select("id, full_name, email").in("id", ids) : Promise.resolve({ data: [] }),
    // §11: "Everyone sees everything. Areas never hide information" -- so
    // this list renders for every admin, not only the owner who can change it.
    getAreaHolders(centerId),
  ]);
  const deliveryStatusByEmail = new Map<string, EmailDeliveryStatus>();
  for (const row of inviteDeliveries ?? []) {
    const key = row.to_email.toLowerCase();
    if (!deliveryStatusByEmail.has(key)) deliveryStatusByEmail.set(key, row.status as EmailDeliveryStatus);
  }
  const nameOf = new Map((people ?? []).map((p) => [p.id, p.full_name]));

  const holders: Record<string, { id: string; name: string }[]> = {};
  for (const g of grants ?? []) {
    (holders[g.role] ??= []).push({ id: g.id, name: nameOf.get(g.profile_id) ?? "Unknown" });
  }

  return (
    <div className="flex flex-col gap-[26px]">
      <div className="max-w-[900px]">
        <h1 className="font-serif text-[26px] leading-tight text-ink">
          The manager wants to see the money without being able to break anything.
        </h1>
        <p className="mt-2 text-[13px] text-muted">
          One person does admissions and chases payment; another wants a view of enrolment and cash and should change
          nothing. That is two roles, not one shared login.
        </p>
      </div>

      <RoleStrip holders={holders} overrides={ctx.overrides} customRoles={ctx.customRoles} customCapabilities={ctx.customCapabilities} />

      <div className="card px-5 py-4">
        <h2 className="font-serif text-base text-ink">Areas of responsibility</h2>
        <p className="mt-1 text-xs text-muted">
          A role says what someone is capable of; an area says what is actually their job. Everyone sees every area —
          only its holder can act in it, and everyone else sees their name instead of the button.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {AREAS.map((a) => {
            const h = areaHolders.get(a);
            return (
              <div key={a} className="admin-hover flex items-center justify-between gap-3 rounded-[6px] bg-surface-muted/60 px-3 py-2">
                <span className="text-[13px] text-ink">{AREA_LABELS[a]}</span>
                <span className="shrink-0 text-xs text-muted">
                  {h ? (
                    <>
                      {h.name}
                      {h.endsAt ? (
                        <span className="text-muted">
                          {" "}
                          until {new Date(`${h.endsAt}T00:00:00`).toLocaleDateString("en-GB")}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    "Nobody yet — anyone with the role can act"
                  )}
                </span>
              </div>
            );
          })}
        </div>
        {mayAppoint ? (
          <div className="mt-4 border-t border-border-faint pt-3">
            <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Assign an area</p>
            <p className="mt-1 mb-2 text-xs text-muted">
              Nobody assigns their own. An end date makes it temporary cover that lapses on its own.
            </p>
            <AssignAreaForm />
          </div>
        ) : null}
      </div>

      {/* Absent, not disabled, for anyone who isn't an owner. */}
      {mayAppoint ? (
        <div className="card card-gold px-5 py-4">
          <h2 className="font-serif text-base text-ink">Appoint someone</h2>
          <p className="mt-1 text-xs text-muted">
            Roles are appointed, never chosen — nobody promotes their own account. They need an account in this
            centre already; appointing gives a role to an existing person. Inviting someone who doesn&apos;t have
            one yet is below.
          </p>
          <div className="mt-3">
            <GrantRoleForm customRoles={ctx.customRoles} />
          </div>

          {(grants ?? []).length > 0 ? (
            <div className="mt-4 border-t border-border-faint pt-3">
              <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Remove a role</p>
              <div className="mt-2 flex flex-col gap-1.5">
                {(grants ?? []).map((g) => (
                  <div key={g.id} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-xs text-ink">
                      <Avatar name={nameOf.get(g.profile_id) ?? "Unknown"} size="xs" />
                      <span>
                        {nameOf.get(g.profile_id) ?? "Unknown"}{" "}
                        <span className="text-muted">{roleLabel(g.role, ctx.customRoles)}</span>
                      </span>
                    </span>
                    <RevokeRoleButton grantId={g.id} />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {mayAppoint ? (
        <div className="card px-5 py-4">
          <h2 className="font-serif text-base text-ink">Invite a new admin</h2>
          <p className="mt-1 text-xs text-muted">
            For someone who has no account here at all. The link opens the centre, not a course — they set up their
            account and accept the centre agreement in one step, and their access lasts for as long as the centre
            runs, not just one course.
          </p>
          <div className="mt-3">
            <CreateInviteForm customRoles={ctx.customRoles} />
          </div>

          {(invites ?? []).length > 0 ? (
            <div className="mt-4 border-t border-border-faint pt-3">
              <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Pending invites</p>
              <div className="mt-2 flex flex-col gap-1.5">
                {(invites ?? []).map((inv) => {
                  const deliveryStatus = inv.email ? deliveryStatusByEmail.get(inv.email.toLowerCase()) : null;
                  return (
                    <div key={inv.id} className="flex items-center justify-between gap-3">
                      <span className="text-xs text-ink">
                        {roleLabel(inv.role, ctx.customRoles)}
                        {inv.email ? <span className="text-muted"> · {inv.email}</span> : <span className="text-muted"> · not yet accepted</span>}
                        {deliveryStatus ? (
                          <span className={`ml-1.5 status-pill ${DELIVERY_PILL_CLASS[deliveryStatus]}`}>{DELIVERY_LABEL[deliveryStatus]}</span>
                        ) : null}
                      </span>
                      <RevokeInviteButton inviteId={inv.id} />
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {mayAppoint && (log ?? []).length > 0 ? (
        <div className="rounded-[10px] border border-destructive/25 bg-destructive/5 px-5 py-4">
          <h2 className="font-serif text-base text-ink">Owner actions</h2>
          <p className="mt-0.5 text-xs text-muted">
            Every intervention an owner makes is recorded — visible logging, not silent senior access.
          </p>
          <div className="mt-2 flex flex-col gap-1">
            {(log ?? []).map((entry, i) => (
              <div key={i} className="flex items-center justify-between gap-3 text-xs">
                <span className="text-ink">
                  {nameOf.get(entry.actor_profile_id) ?? "Unknown"} &middot; {entry.action}
                </span>
                <span className="text-muted">{new Date(entry.created_at).toLocaleString("en-GB")}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
