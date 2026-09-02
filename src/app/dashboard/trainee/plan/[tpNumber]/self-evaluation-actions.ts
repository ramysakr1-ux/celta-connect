"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import type { SelfEvalActionPoint } from "@/lib/tp-plan-content";

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

async function saveSelfEval(formData: FormData, lock: boolean): Promise<FormState> {
  const trainee = await requireRole("trainee");
  const planId = formData.get("plan_id");
  const tpNumber = Number(formData.get("tp_number"));
  if (typeof planId !== "string" || !Number.isInteger(tpNumber)) {
    return { error: "Invalid request." };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("tp_self_evaluations")
    .select("id")
    .eq("tp_plan_id", planId)
    .maybeSingle();

  const actionPoints = parseJsonField<SelfEvalActionPoint[]>(formData, "action_points", []);
  const fields = {
    what_went_well: optionalString(formData.get("what_went_well")),
    what_not_as_planned: optionalString(formData.get("what_not_as_planned")),
    evidence_of_learning: optionalString(formData.get("evidence_of_learning")),
    what_differently: optionalString(formData.get("what_differently")),
    next_tp_focus: optionalString(formData.get("next_tp_focus")),
    action_points: actionPoints,
    ...(lock ? { submitted_at: new Date().toISOString() } : {}),
  };

  const { error } = existing
    ? await supabase.from("tp_self_evaluations").update(fields).eq("id", existing.id)
    : await supabase.from("tp_self_evaluations").insert({
        tp_plan_id: planId,
        trainee_id: trainee.id,
        tp_number: tpNumber,
        ...fields,
      });

  if (error) {
    // The message below is what the person reads; this is what we read.
    console.error("[dashboard/trainee/plan/[tpNumber]/self-evaluation-actions.ts:action]", error);
    return { error: "Could not save your self-evaluation -- it may not be unlocked yet, or is already submitted." };
}

  revalidatePath(`/dashboard/trainee/plan/${tpNumber}`);
  return { error: null };
}

export async function saveSelfEvaluationDraft(_prevState: FormState, formData: FormData): Promise<FormState> {
  return saveSelfEval(formData, false);
}

export async function submitSelfEvaluation(_prevState: FormState, formData: FormData): Promise<FormState> {
  return saveSelfEval(formData, true);
}
