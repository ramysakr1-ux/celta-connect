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

// Withdrawn/deferred/restarting are genuine "left" states -- the portfolio
// freezes. Extension is different: the candidate is still actively
// working, just past the normal end date, so it must stay editable.
const READ_ONLY_STATUSES: readonly CourseStatus[] = ["withdrawn", "deferred", "restarting"];

export function isCourseStatusReadOnly(status: CourseStatus): boolean {
  return READ_ONLY_STATUSES.includes(status);
}

// Anything worth a badge somewhere, whether or not it freezes the
// portfolio -- i.e. every non-'active' status, extension included.
export function isCourseStatusNotable(status: CourseStatus): boolean {
  return status !== "active";
}
