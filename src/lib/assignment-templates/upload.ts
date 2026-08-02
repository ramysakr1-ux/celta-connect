import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AssignmentTypeValue } from "@/lib/assignment-templates/content";

// The PDF itself is uploaded directly from the browser to Supabase Storage
// (same 1MB Server Action body-size reasoning as coursebook-upload-form.tsx)
// -- this only ever receives the small metadata to upsert, after the
// client-side upload has already completed.
export interface UpsertAssignmentTemplateInput {
  centerId: string;
  uploadedBy: string;
  assignmentType: AssignmentTypeValue;
  storagePath: string;
  originalFilename: string;
}

export async function upsertAssignmentTemplateRecord(
  input: UpsertAssignmentTemplateInput
): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("assignment_templates")
    .upsert(
      {
        center_id: input.centerId,
        assignment_type: input.assignmentType,
        storage_path: input.storagePath,
        original_filename: input.originalFilename,
        sections: [],
        generation_status: "pending",
        generation_error: null,
        published_at: null,
        uploaded_by: input.uploadedBy,
      },
      { onConflict: "center_id,assignment_type" }
    )
    .select("id")
    .single();

  if (error || !data) {
    await supabase.storage.from("assignment-briefs").remove([input.storagePath]);
    return { error: "Could not save the assignment brief. Try again." };
  }

  return { id: data.id };
}
