"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import type { TpMaterialFileType } from "@/lib/supabase/types";

// Ramy, 25 Aug 2026: shared by both the trainee's GTKY page and the
// trainer's session-materials page -- deliberately the same action for
// both, since the only real difference is who's uploading (RLS's own
// `uploaded_by = auth.uid()` check already handles that; this doesn't need
// to know or care which role called it). File itself is uploaded directly
// to Storage from the browser first, same 1MB Server Action body-size
// reasoning as every other materials upload in this app -- this only ever
// receives the small metadata row to insert.
export async function createSessionMaterial(input: {
  timetableEventId: string;
  courseId: string;
  storagePath: string;
  fileName: string;
  fileType: TpMaterialFileType;
  revalidate: string;
}): Promise<{ error: string | null }> {
  const profile = await requireRole(["trainee", "trainer", "admin"]);
  const supabase = await createClient();

  const { error } = await supabase.from("session_materials").insert({
    timetable_event_id: input.timetableEventId,
    course_id: input.courseId,
    uploaded_by: profile.id,
    storage_path: input.storagePath,
    file_name: input.fileName,
    file_type: input.fileType,
  });

  if (error) {
    // The message below is what the person reads; this is what we read.
    console.error("[src/lib/session-materials-actions.ts:createSessionMaterial]", error);
    await supabase.storage.from("tp-materials").remove([input.storagePath]);
    return { error: "Could not save the material. Try again." };
}

  revalidatePath(input.revalidate);
  return { error: null };
}

export async function deleteSessionMaterial(formData: FormData): Promise<void> {
  const profile = await requireRole(["trainee", "trainer", "admin"]);
  const materialId = formData.get("material_id");
  const revalidate = formData.get("revalidate");
  if (typeof materialId !== "string") return;

  const supabase = await createClient();
  const { data: material } = await supabase
    .from("session_materials")
    .select("id, uploaded_by, storage_path")
    .eq("id", materialId)
    .maybeSingle();

  if (!material || material.uploaded_by !== profile.id) return;

  await supabase.from("session_materials").delete().eq("id", materialId);
  if (material.storage_path) {
    await supabase.storage.from("tp-materials").remove([material.storage_path]);
  }

  if (typeof revalidate === "string") revalidatePath(revalidate);
}
