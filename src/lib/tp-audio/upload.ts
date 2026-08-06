import "server-only";
import { createClient } from "@/lib/supabase/server";

// The audio file itself is uploaded directly from the browser to Supabase
// Storage (same reasoning as src/lib/tp-library/upload.ts -- Server Actions
// cap request bodies at 1MB, a coursebook audio track can be several MB).
// This function only ever receives the small metadata row to insert, after
// the client-side upload has already completed.
export interface CreateAudioRecordInput {
  centerId: string;
  uploadedBy: string;
  level: string;
  coursebookTitle: string;
  unitLabel?: string | null;
  fileName: string;
  storagePath: string;
  originalFilename: string;
}

export async function createAudioRecord(
  input: CreateAudioRecordInput
): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tp_audio_library")
    .insert({
      center_id: input.centerId,
      level: input.level,
      coursebook_title: input.coursebookTitle,
      unit_label: input.unitLabel || null,
      file_name: input.fileName,
      storage_path: input.storagePath,
      original_filename: input.originalFilename,
      uploaded_by: input.uploadedBy,
    })
    .select("id")
    .single();

  if (error || !data) {
    await supabase.storage.from("tp-audio").remove([input.storagePath]);
    return { error: "Could not save the audio record. Try again." };
  }

  return { id: data.id };
}
