"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

// Marks a whole section read/done. Kept alongside the per-task answers
// below: a section can be finished without every optional reflection task
// carrying typed text, so section progress stays its own self-report rather
// than being derived from answer count. completed_at toggles off if pressed
// again (a candidate can correct it, it's not a one-way lock).
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

// Ramy, 28 Aug 2026: "the trainees will answer the pre-course task here."
// Continuous autosave, one row per candidate per task -- no submit step and
// no draft/final split, since the task is explicitly never graded and never
// handed in. Deliberately does NOT revalidatePath: this fires on every
// debounced keystroke, and re-rendering the whole page mid-typing would
// fight the textarea for control of its own value.
export async function savePreCourseTaskAnswer(formData: FormData): Promise<void> {
  const trainee = await requireRole("trainee");

  const itemId = formData.get("item_id");
  const response = formData.get("response");
  if (typeof itemId !== "string" || typeof response !== "string") return;

  const kindRaw = formData.get("response_kind");
  const responseKind = kindRaw === "json" ? "json" : "text";

  const supabase = await createClient();
  await supabase.from("pre_course_task_responses").upsert(
    {
      item_id: itemId,
      trainee_id: trainee.id,
      response,
      response_kind: responseKind,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "item_id,trainee_id" }
  );
}
