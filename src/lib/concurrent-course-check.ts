// for-claude-code-concurrent-course-checks.md, Handbook 3.7 (exact text
// quoted there): a tutor engaged on two concurrent full-time courses is
// blocked outright (well-being/quality rule, not a capacity guess);
// full-time + part-time is explicitly allowed; multiple part-time courses
// is allowed but treated as a soft/visible judgment call, same tier as the
// assessor rule (13.3, out of scope for this function -- assessor is
// visible-only, never blocked, per the same doc).
//
// Scope is decided by the caller: "same centre only", and "trainee/TinT
// involvement... exempt" and "management-only involvement... exempt" both
// mean the caller should never pass an exempt course_tutors row in here at
// all, not that this function special-cases them.

export interface CourseWindow {
  id: string;
  is_part_time: boolean;
  start_date: string;
  end_date: string;
}

export type ConcurrencyCheckResult =
  | { level: "blocked"; course: CourseWindow; reason: string }
  | { level: "warn"; course: CourseWindow; reason: string }
  | { level: "ok" };

function overlaps(a: CourseWindow, b: CourseWindow): boolean {
  // Tail overlap (one course's last week while another starts) is just an
  // ordinary date-range overlap -- the doc says it "follows the same
  // FT/PT combination rule above", i.e. no separate handling needed.
  return a.start_date <= b.end_date && b.start_date <= a.end_date;
}

/**
 * Checks whether assigning a tutor to `target` conflicts with their
 * existing active course links (`existing`), all already filtered by the
 * caller to: same centre, active (left_at is null), and non-exempt
 * (excludes trainee/TinT-only and management-only involvement).
 */
export function checkConcurrentCourseAssignment(
  target: CourseWindow,
  existing: CourseWindow[]
): ConcurrencyCheckResult {
  const overlapping = existing.filter((course) => course.id !== target.id && overlaps(target, course));

  const fullTimeClash = overlapping.find((course) => !target.is_part_time && !course.is_part_time);
  if (fullTimeClash) {
    return {
      level: "blocked",
      course: fullTimeClash,
      reason:
        "This tutor is already on another full-time course over this period. Handbook 3.7: a tutor must not be engaged on more than one full-time course concurrently.",
    };
  }

  const partTimeClash = overlapping.find((course) => target.is_part_time && course.is_part_time);
  if (partTimeClash) {
    return {
      level: "warn",
      course: partTimeClash,
      reason:
        "This tutor is already on another part-time course over this period. Handbook 3.7 allows this, but asks the same well-being/quality judgment to be applied.",
    };
  }

  return { level: "ok" };
}
