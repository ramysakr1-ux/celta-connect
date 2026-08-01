"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import type { SubmissionStatus } from "@/lib/supabase/types";

export interface FormState {
  error: string | null;
}

const SUBMISSION_STATUSES: SubmissionStatus[] = [
  "not_submitted",
  "pending",
  "submitted",
  "resubmission_required",
  "approved",
];

export async function updateTp(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const trainer = await requireRole("trainer");

  const tpId = formData.get("tp_id");
  const traineeId = formData.get("trainee_id");
  const mainAim = formData.get("main_aim");
  const subAim = formData.get("sub_aim");
  const scheduledAt = formData.get("scheduled_at");
  const observationNotes = formData.get("observation_notes");

  if (typeof tpId !== "string" || typeof traineeId !== "string") {
    return { error: "Something went wrong. Refresh and try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("tps")
    .update({
      trainer_id: trainer.id,
      main_aim: typeof mainAim === "string" && mainAim ? mainAim : null,
      sub_aim: typeof subAim === "string" && subAim ? subAim : null,
      scheduled_at:
        typeof scheduledAt === "string" && scheduledAt
          ? new Date(scheduledAt).toISOString()
          : null,
      observation_notes:
        typeof observationNotes === "string" && observationNotes
          ? observationNotes
          : null,
    })
    .eq("id", tpId);

  if (error) {
    return { error: "Could not save. Try again." };
  }

  revalidatePath(`/dashboard/trainer/trainees/${traineeId}`);
  revalidatePath("/dashboard/trainer");
  return { error: null };
}

export async function updateAssignment(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRole("trainer");

  const assignmentId = formData.get("assignment_id");
  const traineeId = formData.get("trainee_id");
  const firstStatus = formData.get("first_status");
  const resubmissionStatus = formData.get("resubmission_status");
  const finalGrade = formData.get("final_grade");

  if (
    typeof assignmentId !== "string" ||
    typeof traineeId !== "string" ||
    typeof firstStatus !== "string" ||
    typeof resubmissionStatus !== "string" ||
    !SUBMISSION_STATUSES.includes(firstStatus as SubmissionStatus) ||
    !SUBMISSION_STATUSES.includes(resubmissionStatus as SubmissionStatus)
  ) {
    return { error: "Something went wrong. Refresh and try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("assignments")
    .update({
      first_status: firstStatus as SubmissionStatus,
      resubmission_status: resubmissionStatus as SubmissionStatus,
      final_grade: typeof finalGrade === "string" && finalGrade ? finalGrade : null,
    })
    .eq("id", assignmentId);

  if (error) {
    return { error: "Could not save. Try again." };
  }

  revalidatePath(`/dashboard/trainer/trainees/${traineeId}`);
  revalidatePath("/dashboard/trainer");
  return { error: null };
}
