"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { createAudioRecord } from "@/lib/tp-audio/upload";

export async function trainerCreateAudioRecord(input: {
  level: string;
  coursebookTitle: string;
  unitLabel?: string | null;
  fileName: string;
  storagePath: string;
  originalFilename: string;
}): Promise<{ error: string | null }> {
  const trainer = await requireRole(["trainer", "admin"]);

  const result = await createAudioRecord({
    centerId: trainer.center_id,
    uploadedBy: trainer.id,
    ...input,
  });

  if ("error" in result) {
    return { error: result.error };
  }

  revalidatePath("/trainer/audio");
  return { error: null };
}

export async function deleteAudioRecord(formData: FormData): Promise<void> {
  const trainer = await requireRole(["trainer", "admin"]);
  const audioId = formData.get("audio_id");
  if (typeof audioId !== "string") return;

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("tp_audio_library")
    .select("id, center_id, storage_path")
    .eq("id", audioId)
    .maybeSingle();

  if (!row || row.center_id !== trainer.center_id) return;

  await supabase.from("tp_audio_library").delete().eq("id", audioId);
  if (row.storage_path) {
    await supabase.storage.from("tp-audio").remove([row.storage_path]);
  }

  revalidatePath("/trainer/audio");
}
