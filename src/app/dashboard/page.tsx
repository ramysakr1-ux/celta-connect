import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { resolveLandingPath } from "@/lib/auth/landing-path";

// Per the architecture-plan's SS1.1c landing routing -- the actual
// role-to-path rules live in resolveLandingPath (shared with signIn in
// login/actions.ts, which redirects straight to the resolved path instead
// of bouncing through this page as an extra hop). This page still exists
// as the fallback destination for anything that doesn't have its own
// signed-in-elsewhere shortcut (e.g. a stale bookmark, or middleware
// redirecting an expired-session request back through /dashboard).
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
          Ask your centre admin to add you to a course.
        </p>
      </div>
    );
  }

  redirect(await resolveLandingPath(profile));
}
