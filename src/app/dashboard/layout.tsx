import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { signOut } from "@/app/login/actions";
import { getInitialStaffChatData } from "@/lib/staff-chat";
import { StaffChatDrawer } from "@/app/dashboard/staff-chat/staff-chat-drawer";
import { getAdminChatRooms } from "@/lib/admin-chat";
import { AdminChatBar } from "@/app/dashboard/admin/admin-chat-bar";
import { Wordmark } from "@/components/wordmark";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { RoomPills } from "@/components/room-pills";
import { AreaTheme } from "@/components/area-theme";
import { can, canView, adminHomePath, roleLabel } from "@/lib/auth/centre-permissions";
import { HeaderDesignerCredit } from "@/components/designer-credit";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentProfile();
  if (!session) {
    // An assessor browsing in tour mode has a token, not a session, so
    // getCurrentProfile() returns null here and they were being redirected
    // to a login they cannot use -- a dead end, from links the trainer hub
    // itself offers them (assignment briefs, marking guidance, a
    // candidate's CELTA 5 record). Ramy, 29 Aug 2026: "once they're out,
    // clicking on anything... there's no way to go back."
    //
    // Send them back to their own pack instead. Deliberately not rendering
    // this section read-only for them: /dashboard is the admin and centre
    // surface, and widening what an assessor can see is a decision to take
    // on purpose, not a side effect of fixing a broken link.
    if (await getAssessorCourseId()) redirect("/assessor");
    redirect("/login");
  }

  const { profile, email } = session;

  const staffChat =
    profile && profile.role !== "trainee" && profile.role !== "admin" ? await getInitialStaffChatData(profile.id) : null;

  // Corrected 2026-08-20: this used to also compute a persistent AdminTabs
  // nav (visibleAdminTabs) rendered in the header below -- removed, it
  // never matched the actual design (see the note on dashboard/admin/
  // page.tsx). centreCtx itself stays -- adminChatRooms below still needs
  // its availableCenterIds.
  const centreCtx = profile?.role === "admin" ? await getCentreRoleContext(profile) : null;
  // Which role this person is acting as, for the header. First held role: a
  // person with several sees the one that decides their landing page, which is
  // the one this section belongs to. roleLabel() covers owner-defined custom
  // roles too, so a centre that invents "Admissions lead" sees that word.
  // Which rooms this person may enter. Course Admin and Admissions are the two
  // that live under /dashboard; Centre Management and the Volunteer pool appear
  // when they hold a centre role, since that is what reaches them.
  //
  // Course admin and Admissions used to be unconditional strings here. This
  // layout also wraps nine pages that belong to the course side and were
  // never moved out of /dashboard -- eight trainer pages and the trainee's
  // TP7/8 syllabus grid -- so a trainer, and a trainee picking her own topic,
  // were both shown two doors into centre administration. They would have
  // been bounced on click, but they should not have been looking at them.
  // Ramy, 1 Sep 2026: "Why would a trainee even get there? This has nothing
  // to do with the course. It's a completely separate building."
  //
  // centreCtx is null for anyone who is not an admin, which is what closes
  // that leak; the capability checks below then match the ones the /centre
  // layout already used, so the two layouts stop disagreeing about who may
  // see which room. roles.length === 0 is the legacy flat-admin case the
  // rest of the codebase already treats as full access.
  const flatAdmin = centreCtx !== null && centreCtx.roles.length === 0;
  const visibleRooms = centreCtx
    ? [
        ...(centreCtx.roles.length > 0 ? ["centre"] : []),
        ...(canView(centreCtx.roles, "volunteers.view", centreCtx.overrides) ? ["volunteers"] : []),
        ...(flatAdmin || can(centreCtx.roles, "courseAdmin.view", centreCtx.overrides) ? ["course-admin"] : []),
        ...(flatAdmin || can(centreCtx.roles, "admissions.manage", centreCtx.overrides) ? ["admissions"] : []),
      ]
    : [];

  const isCentreOwner = centreCtx?.roles.includes("centre_owner") ?? false;
  const actingRoleLabel =
    centreCtx && centreCtx.roles.length > 0 ? roleLabel(centreCtx.roles[0], centreCtx.customRoles ?? []) : null;

  // §12: one room per centre, not per course. Membership follows the role
  // grants, so this covers every branch the person administers.
  const adminChatRooms =
    profile && profile.role === "admin" && centreCtx ? await getAdminChatRooms(profile.id, centreCtx.availableCenterIds) : null;



  return (
    // Wraps header AND main: the section pills live in the header, and they
    // should wear the room's colour like everything else inside it.
    <AreaTheme className="flex min-h-full flex-1 flex-col">
      {/* The rule is per AREA now, not per role. Applying it on
          `role === "admin"` -- which is what shipped on 31 Aug -- was wrong:
          that condition is true across this entire layout, so Course Admin,
          Admissions and staff chat all turned teal and three rooms shared one
          identity. AreaHeaderRule below knows which room is actually showing
          and draws nothing in a room that has no colour yet. */}
      <header className="border-b border-border">
        {/* Two rows on the right (Ramy, 23 Aug 2026): row 1 carries the
            credit via HeaderDesignerCredit, which checks the live pathname
            itself and renders nothing off /dashboard/admin -- landing-only,
            without leaking onto every /dashboard/* route this layout wraps.
            No longer `fixed`: it scrolls away with the header now instead of
            staying pinned to the viewport. Row 2 carries name + sign out,
            which used to collide with the credit when both sat on one line. */}
        <div className="container flex h-14 items-center justify-between gap-6">
          {/* Left group: where you are, then where else you can go. Without
              this wrapper the destination pill became a third child of a
              justify-between row and was flung into the middle of the
              header, floating between the mark and the credit. */}
          <div className="flex min-w-0 items-center gap-3.5">
          {/* The logo keeps you in Course Admin. It used to link to /dashboard,
              whose landing preference sends anyone holding a centre role to
              /centre -- so clicking the logo from inside Course Admin kicked
              you into Centre Admin. Ramy, 27 Aug 2026: "except for my home
              screen, which if I click connect, should take me to command
              center" -- platform_owner gets that fixed destination
              regardless of which layout happens to wrap the current page,
              same rule trainer/(hub)/layout.tsx already applies. */}
          <Link
            href={
              profile?.role === "platform_owner"
                ? "/platform/command-center"
                : profile?.role === "admin" && centreCtx
                  ? adminHomePath(centreCtx.roles)
                  : "/dashboard"
            }
            className="flex shrink-0 items-center gap-3 hover:opacity-80"
          >
            <Wordmark size="header" />
            {/* Course Admin.dc.html's own header carries a role pill beside
                the mark: 11px/700 uppercase at 0.06em with a 5px dot, on a 12%
                accent tint. Centre Admin has the same device at /centre; this
                screen had none, so it read as the generic dashboard rather
                than as the course admin's own view. */}
          </Link>

          {/* The same pill row Centre Management carries, with the teal on
              this view instead. Ramy, 31 Aug 2026: "this is meant to be a
              platform with different views, different job descriptions...
              they need to know where they are."
          
              So it is one row that appears identically in both places and
              answers "whose screen is this", rather than a badge here and a
              different-looking link there. The Course admin badge used to be
              a rounded-full pill with a dot, nested inside the wordmark
              link; it is the same shape as its neighbours now, and outside
              the link, since a label is not part of going home.
          
              The way back also had to exist at all: the logo used to link to
              /dashboard, whose landing preference sends anyone holding a
              centre role to /centre, so clicking the mark from inside Course
              Admin kicked you out of it. Pinning the logo to /dashboard/admin
              fixed that and removed the only door. */}
          {profile?.role === "admin" ? (
            <>
            </>
          ) : null}
          </div>
          <HeaderDesignerCredit landingPath="/dashboard/admin" />
        </div>
        <div className="container flex items-center justify-end gap-4 pb-2.5 text-sm text-muted">
          {/* The role sits next to the name rather than on a line of its own.
              Ramy, 31 Aug 2026, asked whether the header was needed: the
              identity already prints here, so a separate "Signed in as..."
              strip would have said the name twice. What was missing is only
              which role you are acting as -- someone can hold several -- so
              that is the single word added, where people already look to see
              who they are. */}
          <span>
            {profile?.full_name ?? email}
            {/* For an owner the role label is a link to their own screen.
                Ramy, 1 Sep 2026, noticing the gap: the owner screen is not one
                of the four rooms, so the Connect mark was its ONLY entrance --
                one unlabelled door to the page that belongs to them. Their own
                name and role is the honest second one: it says what it is, and
                needs no new furniture. Everyone else keeps a plain label,
                because a course administrator's home is already a pill. */}
            {actingRoleLabel ? (
              isCentreOwner ? (
                <>
                  {" "}&middot;{" "}
                  <Link href="/centre/owner" className="text-muted underline-offset-2 hover:text-ink hover:underline">
                    {actingRoleLabel}
                  </Link>
                </>
              ) : (
                <span className="text-muted"> &middot; {actingRoleLabel}</span>
              )
            ) : null}
          </span>
          <form action={signOut}>
            <button type="submit" className="hover:text-ink">
              Sign out
            </button>
          </form>
        </div>
      </header>

      {/* The pills sit on the page, not in the header. Measured before moving
          them: the dropped pill was 132px right of the page edge and 57px above
          the surface it is meant to be attached to, because it was inline with
          the wordmark. Ramy: "they should align... aligned, obviously, with the
          page. So on the left." */}
      <div className="container pt-5">
        <RoomPills visible={visibleRooms} />
      </div>

      <main className="container w-full flex-1 pb-8">
        <div className="frame room-surface p-6">{children}</div>
      </main>

      {profile && staffChat ? (
        <StaffChatDrawer profileId={profile.id} initialChannels={staffChat.channels} coworkers={staffChat.coworkers} />
      ) : null}
      {profile && adminChatRooms ? <AdminChatBar profileId={profile.id} rooms={adminChatRooms} /> : null}
    </AreaTheme>
  );
}
