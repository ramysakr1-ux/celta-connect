"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import type { TpMaterialFileType } from "@/lib/supabase/types";

// The file itself is uploaded directly from the browser to Supabase Storage
// (same 1MB Server Action body-size reasoning as coursebook-upload-form.tsx)
// -- this only ever receives the small metadata row to insert, after the
// client-side upload has already completed.
export async function createMaterialRecord(input: {
  tpPlanId: string;
  storagePath: string;
  fileName: string;
  fileType: TpMaterialFileType;
}): Promise<{ error: string | null }> {
  const trainee = await requireRole("trainee");
  const supabase = await createClient();

  const { error } = await supabase.from("tp_materials").insert({
    tp_plan_id: input.tpPlanId,
    trainee_id: trainee.id,
    storage_path: input.storagePath,
    file_name: input.fileName,
    file_type: input.fileType,
  });

  if (error) {
    await supabase.storage.from("tp-materials").remove([input.storagePath]);
    return { error: "Could not save the material. It may already be locked." };
  }

  revalidatePath(`/dashboard/trainee/plan`);
  return { error: null };
}

export async function addSlidesLink(input: { tpPlanId: string; slidesUrl: string }): Promise<{ error: string | null }> {
  const trainee = await requireRole("trainee");
  const supabase = await createClient();

  const { error } = await supabase.from("tp_materials").insert({
    tp_plan_id: input.tpPlanId,
    trainee_id: trainee.id,
    slides_url: input.slidesUrl,
  });

  if (error) return { error: "Could not save the link. It may already be locked." };

  revalidatePath(`/dashboard/trainee/plan`);
  return { error: null };
}

export async function deleteMaterial(formData: FormData): Promise<void> {
  const trainee = await requireRole("trainee");
  const materialId = formData.get("material_id");
  if (typeof materialId !== "string") return;

  const supabase = await createClient();
  const { data: material } = await supabase
    .from("tp_materials")
    .select("id, trainee_id, storage_path")
    .eq("id", materialId)
    .maybeSingle();

  if (!material || material.trainee_id !== trainee.id) return;

  await supabase.from("tp_materials").delete().eq("id", materialId);
  if (material.storage_path) {
    await supabase.storage.from("tp-materials").remove([material.storage_path]);
  }

  revalidatePath(`/dashboard/trainee/plan`);
}
