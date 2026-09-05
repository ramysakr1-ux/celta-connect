"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

export interface FormState {
  error: string | null;
}

function optionalString(value: FormDataEntryValue | null): string | null {
  const s = typeof value === "string" ? value.trim() : "";
  return s ? s : null;
}

export async function saveMarkingGuidanceEntry(_prevState: FormState, formData: FormData): Promise<FormState> {
  const trainer = await requireRole("trainer");
  const supabase = await createClient();

  const assignmentType = formData.get("assignment_type");
  const criterionKey = formData.get("criterion_key");
  if (typeof assignmentType !== "string" || typeof criterionKey !== "string" || !assignmentType || !criterionKey) {
    return { error: "Missing assignment or criterion." };
  }

  const { error } = await supabase.from("marking_guidance_entries").upsert(
    {
      center_id: trainer.center_id,
      assignment_type: assignmentType,
      criterion_key: criterionKey,
      met_text: optionalString(formData.get("met_text")),
      grey_text: optionalString(formData.get("grey_text")),
      not_text: optionalString(formData.get("not_text")),
      agreed_text: optionalString(formData.get("agreed_text")),
      updated_at: new Date().toISOString(),
      updated_by: trainer.id,
    },
    { onConflict: "center_id,assignment_type,criterion_key" }
  );

  if (error) return { error: error.message };

  revalidatePath("/trainer/marking-guidance");
  return { error: null };
}
