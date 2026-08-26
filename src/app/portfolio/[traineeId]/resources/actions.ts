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
  "centre_documents",
  "forms",
];
const TYPES: ResourceType[] = ["template", "form", "brief", "cambridge_doc", "reading", "video"];
const CONTENT_TYPES = ["link", "file", "html"] as const;

// Trainer/admin only, called either from a plain form submit (the "Link"
// path) or programmatically with a manually-built FormData after a
// client-side Storage upload has already completed (the "Upload
// file"/"Upload HTML" paths -- see resource-composer.tsx). Same action
// either way, useActionState's dispatcher accepts a FormData built by hand
// just as readily as one from a real <form> submission.
export async function addResource(traineeId: string | null, _prevState: FormState, formData: FormData): Promise<FormState> {
  const trainer = await requireRole(["trainer", "admin"]);

  const title = (formData.get("title") as string | null)?.trim();
  const description = (formData.get("description") as string | null)?.trim() || null;
  const fileUrl = (formData.get("file_url") as string | null)?.trim() || null;
  const storagePath = (formData.get("storage_path") as string | null)?.trim() || null;
  const contentTypeRaw = formData.get("content_type");
  const category = formData.get("category");
  const resourceType = formData.get("resource_type");
  const centerWide = formData.get("center_wide") === "on";
  const visibleToTrainee = formData.get("visible_to_trainee") === "on";

  if (!centerWide && !trainer.course_id) return { error: "No course assigned." };
  if (!title) return { error: "Title is required." };
  const contentType = typeof contentTypeRaw === "string" && (CONTENT_TYPES as readonly string[]).includes(contentTypeRaw) ? contentTypeRaw : "link";
  if (contentType === "link" && !fileUrl) return { error: "A link is required." };
  if (contentType !== "link" && !storagePath) return { error: "Upload a file first." };
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
    file_url: contentType === "link" ? fileUrl : null,
    storage_path: contentType === "link" ? null : storagePath,
    content_type: contentType as "link" | "file" | "html",
    category: category as ResourceCategory,
    resource_type: resourceType as ResourceType,
    visible_to_trainee: isTrainerOnlyCategory ? false : visibleToTrainee,
    uploaded_by: trainer.id,
  });

  if (error) {
    // The upload already happened -- clean up the orphaned Storage object
    // rather than leaving a file with no record pointing at it, same
    // rollback shape as createAudioRecord.
    if (storagePath) await supabase.storage.from("resource-hub-files").remove([storagePath]);
    return { error: "Could not add the resource. Try again." };
  }

  if (traineeId) revalidatePath(`/portfolio/${traineeId}/resources`);
  revalidatePath("/trainer/resource-hub");
  return { error: null };
}

// "Coursebooks" section -- just how to access the book, kept separate
// from the TP Points Library's own trainer-only content underneath.
export async function updateCoursebookAccessNotes(_prevState: FormState, formData: FormData): Promise<FormState> {
  const trainer = await requireRole(["trainer", "admin"]);
  const coursebookId = formData.get("coursebook_id");
  const accessNotes = ((formData.get("access_notes") as string | null) ?? "").trim() || null;
  if (typeof coursebookId !== "string") return { error: "Something went wrong. Refresh and try again." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("tp_coursebooks")
    .update({ access_notes: accessNotes })
    .eq("id", coursebookId)
    .eq("center_id", trainer.center_id);
  if (error) return { error: "Could not save. Try again." };

  revalidatePath("/trainer/resource-hub");
  return { error: null };
}

export async function deleteResource(formData: FormData): Promise<void> {
  const trainer = await requireRole(["trainer", "admin"]);
  const resourceId = formData.get("resource_id");
  const traineeId = (formData.get("trainee_id") as string | null) || null;
  if (typeof resourceId !== "string") return;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("resources")
    .select("storage_path")
    .eq("id", resourceId)
    .eq("center_id", trainer.center_id)
    .maybeSingle();
  await supabase.from("resources").delete().eq("id", resourceId).eq("center_id", trainer.center_id);
  if (existing?.storage_path) await supabase.storage.from("resource-hub-files").remove([existing.storage_path]);

  if (traineeId) revalidatePath(`/portfolio/${traineeId}/resources`);
  revalidatePath("/trainer/resource-hub");
}
