"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

export interface FormState {
  error: string | null;
}

// One save covers every section at once -- ungraded and handed in on day
// one, so there's no per-section lock/round model here the way assignments
// have. submitted_at is set once, on the first save, and never cleared --
// it's the tutor's aggregate-view signal that this candidate has handed
// something in, not a lock on further edits (a candidate can keep refining
// before day one).
export async function savePreCourseTaskResponses(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const trainee = await requireRole("trainee");
  if (!trainee.course_id) return { error: "No course assigned." };

  const sectionIds = formData.getAll("section_id") as string[];
  if (sectionIds.length === 0) return { error: "Nothing to save." };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("pre_course_task_responses")
    .select("section_id, submitted_at")
    .eq("trainee_id", trainee.id);
  const submittedAtBySection = new Map((existing ?? []).map((r) => [r.section_id, r.submitted_at]));

  const now = new Date().toISOString();
  const rows = sectionIds.map((sectionId) => ({
    course_id: trainee.course_id!,
    trainee_id: trainee.id,
    section_id: sectionId,
    response: (formData.get(`response__${sectionId}`) as string | null) ?? "",
    submitted_at: submittedAtBySection.get(sectionId) ?? now,
    updated_at: now,
  }));

  const { error } = await supabase.from("pre_course_task_responses").upsert(rows, { onConflict: "trainee_id,section_id" });
  if (error) return { error: "Could not save. Try again." };

  revalidatePath(`/portfolio/${trainee.id}/pre-course-task`);
  return { error: null };
}
