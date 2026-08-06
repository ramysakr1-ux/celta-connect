"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import type { ResourceCategory, ResourceType } from "@/lib/supabase/types";
import { TRAINER_ONLY_CATEGORIES } from "@/lib/resource-info";

export interface FormState {
  error: string | null;
}

const CATEGORIES: ResourceCategory[] = [
  "lesson_planning",
  "teaching_practice",
  "written_assignments",
  "cambridge_documentation",
  "reading",
  "input_sessions",
  "filmed_observations",
  "admissions",
];
const TYPES: ResourceType[] = ["template", "form", "brief", "cambridge_doc", "reading", "video"];

export async function addResource(traineeId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const trainer = await requireRole(["trainer", "admin"]);

  const title = (formData.get("title") as string | null)?.trim();
  const description = (formData.get("description") as string | null)?.trim() || null;
  const fileUrl = (formData.get("file_url") as string | null)?.trim();
  const category = formData.get("category");
  const resourceType = formData.get("resource_type");
  const centerWide = formData.get("center_wide") === "on";
  const visibleToTrainee = formData.get("visible_to_trainee") === "on";

  if (!centerWide && !trainer.course_id) return { error: "No course assigned." };
  if (!title) return { error: "Title is required." };
  if (!fileUrl) return { error: "A link is required." };
  if (typeof category !== "string" || !CATEGORIES.includes(category as ResourceCategory)) {
    return { error: "Invalid category." };
  }
  if (typeof resourceType !== "string" || !TYPES.includes(resourceType as ResourceType)) {
    return { error: "Invalid resource type." };
  }

  // Admissions is a hard, category-level restriction, not a per-item
  // choice -- force it regardless of what the checkbox said, same as
  // TRAINER_ONLY_CATEGORIES enforces on the read side.
  const isTrainerOnlyCategory = TRAINER_ONLY_CATEGORIES.includes(category as ResourceCategory);

  const supabase = await createClient();
  const { error } = await supabase.from("resources").insert({
    center_id: trainer.center_id,
    course_id: centerWide ? null : trainer.course_id,
    title,
    description,
    file_url: fileUrl,
    category: category as ResourceCategory,
    resource_type: resourceType as ResourceType,
    visible_to_trainee: isTrainerOnlyCategory ? false : visibleToTrainee,
    uploaded_by: trainer.id,
  });

  if (error) return { error: "Could not add the resource. Try again." };

  revalidatePath(`/portfolio/${traineeId}/resources`);
  return { error: null };
}

export async function deleteResource(formData: FormData): Promise<void> {
  const trainer = await requireRole(["trainer", "admin"]);
  const resourceId = formData.get("resource_id");
  const traineeId = formData.get("trainee_id");
  if (typeof resourceId !== "string" || typeof traineeId !== "string") return;

  const supabase = await createClient();
  await supabase.from("resources").delete().eq("id", resourceId).eq("center_id", trainer.center_id);

  revalidatePath(`/portfolio/${traineeId}/resources`);
}
