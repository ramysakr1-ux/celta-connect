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
import { PILL_ACTIVE, PILL_INACTIVE } from "@/app/centre/header-pill-styles";
import { adminHomePath, roleLabel } from "@/lib/auth/centre-permissions";
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
  const actingRoleLabel =
    centreCtx && centreCtx.roles.length > 0 ? roleLabel(centreCtx.roles[0], centreCtx.customRoles ?? []) : null;

  // §12: one room per centre, not per course. Membership follows the role
  // grants, so this covers every branch the person administers.
  const adminChatRooms =
    profile && profile.role === "admin" && centreCtx ? await getAdminChatRooms(profile.id, centreCtx.availableCenterIds) : null;



  return (
    <div className="flex min-h-full flex-1 flex-col">
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
              <span className="h-[18px] w-px shrink-0 bg-border" aria-hidden="true" />
              {/* Centre management FIRST, then Course admin -- the same order
                  CentreHeaderPills uses, and the order never changes.

                  It used to put whichever section you were in first, so the
                  pair read [Course admin][Centre management] here and
                  [Centre management][Course admin] over there. Both the teal
                  and the position moved at once, which cancels the signal:
                  the leftmost pill meant something different depending on
                  where you already were, so it could not tell you where you
                  were. Ramy walked into exactly that on 31 Aug 2026 -- "I was
                  in course admin, not centre management" -- having asked for
                  the opposite back on the 30th: "when one pill is active, the
                  other one is inactive, so that the green teal is sort of
                  jumping between them." Teal can only jump between two things
                  that hold still. */}
              {centreCtx && centreCtx.roles.length > 0 ? (
                <Link href="/centre" className={PILL_INACTIVE}>
                  Centre management
                </Link>
              ) : null}
              <span className={PILL_ACTIVE}>Course admin</span>
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
            {actingRoleLabel ? <span className="text-muted"> &middot; {actingRoleLabel}</span> : null}
          </span>
          <form action={signOut}>
            <button type="submit" className="hover:text-ink">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="container w-full flex-1 py-8">
        <div className="frame p-6">{children}</div>
      </main>

      {profile && staffChat ? (
        <StaffChatDrawer profileId={profile.id} initialChannels={staffChat.channels} coworkers={staffChat.coworkers} />
      ) : null}
      {profile && adminChatRooms ? <AdminChatBar profileId={profile.id} rooms={adminChatRooms} /> : null}
    </div>
  );
}
