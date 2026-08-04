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

  // Per the architecture-plan's SS1.1c landing routing: trainer -> /trainer
  // (Command Centre, not a portfolio), trainee -> their own /portfolio/:id
  // (Course Stream tab). Admin isn't covered by that doc at all and keeps
  // its existing /dashboard/admin home. The old /dashboard/trainer and
  // /dashboard/trainee pages still exist (not deleted) but are superseded
  // -- every trainer/trainee session was landing on them instead of the
  // rebuilt pages until this fix, since this was the only entry point and
  // it predated the SS13 rebuild.
  if (profile.role === "trainer") redirect("/trainer");
  if (profile.role === "trainee") redirect(`/portfolio/${profile.id}`);
  redirect(`/dashboard/${profile.role}`);
}
