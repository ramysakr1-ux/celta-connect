import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { landingFor } from "@/lib/auth/centre-permissions";
import { createAdminClient } from "@/lib/supabase/admin";

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
  // (connect-platform-owner-role-spec-2026-08-22.md). Sticky, not fixed:
  // "I land on my landing page on that course. My landing page on the
  // course also has access to the command center" -- login continues
  // wherever the platform_owner last was, same as switching tabs, not
  // switching accounts. Only lands on the Command Center itself when
  // they're not currently linked into any course.
  if (profile.role === "platform_owner") {
    if (profile.course_id) {
      const admin = createAdminClient();
      const { data: link } = await admin
        .from("course_tutors")
        .select("id")
        .eq("course_id", profile.course_id)
        .eq("profile_id", profile.id)
        .is("left_at", null)
        .maybeSingle();
      if (link) redirect("/trainer");
    }
    redirect("/platform/command-center");
  }

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
