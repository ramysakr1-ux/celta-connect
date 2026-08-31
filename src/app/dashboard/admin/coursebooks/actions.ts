"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth/require-capability";
import { createClient } from "@/lib/supabase/server";
import { createCoursebookRecord } from "@/lib/tp-library/upload";
import { AIM_TYPES, type AimType } from "@/lib/aim-type";

function parseAimType(value: FormDataEntryValue | null): AimType | null {
  return typeof value === "string" && (AIM_TYPES as string[]).includes(value) ? (value as AimType) : null;
}

export interface FormState {
  error: string | null;
}

export async function adminCreateCoursebookRecord(input: {
  title: string;
  level: string;
  storagePath: string;
  originalFilename: string;
}): Promise<{ error: string | null }> {
  const admin = await requireCapability("courseAdmin.settings");

  const result = await createCoursebookRecord({
    centerId: admin.center_id,
    uploadedBy: admin.id,
    ...input,
  });

  if ("error" in result) {
    return { error: result.error };
  }

  redirect(`/dashboard/admin/coursebooks/${result.id}`);
}

export async function updateTpPoint(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const admin = await requireCapability("courseAdmin.settings");

  const pointId = formData.get("point_id");
  const coursebookId = formData.get("coursebook_id");
  if (typeof pointId !== "string") {
    return { error: "Something went wrong. Refresh and try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("tp_points")
    .update({
      aim_type: parseAimType(formData.get("aim_type")),
      main_lesson_aim: (formData.get("main_lesson_aim") as string) || "",
      sub_aim: (formData.get("sub_aim") as string) || null,
      materials_description: (formData.get("materials_description") as string) || null,
      page_references: (formData.get("page_references") as string) || null,
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", pointId);

  if (error) {
    return { error: "Could not save. Try again." };
  }

  if (typeof coursebookId === "string") {
    revalidatePath(`/dashboard/admin/coursebooks/${coursebookId}`);
  }
  return { error: null };
}

export async function setTpPointStatus(formData: FormData): Promise<void> {
  const admin = await requireCapability("courseAdmin.settings");

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
  let query = supabase
    .from("tp_points")
    .update({ status, reviewed_by: admin.id, reviewed_at: new Date().toISOString() })
    .eq("id", pointId);
  // "Checked before publishing, not after" -- an aim type must be set
  // before a point can go live (the review form's Publish button is
  // already disabled for this case; this is the server-side backstop).
  if (status === "published") {
    query = query.not("aim_type", "is", null);
  }
  await query;

  if (typeof coursebookId === "string") {
    revalidatePath(`/dashboard/admin/coursebooks/${coursebookId}`);
  }
}
