"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { createCoursebookRecord } from "@/lib/tp-library/upload";

export interface FormState {
  error: string | null;
}

export async function trainerCreateCoursebookRecord(input: {
  title: string;
  level: string;
  storagePath: string;
  originalFilename: string;
}): Promise<{ error: string | null }> {
  const trainer = await requireRole("trainer");

  const result = await createCoursebookRecord({
    centerId: trainer.center_id,
    uploadedBy: trainer.id,
    ...input,
  });

  if ("error" in result) {
    return { error: result.error };
  }

  redirect(`/dashboard/trainer/coursebooks/${result.id}`);
}

export async function updateTpPoint(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const trainer = await requireRole("trainer");

  const pointId = formData.get("point_id");
  const coursebookId = formData.get("coursebook_id");
  if (typeof pointId !== "string") {
    return { error: "Something went wrong. Refresh and try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("tp_points")
    .update({
      main_lesson_aim: (formData.get("main_lesson_aim") as string) || "",
      sub_aim: (formData.get("sub_aim") as string) || null,
      materials_description: (formData.get("materials_description") as string) || null,
      page_references: (formData.get("page_references") as string) || null,
      reviewed_by: trainer.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", pointId);

  if (error) {
    return { error: "Could not save. Try again." };
  }

  if (typeof coursebookId === "string") {
    revalidatePath(`/dashboard/trainer/coursebooks/${coursebookId}`);
  }
  return { error: null };
}

export async function setTpPointStatus(formData: FormData): Promise<void> {
  const trainer = await requireRole("trainer");

  const pointId = formData.get("point_id");
  const coursebookId = formData.get("coursebook_id");
  const status = formData.get("status");
  if (
    typeof pointId !== "string" ||
    (status !== "published" && status !== "archived" && status !== "pending_review")
  ) {
    return;
  }

  const supabase = await createClient();
  await supabase
    .from("tp_points")
    .update({ status, reviewed_by: trainer.id, reviewed_at: new Date().toISOString() })
    .eq("id", pointId);

  if (typeof coursebookId === "string") {
    revalidatePath(`/dashboard/trainer/coursebooks/${coursebookId}`);
  }
}
