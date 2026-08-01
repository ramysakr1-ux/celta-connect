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
