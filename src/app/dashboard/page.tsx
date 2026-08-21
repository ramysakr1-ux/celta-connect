import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { landingFor } from "@/lib/auth/centre-permissions";

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
  // Sits above every centre -- its own landing, not a centre/course one
  // (connect-platform-owner-role-spec-2026-08-22.md).
  if (profile.role === "platform_owner") redirect("/platform");

  // Centre Admin and Course Admin are two separate roles with two separate
  // landing screens -- "never merge these two builds". Until now one flat
  // `admin` sent everyone to /dashboard/admin, which is the Course Admin
  // screen (its own handoff: "the CELTA main course tutor's own credentials"),
  // so a centre administrator landed on a course-shaped page. Which door you
  // get is now decided by what you actually hold.
  //
  // Anyone with no centre_roles grant keeps the old destination exactly, so
  // nobody is stranded while grants are still being handed out.
  if (profile.role === "admin") {
    const ctx = await getCentreRoleContext(profile);
    const landing = landingFor(ctx.roles);
    if (landing === "centre-admin") redirect("/centre");
    if (landing === "course-admin") redirect("/dashboard/admin");
  }

  redirect(`/dashboard/${profile.role}`);
}
