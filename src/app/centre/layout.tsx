import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { signOut } from "@/app/login/actions";
import { Wordmark } from "@/components/wordmark";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { can, canView, adminHomePath } from "@/lib/auth/centre-permissions";
import { RoomPills } from "@/components/room-pills";
import { AreaTheme } from "@/components/area-theme";
import { CentreTabs } from "@/app/centre/centre-tabs";
import { CentreHeaderMeta } from "@/app/centre/header-meta";
import { OwnerBranchRow } from "@/app/centre/owner-branch-row";
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

  // Same four rooms as the /dashboard side, gated on what this person can
  // actually reach, so nobody is shown a door that will bounce them.
  //
  // The volunteer pool was hardcoded in alongside Centre management, so an
  // owner-defined custom role -- whose baseline is "none" until the owner
  // grants something -- was shown a door into it regardless. Built-in roles
  // all hold volunteers.view, so this changes nothing for them; it is the
  // custom roles the owner invents that it protects.
  const visibleRooms = [
    "centre",
    ...(canView(ctx.roles, "volunteers.view", ctx.overrides) ? ["volunteers"] : []),
    // canView, not can: this capability is called .view, and an owner who
    // grants a role read-level Course admin means them to be able to look at
    // it. Gated on can() the pill vanished at read level while the page
    // itself let them straight in -- access with no door, the mirror of the
    // doors-with-no-access we removed this morning.
    ...(canView(ctx.roles, "courseAdmin.view", ctx.overrides) ? ["course-admin"] : []),
    // canView on admissions.view, not can() on admissions.manage. The
    // Centre observer is read-only across the whole centre and holds
    // admissions.view at read level, so gating the door on "can act" hid
    // the room from the one role defined by looking at it.
    //
    // It also caused a regression I introduced this morning: this centre
    // grants that role import.run by override, and moving the applicant
    // importer into Admissions left them holding the capability with no
    // door to it -- they had one while Import was a Centre Management tab.
    ...(canView(ctx.roles, "admissions.view", ctx.overrides) ? ["admissions"] : []),
  ];

  // Settings follows the capability its own page enforces.
  const canSettings = can(ctx.roles, "centre.settings.edit", ctx.overrides);

  return (
    /* Picks the room by path rather than hardcoding, because /centre holds
       more than one: the volunteer pool is its own room with its own colour,
       and everything else is Centre Management. */
    <AreaTheme className="flex min-h-full flex-1 flex-col">
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
          <Link
            href={profile.role === "platform_owner" ? "/platform/command-center" : adminHomePath(ctx.roles)}
            className="shrink-0 hover:opacity-80"
          >
            <Wordmark size="header" />
          </Link>
        </div>
        {/* The garnet Centre owner pill is gone: Connect is the way home
            now, and for an owner home IS the owner screen. Ramy: "you don't
            need a Centre owner pill. You just click on Connect." */}
        <HeaderDesignerCredit landingPath="/centre" />
      </div>
      <div className="container flex items-center justify-end gap-4 pt-2 text-[13px] text-muted">
        <CentreHeaderMeta
          branches={switchable}
          fullName={profile.full_name}
          isOwner={ctx.roles.includes("centre_owner")}
        />
        <form action={signOut}>
          <button type="submit" className="hover:text-ink">
            Sign out
          </button>
        </form>
      </div>

      {/* Centre Management's own 3px rule, in bronze -- the quieter half of
          the coloured-band pattern the owner screen, the volunteer pool and
          the trainer hub already use. This header is two container rows
          sitting on the page ground rather than a bar, so the rule goes under
          the whole block instead of on a header element.

          Bronze, not garnet: garnet already names the ACT in the trainer hub,
          and one hue should not mean two unrelated things. globals.css calls
          --color-bronze "the third accent, from the Centre Admin design
          system" -- it was made for this section. */}
      <OwnerBranchRow branches={switchable} />

      {/* The pills sit on the page, not in the header. Measured before moving
          them: the dropped pill was 132px right of the page edge and 57px above
          the surface it is meant to be attached to, because it was inline with
          the wordmark. Ramy: "they should align... aligned, obviously, with the
          page. So on the left." */}
      <div className="container pt-5">
        <RoomPills visible={visibleRooms} />
      </div>

      {/* Under the pills, not above them: you choose a room, then a page
          within it. The tabs used to come first, which put a room's inner
          navigation on top of the control that picks the room. */}
      <div className="container pt-4">
        <CentreTabs canSettings={canSettings} />
      </div>

      <main className="container w-full flex-1 pb-6">
        <div className="frame room-surface p-6">{children}</div>
      </main>


      {adminChatRooms.length > 0 ? <AdminChatBar profileId={profile.id} rooms={adminChatRooms} /> : null}
    </AreaTheme>
  );
}
