import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";

export default async function DashboardIndexPage() {
  const session = await getCurrentProfile();
  if (!session) redirect("/login");

  const { profile, email } = session;

  if (!profile) {
    return (
      <div className="card p-6">
        <h1 className="font-serif text-xl text-ink">Account not set up yet</h1>
        <p className="mt-2 text-muted">
          {email} is signed in, but no profile exists for this account yet.
          Ask your center admin to add you to a course.
        </p>
      </div>
    );
  }

  redirect(`/dashboard/${profile.role}`);
}
