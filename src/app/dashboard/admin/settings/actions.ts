"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";

export interface FormState {
  error: string | null;
}

// Centre-level identity -- name + the real Cambridge-assigned centre
// number. Every course under this centre shares the same number (it's
// not a per-course value), so it lives here rather than on the
// create-course form -- that form just shows it read-only for
// confirmation. Previously had no edit UI at all: centers.center_number
// only ever held an auto-generated "PENDING-xxxxxxxx" placeholder
// (migration 0003) until an admin actually sets the real one here.
export async function updateCenterProfile(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const profile = await requireRole("admin");

  const name = (formData.get("name") as string | null)?.trim();
  const centerNumber = (formData.get("center_number") as string | null)?.trim();
  if (!name || !centerNumber) {
    return { error: "Enter both the centre name and centre number." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("centers")
    .update({ name, center_number: centerNumber })
    .eq("id", profile.center_id);

  if (error) {
    return {
      error: error.code === "23505" ? "That centre number is already in use." : "Could not save. Try again.",
    };
  }

  revalidatePath("/dashboard/admin/settings");
  revalidatePath("/dashboard/admin");
  return { error: null };
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
