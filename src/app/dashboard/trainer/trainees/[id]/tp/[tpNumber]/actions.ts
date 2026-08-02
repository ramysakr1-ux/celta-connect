"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import type { FeedbackPoint } from "@/lib/tp-plan-content";
import type { StandardRating } from "@/lib/supabase/types";

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
    return { error: "Could not save the feedback. Try again." };
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
