import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { courseDayOf, getCourseDays } from "@/lib/course-day";

// When each assignment opens, read off the course's own timetable.
//
// design_handoff_assignments §7: "An assignment is readable from day 1 but
// writable only from its Released day on the course timetable -- always
// resolved from the course's own timetable, never hard-coded." The release
// day is the earliest timetabled event tagged with that assignment type
// (`course_timetable_events.linked_assignment_type`), which is the input
// session that sets it.
//
// Two screens need the same answer -- the assignments list, to mark the ones
// that have not opened, and the assignment itself, to render locked -- so it
// is resolved once here rather than twice, slightly differently.

export interface AssignmentRelease {
  /** The date the assignment opens for writing. */
  date: string;
  /** That date as a course day number, for "Opens Day 9". */
  day: number | null;
}

export interface CourseReleaseClock {
  /** The course's distinct timetabled dates, in order. */
  days: string[];
  /** Release date + day, keyed by assignment_type. Absent = never set. */
  releaseByType: Map<string, AssignmentRelease>;
  /** Today, in the centre's own zone. */
  today: string;
  /** True once the assignment type's release day has arrived. */
  isOpen: (assignmentType: string) => boolean;
  /** A due (or any) date as a course day number. */
  dayOf: (date: string | null) => number | null;
}

export async function getCourseReleaseClock(
  supabase: SupabaseClient<Database>,
  courseId: string,
  today: string
): Promise<CourseReleaseClock> {
  const [days, { data: settingEvents }] = await Promise.all([
    getCourseDays(supabase, courseId),
    supabase
      .from("course_timetable_events")
      .select("linked_assignment_type, event_date")
      .eq("course_id", courseId)
      .not("linked_assignment_type", "is", null),
  ]);

  const earliest = new Map<string, string>();
  for (const e of settingEvents ?? []) {
    if (!e.linked_assignment_type) continue;
    const existing = earliest.get(e.linked_assignment_type);
    if (!existing || e.event_date < existing) earliest.set(e.linked_assignment_type, e.event_date);
  }

  const releaseByType = new Map<string, AssignmentRelease>();
  for (const [type, date] of earliest) releaseByType.set(type, { date, day: courseDayOf(days, date) });

  return {
    days,
    releaseByType,
    today,
    // No release event at all means the centre has not timetabled the input
    // session that sets it. Open, not locked -- a missing timetable row must
    // never be the thing that stops a candidate writing.
    isOpen: (assignmentType: string) => {
      const release = releaseByType.get(assignmentType);
      return !release || release.date <= today;
    },
    dayOf: (date: string | null) => courseDayOf(days, date),
  };
}
