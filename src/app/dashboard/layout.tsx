import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { signOut } from "@/app/login/actions";
import { getInitialStaffChatData } from "@/lib/staff-chat";
import { StaffChatDrawer } from "@/app/dashboard/staff-chat/staff-chat-drawer";
import { getAdminChatCourses } from "@/lib/admin-chat";
import { AdminChatBar } from "@/app/dashboard/admin/admin-chat-bar";
import { Wordmark } from "@/components/wordmark";
import { AdminTabs } from "@/app/dashboard/admin/admin-tabs";
import { visibleAdminTabs } from "@/lib/auth/admin-tabs";
import { CentreSwitcher } from "@/app/dashboard/centre-switcher";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { createAdminClient } from "@/lib/supabase/admin";

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
  const adminChatCourses = profile && profile.role === "admin" ? await getAdminChatCourses(profile.id) : null;

  // The nav is built from what this person can actually do, not from
  // role === "admin". The spec's read-only role is defined by absence -- "the
  // buttons simply are not there" -- and a tab is a button: a Centre manager
  // must not see Import at all, since an import creates people.
  const centreCtx = profile?.role === "admin" ? await getCentreRoleContext(profile) : null;
  const centreRoles = centreCtx?.roles ?? [];
  const tabs = profile?.role === "admin" ? visibleAdminTabs(centreRoles) : [];

  // Only loaded when there is more than one centre to offer -- a single-centre
  // person never sees a control that would do nothing.
  //
  // Read through the admin client because `centers` may only be selected where
  // id = current_center_id() (migration 0001) -- one centre by definition, so
  // a session can never read the name of the other branch it is entitled to
  // switch into. The authority is still the grant: only ids already proven to
  // be in availableCenterIds are fetched, and only name and centre number are
  // exposed. Caught live: without this the switcher silently never appeared.
  const switchable =
    centreCtx && centreCtx.availableCenterIds.length > 1
      ? ((
          await createAdminClient()
            .from("centers")
            .select("id, name, center_number")
            .in("id", centreCtx.availableCenterIds)
        ).data ?? []).map((c) => ({ id: c.id, name: c.name, centerNumber: c.center_number }))
      : [];

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border">
        <div className="container flex h-14 items-center justify-between gap-6">
          <Link href="/dashboard" className="shrink-0 hover:opacity-80">
            <Wordmark size="header" />
          </Link>
          {tabs.length > 0 ? <AdminTabs tabs={tabs} /> : null}
          <div className="flex shrink-0 items-center gap-4 text-sm text-muted">
            <CentreSwitcher centres={switchable} activeId={centreCtx?.activeCenterId ?? null} />
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
      {profile && adminChatCourses ? <AdminChatBar profileId={profile.id} courses={adminChatCourses} /> : null}
    </div>
  );
}
