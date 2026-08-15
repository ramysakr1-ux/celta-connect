"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { matchCriteriaCodes } from "@/lib/criteria-glossary";

export interface CaptureFormState {
  error: string | null;
  savedAt: number | null;
}

// specs/build-spec.md §7: "Points typed or dictated during a TP, tagged and
// timestamped against the right candidate." Auto-tagging reuses the exact
// same matchCriteriaCodes() glossary already proven in
// feedback-point-editor.tsx -- captured points get the same silent
// best-effort tag a real feedback point would, so they arrive at the
// feedback form already partially sorted, not a blank dump of raw text.
export async function captureTeachingPoint(_prevState: CaptureFormState, formData: FormData): Promise<CaptureFormState> {
  const trainer = await requireRole(["trainer", "admin"]);
  const traineeId = formData.get("trainee_id");
  const tpNumber = formData.get("tp_number");
  const text = formData.get("text");

  if (typeof traineeId !== "string" || !traineeId) return { error: "Choose who this is about.", savedAt: null };
  if (typeof tpNumber !== "string" || !tpNumber) return { error: "Choose which TP.", savedAt: null };
  if (typeof text !== "string" || !text.trim()) return { error: "Write or dictate a point first.", savedAt: null };
  if (!trainer.course_id) return { error: "No course assigned.", savedAt: null };

  const supabase = await createClient();
  const { error } = await supabase.from("tp_capture_notes").insert({
    course_id: trainer.course_id,
    trainer_id: trainer.id,
    trainee_id: traineeId,
    tp_number: Number(tpNumber),
    text: text.trim(),
    criteria_codes: matchCriteriaCodes(text),
  });
  if (error) return { error: error.message, savedAt: null };

  revalidatePath("/trainer/capture");
  return { error: null, savedAt: Date.now() };
}

export async function deleteCaptureNote(formData: FormData): Promise<void> {
  const trainer = await requireRole(["trainer", "admin"]);
  const noteId = formData.get("note_id");
  const traineeId = formData.get("trainee_id");
  const tpNumber = formData.get("tp_number");
  if (typeof noteId !== "string") return;

  const supabase = await createClient();
  await supabase.from("tp_capture_notes").delete().eq("id", noteId).eq("trainer_id", trainer.id);

  revalidatePath("/trainer/capture");
  if (typeof traineeId === "string" && typeof tpNumber === "string") {
    revalidatePath(`/dashboard/trainer/trainees/${traineeId}/tp/${tpNumber}`);
  }
}
