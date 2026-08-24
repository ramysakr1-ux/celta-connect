import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { CreateCourseForm } from "@/app/dashboard/admin/create-course-form";

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
  if (session.profile.role !== "admin") redirect("/dashboard");

  const { data: center } = await createAdminClient()
    .from("centers")
    .select("name, center_number")
    .eq("id", session.profile.center_id)
    .maybeSingle();

  return (
    <div className="flex flex-col gap-[22px]">
      {/* The design's own opening: an eyebrow, then this exact H1 and
          paragraph, sitting directly above step 1 -- Ramy, 2026-08-17: "It's
          extremely important that [it's] frame by frame telling someone what
          to do, especially if it's the first time... I want it there."
          Verbatim from Course Admin.dc.html, not paraphrased. */}
      <div className="flex flex-col gap-3">
        <p className="text-[11px] font-bold tracking-[0.14em] text-muted uppercase">Connect · course admin</p>
        <h1 className="font-serif text-[34px] leading-[1.15] font-semibold text-ink">
          Course admin — the CELTA trainer&apos;s own credentials to run a course.
        </h1>
        <p className="max-w-[62ch] text-sm leading-relaxed text-muted text-pretty">
          Distinct from Centre Management — a separate role and a separate link, covering payments and volunteer
          students (built elsewhere). This is the main course tutor&apos;s own view: setting up a course, its
          roster, groups, invitations, and course-level settings. Everything reusable — TP points, assignment
          briefs, resources, feedback examples, the Drive connection — is shared by every course this trainer runs.
          Everything about a person is course-level and leaves at close-out.
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

      <Link href="/dashboard/admin" className="text-sm text-muted underline">
        Back to courses
      </Link>
    </div>
  );
}
