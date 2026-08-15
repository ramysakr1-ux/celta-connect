"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

export interface FormState {
  error: string | null;
}

export async function createObservationTask(_prevState: FormState, formData: FormData): Promise<FormState> {
  const trainer = await requireRole(["trainer", "admin"]);
  if (!trainer.course_id) return { error: "No course assigned." };

  const title = (formData.get("title") as string | null)?.trim();
  const instructions = (formData.get("instructions") as string | null)?.trim();
  if (!title) return { error: "Title is required." };
  if (!instructions) return { error: "Instructions are required -- what should candidates watch for?" };

  const supabase = await createClient();
  const { error } = await supabase.from("observation_tasks").insert({
    course_id: trainer.course_id,
    title,
    instructions,
    created_by: trainer.id,
  });

  if (error) return { error: "Could not save the task." };

  revalidatePath("/trainer/observation-tasks");
  revalidatePath("/trainer/roster");
  return { error: null };
}

export async function deleteObservationTask(formData: FormData): Promise<void> {
  const trainer = await requireRole(["trainer", "admin"]);
  const taskId = formData.get("task_id");
  if (typeof taskId !== "string") return;

  const supabase = await createClient();
  await supabase.from("observation_tasks").delete().eq("id", taskId).eq("course_id", trainer.course_id ?? "");

  revalidatePath("/trainer/observation-tasks");
  revalidatePath("/trainer/roster");
}
