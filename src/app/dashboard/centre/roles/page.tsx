import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { can, CENTRE_ROLES, CENTRE_ROLE_LABELS, type CentreRole } from "@/lib/auth/centre-permissions";
import { GrantRoleForm, RevokeRoleButton } from "@/app/dashboard/centre/roles/role-forms";

// Centre Admin's Roles tab (screen 1a). Shows what each role means and who
// holds it. Appointing and removing is a Centre owner power; for everyone else
// this is a reference screen -- access here is meant to be legible, not secret.
const ROLE_BLURB: Record<CentreRole, { who: string; summary: string; accent: string }> = {
  centre_administrator: {
    who: "runs admissions, payments and course setup",
    summary:
      "The working role. Creates courses, invites people, chases money, forms groups. Everything except grading and anything a tutor does inside a course.",
    accent: "border-l-primary",
  },
  centre_manager: {
    who: "wants the numbers, changes nothing",
    summary:
      "Read-only across the whole centre. Built for the person who asks how many are enrolled and whether the January course will fill -- so they can look instead of asking.",
    accent: "border-l-gold",
  },
  course_administrator: {
    who: "one or two courses, not the centre",
    summary:
      "Everything a centre administrator can do, scoped to named courses. Cambridge-approved -- in practice the main course tutor or course coordinator.",
    accent: "border-l-border",
  },
  centre_owner: {
    who: "the centre's own way back in",
    summary:
      "Oversight of everything in this centre, and nothing outside it. Read-only on course administration; may intervene everywhere else, and every intervention is logged.",
    accent: "border-l-destructive",
  },
};

export default async function CentreRolesPage() {
  const session = await getCurrentProfile();
  if (!session?.profile) redirect("/login");
  const profile = session.profile;

  const ctx = await getCentreRoleContext(profile);
  if (ctx.roles.length === 0) redirect("/dashboard");

  const centerId = ctx.activeCenterId ?? profile.center_id;
  const mayAppoint = can(ctx.roles, "roles.grant");

  // Read through the admin client so the list is complete: centre_roles' own
  // select policy is scoped to your own grants plus your centre, and joining
  // profiles through it would otherwise depend on a second policy agreeing.
  // The page is already gated on holding a role in this centre.
  const admin = createAdminClient();
  const [{ data: grants }, { data: log }] = await Promise.all([
    admin
      .from("centre_roles")
      .select("id, role, granted_at, profile_id")
      .eq("center_id", centerId)
      .is("revoked_at", null)
      .order("granted_at"),
    mayAppoint
      ? admin
          .from("centre_owner_actions")
          .select("action, detail, created_at, actor_profile_id")
          .eq("center_id", centerId)
          .order("created_at", { ascending: false })
          .limit(8)
      : Promise.resolve({ data: [] }),
  ]);

  const holderIds = [...new Set([...(grants ?? []).map((g) => g.profile_id), ...(log ?? []).map((l) => l.actor_profile_id)])];
  const { data: people } = holderIds.length
    ? await (await createClient()).from("profiles").select("id, full_name, email").in("id", holderIds)
    : { data: [] };
  const nameOf = new Map((people ?? []).map((p) => [p.id, p.full_name]));
  const emailOf = new Map((people ?? []).map((p) => [p.id, p.email]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">Centre admin</p>
        <h1 className="font-serif text-2xl text-ink">Roles</h1>
        <p className="text-sm text-muted">
          Roles are appointed, never chosen -- there is no screen anywhere that promotes an account.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {CENTRE_ROLES.map((role) => {
          const blurb = ROLE_BLURB[role];
          const holders = (grants ?? []).filter((g) => g.role === role);
          return (
            <div key={role} className={`sheet flex flex-col gap-2 border-l-[3px] ${blurb.accent}`}>
              <div>
                <p className="text-sm font-semibold text-ink">{CENTRE_ROLE_LABELS[role]}</p>
                <p className="text-xs text-muted">{blurb.who}</p>
              </div>
              <p className="text-xs leading-relaxed text-muted">{blurb.summary}</p>
              <div className="mt-1 flex flex-col gap-1 border-t border-border-faint pt-2">
                {holders.length === 0 ? (
                  <p className="text-xs text-muted">Nobody holds this yet.</p>
                ) : (
                  holders.map((h) => (
                    <div key={h.id} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-ink">
                        {nameOf.get(h.profile_id) ?? "Unknown"}{" "}
                        <span className="text-muted">{emailOf.get(h.profile_id)}</span>
                      </span>
                      {mayAppoint ? <RevokeRoleButton grantId={h.id} /> : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Absent, not disabled, for anyone who isn't an owner. */}
      {mayAppoint ? (
        <div className="sheet flex flex-col gap-3">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">Appoint someone</p>
          <p className="text-xs text-muted">
            They need an account in this centre already. Appointing gives a role to an existing person; it doesn&apos;t
            invite anyone.
          </p>
          <GrantRoleForm />
        </div>
      ) : null}

      {mayAppoint && (log ?? []).length > 0 ? (
        <div className="sheet flex flex-col gap-2 border-t-[3px] border-t-destructive">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-destructive uppercase">Owner actions</p>
          <p className="text-xs text-muted">
            Every intervention an owner makes is recorded here -- visible logging, not silent senior access.
          </p>
          {(log ?? []).map((entry, i) => (
            <div key={i} className="flex items-center justify-between gap-3 border-t border-border-faint py-1.5 text-xs">
              <span className="text-ink">
                {nameOf.get(entry.actor_profile_id) ?? "Unknown"} &middot; {entry.action}
              </span>
              <span className="text-muted">{new Date(entry.created_at).toLocaleString("en-GB")}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
