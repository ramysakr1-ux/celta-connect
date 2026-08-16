import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { can } from "@/lib/auth/centre-permissions";
import { RoleStrip } from "@/app/centre/roles/role-strip";
import { GrantRoleForm, RevokeRoleButton } from "@/app/centre/roles/role-forms";

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
  const mayAppoint = can(ctx.roles, "roles.grant");

  // Read through the admin client so the list is complete: centre_roles' own
  // select policy is scoped to your own grants plus your centre, and joining
  // profiles through it would depend on a second policy agreeing. The page is
  // already gated on holding a role in this centre.
  const admin = createAdminClient();
  const [{ data: grants }, { data: log }] = await Promise.all([
    admin.from("centre_roles").select("id, role, profile_id").eq("center_id", centerId).is("revoked_at", null).order("granted_at"),
    mayAppoint
      ? admin
          .from("centre_owner_actions")
          .select("action, created_at, actor_profile_id")
          .eq("center_id", centerId)
          .order("created_at", { ascending: false })
          .limit(6)
      : Promise.resolve({ data: [] }),
  ]);

  const ids = [...new Set([...(grants ?? []).map((g) => g.profile_id), ...(log ?? []).map((l) => l.actor_profile_id)])];
  const { data: people } = ids.length
    ? await (await createClient()).from("profiles").select("id, full_name, email").in("id", ids)
    : { data: [] };
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

      <RoleStrip holders={holders} />

      {/* Absent, not disabled, for anyone who isn't an owner. */}
      {mayAppoint ? (
        <div className="rounded-[10px] border border-border bg-card px-5 py-4">
          <h2 className="font-serif text-base text-ink">Appoint someone</h2>
          <p className="mt-1 text-xs text-muted">
            Roles are appointed, never chosen — there is no screen anywhere that promotes an account. They need an
            account in this centre already; appointing gives a role to an existing person, it doesn&apos;t invite
            anyone.
          </p>
          <div className="mt-3">
            <GrantRoleForm />
          </div>

          {(grants ?? []).length > 0 ? (
            <div className="mt-4 border-t border-border-faint pt-3">
              <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Remove a role</p>
              <div className="mt-2 flex flex-col gap-1.5">
                {(grants ?? []).map((g) => (
                  <div key={g.id} className="flex items-center justify-between gap-3">
                    <span className="text-xs text-ink">
                      {nameOf.get(g.profile_id) ?? "Unknown"}{" "}
                      <span className="text-muted">{g.role.replace(/_/g, " ")}</span>
                    </span>
                    <RevokeRoleButton grantId={g.id} />
                  </div>
                ))}
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
