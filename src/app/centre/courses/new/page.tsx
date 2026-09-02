// Moved out of /dashboard/admin on 2 Sep 2026. Ramy: "It's ironic that centre
// management will click New course, and then the page opens in Course admin.
// They have the key, they open the door, and then Course admin starts doing
// the course."
//
// He was right, and it broke his own one-room-one-door rule: course.create
// belongs to the Centre manager and the Centre owner, NOT to a Course
// administrator -- so the person creating a course was being moved into a
// room they do not work in, greeted by a page describing a role they do not
// hold, before anything had been created. The handover to Course Admin is
// real, but it happens once the course exists, not at step one.
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { can } from "@/lib/auth/centre-permissions";
import { CreateCourseForm } from "@/components/create-course-form";

// The new-course wizard, on its own screen.
//
// Course Admin.dc.html treats these as two different things: 1a is the landing
// page (courses by state, centre material, what changed) and 2a is the setup
// screen, reached by the "New course" button. The wizard used to sit inline
// under the course list on 1a, which meant step 1 was below the fold on a
// screen that is not about creating a course.
export default async function NewCoursePage() {
  const session = await getCurrentProfile();
  if (!session?.profile) redirect("/login");
  if (session.profile.role !== "admin" && session.profile.role !== "platform_owner") redirect("/dashboard");

  // Creating a course is a capability, not a job title.
  //
  // This page only ever checked profiles.role === "admin", so every member
  // of the centre-admin family could open the wizard regardless of what the
  // role builder said -- including Course administrator, whose matrix says
  // Create courses = None. Found 31 Aug 2026 by opening this URL signed in
  // as the demo course administrator and getting the full form. Same class
  // of bug as the import policies: a capability the screen never consulted.
  //
  // platform_owner keeps its own route in, as everywhere else -- Command
  // Center links here with no centre context of its own.
  if (session.profile.role === "admin") {
    const ctx = await getCentreRoleContext(session.profile);
    if (!can(ctx.roles, "course.create", ctx.overrides)) redirect("/centre");
  }

  // Command Center's Create menu links here for platform_owner with no
  // centre context of its own -- active_center_id (set by Owner/Invited
  // entry, same field switchActiveCourse's counterpart already uses) is
  // the best guess of which centre they mean; falls back to their own home
  // centre rather than a dead end when neither is set.
  const targetCenterId = session.profile.active_center_id ?? session.profile.center_id;

  const { data: center } = await createAdminClient()
    .from("centers")
    .select("name, center_number")
    .eq("id", targetCenterId)
    .maybeSingle();

  return (
    <div className="flex flex-col gap-[22px]">
      {/* The design's own opening: an eyebrow, then this exact H1 and
          paragraph, sitting directly above step 1 -- Ramy, 2026-08-17: "It's
          extremely important that [it's] frame by frame telling someone what
          to do, especially if it's the first time... I want it there."
          Verbatim from Course Admin.dc.html, not paraphrased. */}
      <div className="flex flex-col gap-3">
        {/* The heading travelled with the file when this moved out of Course
            Admin, so the wizard sat in Centre Management describing a role
            the person opening it does not hold -- the very thing the move was
            meant to stop. It says what it is now: the act of bringing a
            course into existence, which is Centre Management's. */}
        <p className="text-[11px] font-bold tracking-[0.14em] text-muted uppercase">Connect · centre management</p>
        <h1 className="font-serif text-[34px] leading-[1.15] font-semibold text-ink">
          A new course, from dates to first tutor.
        </h1>
        <p className="max-w-[62ch] text-sm leading-relaxed text-muted text-pretty">
          Five steps: what the course is, how teaching practice is delivered, its dates and weekly pattern, a first
          tutor, then a review before you launch. Creating a course is the centre&apos;s decision — running it is
          the course administrator&apos;s, and it passes to them the moment this is launched. Nothing here is
          final: everything except the delivery mode can be changed afterwards.
        </p>
      </div>

      {/* 1.15fr / 1fr, the design's split for the setup screen. */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1.15fr_1fr]">
        <CreateCourseForm centerNumber={center?.center_number ?? null} />

        <div className="flex flex-col gap-4">
          <div className="card p-5">
            <h2 className="font-serif text-base text-ink">Asked once, read everywhere</h2>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
              The timetable, rotation, observation log, pre-course pack and assessor pack all read the delivery
              mode. Changing it after setup means rebuilding the timetable, so it is asked here rather than left
              to be discovered later.
            </p>
          </div>
          <div className="card card-gold p-5">
            <h2 className="font-serif text-base text-ink">What comes next</h2>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
              Five steps in all. These two settle what the course is and how teaching practice is delivered; the
              rest — assigning a first tutor and reviewing before launch — follow once the course exists.
            </p>
          </div>
        </div>
      </div>

      <Link href="/centre" className="text-sm text-muted underline">
        Back to centre management
      </Link>
    </div>
  );
}
