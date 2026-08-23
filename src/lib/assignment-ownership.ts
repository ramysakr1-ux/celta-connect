import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type AssignmentType = "Focus on Learner" | "LRT" | "Skills" | "LfC";

// connect-still-missing-from-code.md item 1: course_tutors.owned_assignment_types
// (migration 0179) already lets the MCT declare who owns which assignment
// type for marking (src/app/trainer/(hub)/roster/manage-tutors-card.tsx,
// src/app/dashboard/admin/courses/[id]/owned-assignments-control.tsx), but
// nothing read it back -- every assignment still needed a manual marker
// pick regardless of ownership already being on file. This is that read
// side: looked up once per course (not per assignment), since every
// trainee's four standard assignments are created together at account
// setup.
export async function defaultMarkerIdsForCourse(
  supabase: SupabaseClient<Database>,
  courseId: string
): Promise<Partial<Record<AssignmentType, string>>> {
  const { data: tutors } = await supabase
    .from("course_tutors")
    .select("profile_id, owned_assignment_types")
    .eq("course_id", courseId)
    .is("left_at", null);

  const result: Partial<Record<AssignmentType, string>> = {};
  for (const t of tutors ?? []) {
    for (const type of t.owned_assignment_types ?? []) {
      // First owner wins if the UI ever lets two tutors claim the same
      // type -- there's no principled tie-break, and whoever actually
      // marks it overwrites this default at marking time regardless.
      if (!(type in result)) result[type as AssignmentType] = t.profile_id;
    }
  }
  return result;
}
