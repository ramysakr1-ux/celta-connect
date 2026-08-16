import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { signOut } from "@/app/login/actions";
import { getInitialStaffChatData } from "@/lib/staff-chat";
import { StaffChatDrawer } from "@/app/dashboard/staff-chat/staff-chat-drawer";
import { getAdminChatRooms } from "@/lib/admin-chat";
import { AdminChatBar } from "@/app/dashboard/admin/admin-chat-bar";
import { Wordmark } from "@/components/wordmark";
import { AdminTabs } from "@/app/dashboard/admin/admin-tabs";
import { visibleAdminTabs } from "@/lib/auth/admin-tabs";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentProfile();
  if (!session) redirect("/login");

  const { profile, email } = session;

  const staffChat =
    profile && profile.role !== "trainee" && profile.role !== "admin" ? await getInitialStaffChatData(profile.id) : null;

  // The nav is built from what this person can actually do, not from
  // role === "admin". The spec's read-only role is defined by absence -- "the
  // buttons simply are not there" -- and a tab is a button: a Centre manager
  // must not see Import at all, since an import creates people.
  const centreCtx = profile?.role === "admin" ? await getCentreRoleContext(profile) : null;
  const centreRoles = centreCtx?.roles ?? [];
  const tabs = profile?.role === "admin" ? visibleAdminTabs(centreRoles) : [];

  // §12: one room per centre, not per course. Membership follows the role
  // grants, so this covers every branch the person administers.
  const adminChatRooms =
    profile && profile.role === "admin" && centreCtx ? await getAdminChatRooms(profile.id, centreCtx.availableCenterIds) : null;



  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border">
        <div className="container flex h-14 items-center justify-between gap-6">
          {/* The logo keeps you in Course Admin. It used to link to /dashboard,
              whose landing preference sends anyone holding a centre role to
              /centre -- so clicking the logo from inside Course Admin kicked
              you into Centre Admin. */}
          <Link href={profile?.role === "admin" ? "/dashboard/admin" : "/dashboard"} className="flex shrink-0 items-center gap-3 hover:opacity-80">
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
          {tabs.length > 0 ? <AdminTabs tabs={tabs} /> : null}
          <div className="flex shrink-0 items-center gap-4 text-sm text-muted">
            <span>{profile?.full_name ?? email}</span>
            <form action={signOut}>
              <button type="submit" className="hover:text-ink">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="container w-full flex-1 py-8">{children}</main>

      {profile && staffChat ? (
        <StaffChatDrawer
          profileId={profile.id}
          initialChannels={staffChat.channels}
          coworkers={staffChat.coworkers}
          retentionDays={staffChat.chatRetentionDays}
        />
      ) : null}
      {profile && adminChatRooms ? <AdminChatBar profileId={profile.id} rooms={adminChatRooms} /> : null}
    </div>
  );
}
