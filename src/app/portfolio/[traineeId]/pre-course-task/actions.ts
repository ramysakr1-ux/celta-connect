"use server";

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

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
  const { error } = await supabase.from("pre_course_task_responses").upsert(
    {
      item_id: itemId,
      trainee_id: trainee.id,
      response,
      response_kind: responseKind,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "item_id,trainee_id" }
  );
  // Never silent again (5 Sep 2026): a refused autosave used to vanish. The
  // demo centre is now read-only before it gets here; anything else that
  // lands here is a real fault worth seeing in the logs.
  if (error) console.error("[portfolio/[traineeId]/pre-course-task/actions.ts:savePreCourseTaskAnswer]", error);
}
