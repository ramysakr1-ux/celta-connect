import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { signOut } from "@/app/login/actions";
import { Wordmark } from "@/components/wordmark";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { can } from "@/lib/auth/centre-permissions";
import { CentreSettingsCard } from "@/app/centre/settings-card";
import { CentreTabs } from "@/app/centre/centre-tabs";
import { BranchFilter } from "@/app/centre/branch-filter";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminChatRooms } from "@/lib/admin-chat";
import { AdminChatBar } from "@/app/dashboard/admin/admin-chat-bar";
import { HeaderDesignerCredit } from "@/components/designer-credit";

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
  //
  // Ramy, 27 Aug 2026: this and the branch-switcher query below were
  // sequential -- neither depends on the other's result, both only need
  // ctx.availableCenterIds -- so they run concurrently now (one of several
  // fixes for the ~2.6-2.9s measured per /centre navigation).
  const [adminChatRooms, switchableRaw] = await Promise.all([
    getAdminChatRooms(profile.id, ctx.availableCenterIds),
    // §13: "a single-centre customer never sees it" -- only loaded when there is
    // more than one branch to narrow between.
    ctx.availableCenterIds.length > 1
      ? createAdminClient().from("centers").select("id, name, center_number").in("id", ctx.availableCenterIds)
      : Promise.resolve({ data: [] as { id: string; name: string; center_number: string | null }[] }),
  ]);
  const switchable = (switchableRaw.data ?? []).map((c) => ({ id: c.id, name: c.name, centerNumber: c.center_number }));

  return (
    <div className="flex min-h-full flex-1 flex-col">
      {/* Header: 32px mark + wordmark, a hairline divider, then the pill.
          Two rows on the right (Ramy, 23 Aug 2026): row 1 leaves headroom
          for the fixed DesignerCredit badge (rendered from centre/page.tsx
          itself, landing-page-only); row 2 carries the branch filter, name
          and sign out, which used to collide with the credit on one line. */}
      <div className="container flex items-center justify-between gap-6 pt-10">
        <div className="flex items-center gap-3.5">
          {/* Ramy, 27 Aug 2026: "except for my home screen, which if I click
              connect, should take me to command center" -- same fixed
              destination as every other layout's logo for platform_owner,
              regardless of which section they entered Centre Management from. */}
          <Link href={profile.role === "platform_owner" ? "/platform/command-center" : "/centre"} className="shrink-0 hover:opacity-80">
            <Wordmark size="header" />
          </Link>
          <span className="h-[18px] w-px bg-border" aria-hidden="true" />
          <span className="rounded-[5px] border border-primary/25 bg-primary/10 px-2.5 py-1 text-[11px] font-bold tracking-[0.1em] text-primary uppercase">
            Centre management
          </span>
          {/* for-claude-code-centre-owner-role-customizer.md: "a deliberately
              different register... not a fifth tab that happens to look the
              same" -- garnet, not teal, and its own destination rather than
              a CentreTabs entry, so it never reads as just another tab. */}
          {ctx.roles.includes("centre_owner") ? (
            <Link
              href="/centre/owner"
              className="rounded-[5px] px-2.5 py-1 text-[11px] font-bold tracking-[0.1em] text-white uppercase"
              style={{ background: "oklch(42% 0.15 27)" }}
            >
              Centre owner
            </Link>
          ) : null}
        </div>
        <HeaderDesignerCredit landingPath="/centre" />
      </div>
      <div className="container flex items-center justify-end gap-4 pt-2 text-[13px] text-muted">
        <BranchFilter branches={switchable} />
        <span>{profile.full_name}</span>
        <form action={signOut}>
          <button type="submit" className="hover:text-ink">
            Sign out
          </button>
        </form>
      </div>

      <div className="container pt-5">
        <CentreTabs />
      </div>

      <main className="container w-full flex-1 pt-8 pb-6">
        <div className="frame p-6">{children}</div>
      </main>

      {/* Centre Admin.dc.html: a full-width bar under every tab (Overview,
          Roles, and Import alike), not scoped to any one tab's content --
          it sits after the closing of all three tab blocks in the design's
          own markup. */}
      {/* Ramy, 26 Aug 2026: "we need to push centre settings up because the
          chat pill is at the bottom fixed, and it's covering it." The pill
          is fixed with real height plus its own offset from the screen
          edge -- pb-6 alone left this card underneath it at the bottom of
          the page. */}
      {/* Hides itself on /centre/settings -- this layout wraps that page
          too, so the bar was inviting you to open the page you were already
          standing on. The permission check stays here on the server; only
          "am I already there" needs the client. */}
      {can(ctx.roles, "centre.settings.edit", ctx.overrides) ? <CentreSettingsCard /> : null}

      {adminChatRooms.length > 0 ? <AdminChatBar profileId={profile.id} rooms={adminChatRooms} /> : null}
    </div>
  );
}
