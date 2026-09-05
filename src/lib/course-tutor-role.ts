import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

// The one live source for "what is this person on this course": the
// course_tutors row for the course actually open. profiles.tutor_role is
// set once at signup and never re-synced, and a platform_owner never has it
// at all -- every screen that guessed from it disagreed with the layout.
//
// cache()'d per request: the hub layout, Today, Assessor, the TinT page and
// the assessor preview all ask this for the same (course, person) in the
// same render, and used to each pay a round trip for it (perf audit, 5 Sep
// 2026). Primitive arguments on purpose -- cache() keys on identity, and an
// object literal would defeat it.
export const getCourseTutorRole = cache(async (courseId: string, profileId: string): Promise<string | null> => {
  const { data } = await createAdminClient()
    .from("course_tutors")
    .select("tutor_role")
    .eq("course_id", courseId)
    .eq("profile_id", profileId)
    .is("left_at", null)
    .maybeSingle();
  return data?.tutor_role ?? null;
});

/** Admin at the centre counts as MCT everywhere the hub asks. */
export async function isMctOfCourse(profile: { id: string; role: string }, courseId: string): Promise<boolean> {
  if (profile.role === "admin") return true;
  return (await getCourseTutorRole(courseId, profile.id)) === "main_course_tutor";
}
