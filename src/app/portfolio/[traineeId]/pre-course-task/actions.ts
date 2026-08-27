"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

// for-claude-code-pre-course-task-screens.md (27 Aug 2026): "on paper is
// fine -- not graded, not handed in -- your tutor reads it on day one."
// Replaces savePreCourseTaskResponses -- nothing is typed or submitted
// here, a trainee just marks a section as read/done for their own
// progress tracking. completed_at toggles off if pressed again (the
// design's progress bar implies this is a self-report a candidate can
// correct, not a one-way lock).
export async function togglePreCourseTaskSection(formData: FormData): Promise<void> {
  const trainee = await requireRole("trainee");
  if (!trainee.course_id) return;

  const sectionId = formData.get("section_id");
  if (typeof sectionId !== "string") return;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("pre_course_task_progress")
    .select("id, completed_at")
    .eq("trainee_id", trainee.id)
    .eq("section_id", sectionId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("pre_course_task_progress")
      .update({ completed_at: existing.completed_at ? null : new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await supabase.from("pre_course_task_progress").insert({
      course_id: trainee.course_id,
      trainee_id: trainee.id,
      section_id: sectionId,
      completed_at: new Date().toISOString(),
    });
  }

  revalidatePath(`/portfolio/${trainee.id}/pre-course-task`);
}
