import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// "The MCT approves all of them before anything is sent" (Grade Pipeline
// handoff) -- the MCT is the one person per course whose approval actually
// gates what reaches the assessor, so every approval-gated action needs this
// same check. One tutor_role='main_course_tutor' row per course is assumed
// (Course Admin's own invite flow already enforces MCT uniqueness).
export async function isMctOnCourse(
  supabase: SupabaseClient<Database>,
  courseId: string,
  profileId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", profileId)
    .eq("course_id", courseId)
    .eq("tutor_role", "main_course_tutor")
    .maybeSingle();
  return Boolean(data);
}
