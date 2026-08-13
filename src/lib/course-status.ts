import type { CourseStatus } from "@/lib/supabase/types";

// specs/build-spec.md §3 -- shared across every place a trainee's
// course-leaving status needs a human label or a "is this portfolio
// read-only" check. Only 'withdrawn' has real behaviour behind it so far;
// the other three are named here so later phases don't need to touch every
// call site again when they land.
export const COURSE_STATUS_LABEL: Record<CourseStatus, string> = {
  active: "Active",
  withdrawn: "Withdrawn",
  deferred: "Deferred",
  restarting: "Restarting",
  extension: "Extension",
};

export function isCourseStatusReadOnly(status: CourseStatus): boolean {
  return status !== "active";
}
