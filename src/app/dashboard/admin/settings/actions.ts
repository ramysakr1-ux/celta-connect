"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";

export interface FormState {
  error: string | null;
}

export async function updateGoogleDriveTargets(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const profile = await requireRole("admin");

  const templateDocId = (formData.get("template_doc_id") as string) || null;
  const outputFolderId = (formData.get("output_folder_id") as string) || null;

  const admin = createAdminClient();
  const { error } = await admin
    .from("center_google_connections")
    .update({ template_doc_id: templateDocId, output_folder_id: outputFolderId })
    .eq("center_id", profile.center_id);

  if (error) {
    return { error: "Could not save. Try again." };
  }

  revalidatePath("/dashboard/admin/settings");
  return { error: null };
}

export async function disconnectGoogleDrive(): Promise<void> {
  const profile = await requireRole("admin");
  const admin = createAdminClient();
  await admin.from("center_google_connections").delete().eq("center_id", profile.center_id);
  revalidatePath("/dashboard/admin/settings");
}

export async function addStyleExample(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const profile = await requireRole("admin");

  const tone = formData.get("tone");
  const exampleText = (formData.get("example_text") as string | null)?.trim();
  if (tone !== "direct" && tone !== "supportive") {
    return { error: "Invalid tone." };
  }
  if (!exampleText) {
    return { error: "Enter an example." };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("feedback_style_examples").insert({
    center_id: profile.center_id,
    tone,
    example_text: exampleText,
    created_by: profile.id,
  });

  if (error) {
    return { error: "Could not save. Try again." };
  }

  revalidatePath("/dashboard/admin/settings");
  return { error: null };
}

export async function updateStyleExample(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const profile = await requireRole("admin");

  const id = formData.get("id") as string | null;
  const exampleText = (formData.get("example_text") as string | null)?.trim();
  if (!id || !exampleText) {
    return { error: "Enter an example." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("feedback_style_examples")
    .update({ example_text: exampleText })
    .eq("id", id)
    .eq("center_id", profile.center_id);

  if (error) {
    return { error: "Could not save. Try again." };
  }

  revalidatePath("/dashboard/admin/settings");
  return { error: null };
}

export async function deleteStyleExample(formData: FormData): Promise<void> {
  const profile = await requireRole("admin");
  const id = formData.get("id") as string | null;
  if (!id) return;

  const admin = createAdminClient();
  await admin
    .from("feedback_style_examples")
    .delete()
    .eq("id", id)
    .eq("center_id", profile.center_id);
  revalidatePath("/dashboard/admin/settings");
}
