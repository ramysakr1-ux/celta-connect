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
      <div className="flex flex-col gap-[5px]">
        <p className="text-[11px] font-bold tracking-[0.1em] text-muted uppercase">
          {center?.name ?? "Your centre"}
          {center?.center_number ? ` · Centre ${center.center_number}` : ""}
        </p>
        <h1 className="font-serif text-[24px] font-semibold text-ink">Course setup</h1>
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
          <div className="card p-5">
            <h2 className="font-serif text-base text-ink">What comes next</h2>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
              Six steps in all. These two settle what the course is and how teaching practice is delivered; the
              rest — levels, groups, the timetable — follow once the course exists.
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
