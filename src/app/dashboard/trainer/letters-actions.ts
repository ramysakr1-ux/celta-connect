"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import type { FormalLetterInput } from "@/lib/formal-letter-pdf/document";
import { isReferenceLetterEligible } from "@/lib/letters/reference";

export interface FormState {
  error: string | null;
  letterId?: string;
}

// One issue action for all three new letter types. The snapshot IS the
// point of review-before-issuing: a trainer edits the drafted action
// points/closing client-side, and whatever they submit is exactly what
// gets filed and rendered -- re-deriving it server-side from live data
// again would defeat "written record", not protect it. Trainer/admin
// already have full write access to the underlying assignment/celta5/
// deferral records this draws from, so accepting the edited draft as
// submitted isn't a new trust boundary.
export async function issueFormalLetter(_prevState: FormState, formData: FormData): Promise<FormState> {
  const trainer = await requireRole(["trainer", "admin"]);
  if (!trainer.course_id) return { error: "No course assigned." };

  const traineeId = formData.get("trainee_id");
  const letterType = formData.get("letter_type");
  const snapshotRaw = formData.get("snapshot");
  const relatedAssignmentId = (formData.get("related_assignment_id") as string | null) || null;
  const relatedDeferralTransferId = (formData.get("related_deferral_transfer_id") as string | null) || null;

  if (
    typeof traineeId !== "string" ||
    !traineeId ||
    typeof letterType !== "string" ||
    !["fail_risk", "assignment_warning", "deferral", "reference"].includes(letterType) ||
    typeof snapshotRaw !== "string"
  ) {
    return { error: "Something went wrong. Refresh and try again." };
  }

  // for-claude-code-reference-letter.md: "MCT or Centre Admin generates
  // it" -- the other three letter types are deliberately any-trainer (see
  // this function's own comment below), so this check is scoped to
  // letterType === "reference" only, not widened onto the existing types.
  if (letterType === "reference" && trainer.role === "trainer" && trainer.tutor_role !== "main_course_tutor") {
    return { error: "Only the main course tutor or a centre admin can issue a reference letter." };
  }

  let snapshot: FormalLetterInput;
  try {
    snapshot = JSON.parse(snapshotRaw);
  } catch {
    return { error: "Could not read the draft. Refresh and try again." };
  }

  const supabase = await createClient();
  const { data: trainee } = await supabase.from("profiles").select("id, course_id").eq("id", traineeId).maybeSingle();
  if (!trainee || trainee.course_id !== trainer.course_id) return { error: "Could not find that candidate." };

  if (letterType === "reference") {
    const { data: record } = await supabase
      .from("celta5_records")
      .select("final_recommended_grade, trainer_signoff_final_at")
      .eq("trainee_id", traineeId)
      .maybeSingle();
    if (!record || !isReferenceLetterEligible(record)) {
      return { error: "This candidate doesn't have a finalized grade yet." };
    }
  }

  const { data: letter, error } = await supabase
    .from("formal_letters")
    .insert({
      course_id: trainer.course_id,
      trainee_id: traineeId,
      letter_type: letterType as "fail_risk" | "assignment_warning" | "deferral" | "reference",
      snapshot: snapshot as unknown as Record<string, unknown>,
      issued_by: trainer.id,
      related_assignment_id: relatedAssignmentId,
      related_deferral_transfer_id: relatedDeferralTransferId,
    })
    .select("id")
    .single();
  if (error || !letter) return { error: "Could not issue the letter. Try again." };

  revalidatePath(`/dashboard/trainer/trainees/${traineeId}/celta5`);
  revalidatePath(`/dashboard/trainer/trainees/${traineeId}`);
  revalidatePath(`/portfolio/${traineeId}`, "layout");
  return { error: null, letterId: letter.id };
}
