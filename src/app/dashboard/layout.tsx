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
              profile?.role === "admin"
                ? "/dashboard/admin"
                : profile?.role === "platform_owner"
                  ? "/platform/command-center"
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
            {profile?.role === "admin" ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[color-mix(in_oklab,var(--color-primary)_28%,transparent)] bg-[color-mix(in_oklab,var(--color-primary)_12%,var(--color-card))] px-2.5 py-0.5 text-[11px] font-bold tracking-[0.06em] text-primary uppercase">
                <span className="size-[5px] rounded-full bg-current" />
                Course admin
              </span>
            ) : null}
          </Link>

          {/* The way back to Centre Management.
          
              Ramy, 30 Aug 2026: "course admin has no way back to centre
              management." Correct, and it was a side effect of the right
              fix: the logo used to link to /dashboard, whose landing
              preference bounced anyone with a centre role into /centre, so
              clicking the mark from inside Course Admin kicked you out of
              it. That was fixed by pinning the logo to /dashboard/admin --
              which removed the only door, rather than replacing it.
          
              Shown to anyone holding a centre role, which in this layout is
              anyone it renders for at all. My first attempt gated it on
              landingFor() === "centre-admin", reasoning that a pure course
              administrator has no Centre Management to return to -- but
              that was wrong, and checking rather than assuming caught it:
              signed in as the demo course administrator, who holds nothing
              but course_administrator, /centre renders Centre overview with
              its tabs, no redirect. The spec says so too -- that role is
              "everything a centre administrator can do, scoped to named
              courses... other courses, in outline only", which is a
              centre-level view by definition. The narrow gate would have
              hidden the door from precisely the person who complained it
              was missing.
          
              Mirrors the pill /centre uses for Centre Owner -- a second
              place you can go, not a tab of this one. */}
          {centreCtx && centreCtx.roles.length > 0 ? (
            <Link
              href="/centre"
              className="admin-hover-fill shrink-0 rounded-[5px] border border-primary/25 bg-primary/10 px-2.5 py-1 text-[11px] font-bold tracking-[0.1em] text-primary uppercase"
            >
              Centre management
            </Link>
          ) : null}
          <HeaderDesignerCredit landingPath="/dashboard/admin" />
        </div>
        <div className="container flex items-center justify-end gap-4 pb-2.5 text-sm text-muted">
          <span>{profile?.full_name ?? email}</span>
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
