"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import type { FeedbackPoint } from "@/lib/tp-plan-content";
import type { StandardRating } from "@/lib/supabase/types";
import { recordAssessedLesson } from "@/lib/assessed-lesson-record";

export interface FormState {
  error: string | null;
}

function optionalString(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" && value ? value : null;
}

function parseJsonField<T>(formData: FormData, key: string, fallback: T): T {
  const raw = formData.get(key);
  if (typeof raw !== "string" || !raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function saveFeedback(formData: FormData, lock: boolean): Promise<FormState> {
  const trainer = await requireRole("trainer");
  const planId = formData.get("plan_id");
  const traineeId = formData.get("trainee_id");
  const tpNumber = Number(formData.get("tp_number"));
  if (typeof planId !== "string" || typeof traineeId !== "string" || !Number.isInteger(tpNumber)) {
    return { error: "Invalid request." };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("tp_feedback")
    .select("id")
    .eq("tp_plan_id", planId)
    .maybeSingle();

  const grade = optionalString(formData.get("grade")) as StandardRating | null;
  // Handbook 10.2: the summary of a feedback sheet "should include an
  // unambiguous comment on the overall standard of the lesson". The grade is
  // that comment, in the CELTA 5's own three words -- a sheet can be drafted
  // without one, but not released.
  if (lock && !grade) {
    return { error: "Say which standard the lesson reached before releasing -- Cambridge asks for an unambiguous comment on the overall standard of every lesson (Handbook 10.2)." };
  }
  const fields = {
    trainer_id: trainer.id,
    grade,
    strengths_planning: parseJsonField<FeedbackPoint[]>(formData, "strengths_planning", []),
    action_points_planning: parseJsonField<FeedbackPoint[]>(formData, "action_points_planning", []),
    strengths_teaching: parseJsonField<FeedbackPoint[]>(formData, "strengths_teaching", []),
    action_points_teaching: parseJsonField<FeedbackPoint[]>(formData, "action_points_teaching", []),
    overall_comment: optionalString(formData.get("overall_comment")),
    self_eval_comment: optionalString(formData.get("self_eval_comment")),
    ...(lock ? { submitted_at: new Date().toISOString() } : {}),
  };

  const { error } = existing
    ? await supabase.from("tp_feedback").update(fields).eq("id", existing.id)
    : await supabase.from("tp_feedback").insert({
        tp_plan_id: planId,
        trainee_id: traineeId,
        tp_number: tpNumber,
        ...fields,
      });

  if (error) {
    // The message below is what the person reads; this is what we read.
    console.error("[dashboard/trainer/trainees/[id]/tp/[tpNumber]:action]", error);
    return { error: "Could not save the feedback. Try again." };
}

  // Released feedback fills the candidate's CELTA 5 record of assessed
  // teaching practice -- see assessed-lesson-record.ts.
  if (lock && trainer.course_id) {
    await recordAssessedLesson(supabase, {
      courseId: trainer.course_id,
      traineeId,
      tpNumber,
      planId,
      trainerId: trainer.id,
      grade,
      overallComment: fields.overall_comment,
    });
    revalidatePath(`/dashboard/trainer/trainees/${traineeId}/celta5`);
  }
  revalidatePath(`/dashboard/trainer/trainees/${traineeId}/tp/${tpNumber}`);
  return { error: null };
}

export async function saveFeedbackDraft(_prevState: FormState, formData: FormData): Promise<FormState> {
  return saveFeedback(formData, false);
}

export async function submitFeedback(_prevState: FormState, formData: FormData): Promise<FormState> {
  return saveFeedback(formData, true);
}
