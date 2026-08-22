import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { signOut } from "@/app/login/actions";
import { Wordmark } from "@/components/wordmark";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { can } from "@/lib/auth/centre-permissions";
import { CentreTabs } from "@/app/centre/centre-tabs";
import { BranchFilter } from "@/app/centre/branch-filter";
import { createAdminClient } from "@/lib/supabase/admin";
import { DesignerCredit } from "@/components/designer-credit";
import { getAdminChatRooms } from "@/lib/admin-chat";
import { AdminChatBar } from "@/app/dashboard/admin/admin-chat-bar";

// Centre Admin has its own chrome, deliberately outside /dashboard: the layout
// spec gives it a header with a "Centre admin" pill and exactly THREE tabs
// (Overview / Roles / Import) below it. Under /dashboard it inherited that
// route's seven-tab header instead, which is why nothing else lined up.
export default async function CentreLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentProfile();
  if (!session?.profile) redirect("/login");
  const profile = session.profile;

  const ctx = await getCentreRoleContext(profile);
  if (ctx.roles.length === 0) redirect("/dashboard");

  // for-claude-code-centre-settings.md addendum: "the same fixed
  // bottom-center admin chat pill... is also present on Centre Settings,
  // not just Centre Admin -- it should persist across every centre-level
  // admin screen." This layout wraps every /centre/* route (including
  // /centre/settings, since there's no nested layout underneath it), so
  // rendering it once here covers all of them. Reuses the exact component
  // and getAdminChatRooms() Course Admin already has -- same centre-scoped,
  // permanent, admins-only channel, not a second implementation.
  const adminChatRooms = await getAdminChatRooms(profile.id, ctx.availableCenterIds);

  // §13: "a single-centre customer never sees it" -- only loaded when there is
  // more than one branch to narrow between.
  const switchable =
    ctx.availableCenterIds.length > 1
      ? (
          (
            await createAdminClient().from("centers").select("id, name, center_number").in("id", ctx.availableCenterIds)
          ).data ?? []
        ).map((c) => ({ id: c.id, name: c.name, centerNumber: c.center_number }))
      : [];

  return (
    <div className="flex min-h-full flex-1 flex-col bg-tint-centre-admin">
      {/* Header: 32px mark + wordmark, a hairline divider, then the pill. */}
      <div className="container flex items-center justify-between gap-6 pt-10">
        <div className="flex items-center gap-3.5">
          <Link href="/centre" className="shrink-0 hover:opacity-80">
            <Wordmark size="header" />
          </Link>
          <span className="h-[18px] w-px bg-border" aria-hidden="true" />
          <span className="rounded-[5px] border border-primary/25 bg-primary/10 px-2.5 py-1 text-[11px] font-bold tracking-[0.1em] text-primary uppercase">
            Centre admin
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-4 text-[13px] text-muted">
          <BranchFilter branches={switchable} />
          <span>{profile.full_name}</span>
          <form action={signOut}>
            <button type="submit" className="hover:text-ink">
              Sign out
            </button>
          </form>
        </div>
      </div>

      <div className="container pt-5">
        <CentreTabs />
      </div>

      <main className="container w-full flex-1 pt-8 pb-6">{children}</main>

      {/* Centre Admin.dc.html: a full-width bar under every tab (Overview,
          Roles, and Import alike), not scoped to any one tab's content --
          it sits after the closing of all three tab blocks in the design's
          own markup. */}
      {can(ctx.roles, "centre.settings.edit") ? (
        <div className="container pb-6">
          <Link
            href="/centre/settings"
            className="flex items-center justify-between gap-4 rounded-[10px] border border-border bg-card px-[22px] py-[18px] hover:border-primary"
          >
            <div className="flex flex-col gap-[3px]">
              <span className="font-serif text-[15px] font-semibold text-ink">Centre settings</span>
              <span className="text-[11.5px] text-muted">
                Centre profile, Google Drive connection, payment providers, admin roles
              </span>
            </div>
            <span className="shrink-0 text-sm font-medium text-primary">Open settings &rarr;</span>
          </Link>
        </div>
      ) : null}

      <div className="container pb-10">
        <DesignerCredit />
      </div>

      {adminChatRooms.length > 0 ? <AdminChatBar profileId={profile.id} rooms={adminChatRooms} /> : null}
    </div>
  );
}
