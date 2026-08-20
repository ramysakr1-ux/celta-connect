"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";

export interface MaterialPoolState {
  error: string | null;
}

// connect-spec-corrections-for-claude-code.md item 6: "Centres/tutors can
// also add their own scans on top of the baseline library." Any trainer,
// not just the MCT -- matches the doc's own "tutors can add" wording.
// Baseline (center_id null) is platform-managed, never written here.
export async function uploadMaterialPoolItem(_prevState: MaterialPoolState, formData: FormData): Promise<MaterialPoolState> {
  const trainer = await requireRole(["trainer", "admin"]);

  const bookTitle = (formData.get("book_title") as string | null)?.trim();
  if (!bookTitle) return { error: "Enter the book or material's title." };
  const level = (formData.get("level") as string | null)?.trim() || null;
  const description = (formData.get("description") as string | null)?.trim() || null;
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Attach a scanned file." };

  const admin = createAdminClient();
  const path = `tp-material-pool/${trainer.center_id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error: uploadError } = await admin.storage
    .from("resource-hub-files")
    .upload(path, file, { contentType: file.type || "application/octet-stream" });
  if (uploadError) return { error: "Could not upload the file. Try again." };

  const { error } = await admin.from("tp_material_pool_items").insert({
    center_id: trainer.center_id,
    book_title: bookTitle,
    level,
    description,
    storage_path: path,
    added_by: trainer.id,
  });
  if (error) return { error: "Could not save. Try again." };

  revalidatePath("/trainer/resource-hub");
  return { error: null };
}

// A centre may only remove its own added scans -- the baseline library
// (center_id null) is platform-managed, not editable from here at all.
export async function deleteMaterialPoolItem(formData: FormData): Promise<void> {
  const trainer = await requireRole(["trainer", "admin"]);
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const admin = createAdminClient();
  await admin.from("tp_material_pool_items").delete().eq("id", id).eq("center_id", trainer.center_id);
  revalidatePath("/trainer/resource-hub");
}
