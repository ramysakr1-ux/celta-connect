import "server-only";
import { createClient } from "@/lib/supabase/server";

// The PDF itself is uploaded directly from the browser to Supabase Storage
// (see CoursebookUploadForm) -- Next.js Server Actions cap request bodies
// at 1MB by default, and a real coursebook PDF can be tens of megabytes,
// so routing the binary through a Server Action is the wrong shape here
// regardless of any config override. This function only ever receives the
// small metadata row to insert, after the client-side upload has already
// completed.
export interface CreateCoursebookRecordInput {
  centerId: string;
  uploadedBy: string;
  title: string;
  level: string;
  storagePath: string;
  originalFilename: string;
}

export async function createCoursebookRecord(
  input: CreateCoursebookRecordInput
): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tp_coursebooks")
    .insert({
      center_id: input.centerId,
      title: input.title,
      level: input.level,
      storage_path: input.storagePath,
      original_filename: input.originalFilename,
      uploaded_by: input.uploadedBy,
    })
    .select("id")
    .single();

  if (error || !data) {
    await supabase.storage.from("coursebook-pdfs").remove([input.storagePath]);
    return { error: "Could not save the coursebook record. Try again." };
  }

  return { id: data.id };
}

// Same direct-to-storage-then-metadata-row pattern as createCoursebookRecord
// above -- these are the additional PDFs (Workbook, Teacher's Book, ...)
// a generation run can now draw on alongside the primary storage_path.
export interface AddCoursebookSourceInput {
  tpCoursebookId: string;
  uploadedBy: string;
  label: string;
  storagePath: string;
  originalFilename: string;
}

export async function addCoursebookSourceRecord(
  input: AddCoursebookSourceInput
): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tp_coursebook_sources")
    .insert({
      tp_coursebook_id: input.tpCoursebookId,
      label: input.label,
      storage_path: input.storagePath,
      original_filename: input.originalFilename,
      uploaded_by: input.uploadedBy,
    })
    .select("id")
    .single();

  if (error || !data) {
    await supabase.storage.from("coursebook-pdfs").remove([input.storagePath]);
    return { error: "Could not save the source. Try again." };
  }

  return { id: data.id };
}
