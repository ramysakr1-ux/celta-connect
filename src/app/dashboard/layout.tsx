import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { signOut } from "@/app/login/actions";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentProfile();
  if (!session) redirect("/login");

  const { profile, email } = session;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="font-serif text-lg text-ink">Celta Connect</span>
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

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</main>

      <footer className="px-6 py-4 text-right text-xs text-muted">
        Designed by Ramy
      </footer>
    </div>
  );
}
