import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { signOut } from "@/app/login/actions";
import { getInitialStaffChatData } from "@/lib/staff-chat";
import { StaffChatDrawer } from "@/app/dashboard/staff-chat/staff-chat-drawer";
import { Wordmark } from "@/components/wordmark";
import { DesignerCredit } from "@/components/designer-credit";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentProfile();
  if (!session) redirect("/login");

  const { profile, email } = session;

  const staffChat =
    profile && profile.role !== "trainee" ? await getInitialStaffChatData(profile.id) : null;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border">
        <div className="container flex items-center justify-between py-4">
          <Link href="/dashboard" className="hover:opacity-80">
            <Wordmark size="header" />
          </Link>
          <div className="flex items-center gap-4 text-sm text-muted">
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

      <footer className="flex justify-end px-6 py-4">
        <DesignerCredit />
      </footer>

      {profile && staffChat ? (
        <StaffChatDrawer
          profileId={profile.id}
          initialChannels={staffChat.channels}
          coworkers={staffChat.coworkers}
        />
      ) : null}
    </div>
  );
}
