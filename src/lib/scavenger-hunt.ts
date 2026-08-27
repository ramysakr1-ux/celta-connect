import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// for-claude-code-pre-course-task-screens.md: "Find your way around
// Connect" -- six real questions, verbatim from the design (copy is
// final). Each one resolves the moment the trainee actually visits the
// real destination -- see the QUESTIONS' own `markedOn` note for exactly
// which page calls markScavengerHuntFound with that key, not a manual
// checkbox anywhere.
export const SCAVENGER_HUNT_QUESTIONS: { key: string; question: string }[] = [
  { key: "lesson_plan", question: "Where does your first lesson plan live?" },
  { key: "group", question: "Who else is in Group ABC with you?" },
  { key: "announcement", question: "Where would an announcement from your tutor show up?" },
  { key: "observation_hour", question: "Where do you log an observation hour?" },
  { key: "syllabus", question: "Where is the syllabus, if the platform is ever down?" },
  { key: "day_counter", question: "What is today's course day counter showing, right now?" },
];

// Fire-and-forget from a real trainee's own page view -- idempotent
// (unique on trainee_id+question_key), so calling it on every visit costs
// one no-op insert after the first. Never awaited by the caller for
// anything other than not leaving an unhandled rejection; a failed insert
// here should never block the page it's called from.
export async function markScavengerHuntFound(
  supabase: SupabaseClient<Database>,
  courseId: string,
  traineeId: string,
  key: string
): Promise<void> {
  await supabase
    .from("scavenger_hunt_progress")
    .upsert({ course_id: courseId, trainee_id: traineeId, question_key: key }, { onConflict: "trainee_id,question_key", ignoreDuplicates: true });
}
