import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { computeCourseState } from "@/lib/course-progress";
import { toLocalIso, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";
import { getCachedCenter } from "@/lib/supabase/cached-queries";

// for-claude-code-course-admin-landing-and-admissions.md §1: "Closed --
// past courses, collapsed to a simple list/link to history." The landing
// list itself only shows a single summary row for Closed; this is where
// that row links to -- a plain list, since there's nothing left to
// action on any of them, just a way back in if someone needs one.
export default async function ClosedCoursesPage() {
  const profile = await requireRole("admin");
  const supabase = await createClient();
  const timeZone = (await getCachedCenter(profile.center_id))?.time_zone ?? DEFAULT_TIMEZONE;
  const today = toLocalIso(new Date(), timeZone);

  const { data: courses } = await supabase
    .from("courses")
    .select("id, name, start_date, end_date")
    .eq("center_id", profile.center_id)
    .order("end_date", { ascending: false });

  const closedCourses = (courses ?? []).filter((c) => computeCourseState(c.start_date, c.end_date, today) === "closed");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <BackLink href="/dashboard/admin" label="Courses" />
        <h1 className="mt-2 font-serif text-[24px] font-semibold text-ink">Closed courses</h1>
      </div>

      {closedCourses.length > 0 ? (
        <div className="card overflow-hidden !p-0">
          {closedCourses.map((course) => (
            <Link
              key={course.id}
              href={`/dashboard/admin/courses/${course.id}`}
              className="flex items-center justify-between gap-4 border-b border-border-faint px-5 py-3.5 transition-colors duration-150 last:border-none hover:bg-[color-mix(in_oklab,var(--color-primary)_30%,var(--color-card))]"
            >
              <p className="truncate text-sm font-semibold text-ink">{course.name}</p>
              <span className="shrink-0 text-xs text-muted">Ended {course.end_date}</span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-muted">No closed courses yet.</p>
      )}
    </div>
  );
}
