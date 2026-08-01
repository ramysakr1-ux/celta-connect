"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

export interface FormState {
  error: string | null;
}

export async function reorderSubgroup(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRole("trainer");

  const subgroupId = formData.get("subgroup_id");
  if (typeof subgroupId !== "string") {
    return { error: "Something went wrong. Refresh and try again." };
  }

  const positions: { traineeId: string; position: number }[] = [];
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("position__") && typeof value === "string") {
      positions.push({ traineeId: key.slice("position__".length), position: Number(value) });
    }
  }
  if (positions.length === 0) {
    return { error: "Something went wrong. Refresh and try again." };
  }

  positions.sort((a, b) => a.position - b.position);
  const orderedIds = positions.map((p) => p.traineeId);

  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder_subgroup_members", {
    p_subgroup_id: subgroupId,
    p_ordered_trainee_ids: orderedIds,
  });

  if (error) {
    return { error: "Could not save the new order. Try again." };
  }

  revalidatePath("/dashboard/trainer/rotation");
  return { error: null };
}

export async function setTpSchedule(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const trainer = await requireRole("trainer");

  const tpNumber = formData.get("tp_number");
  const tpCoursebookId = formData.get("tp_coursebook_id");
  if (typeof tpNumber !== "string" || typeof tpCoursebookId !== "string" || !tpCoursebookId) {
    return { error: "Choose a coursebook." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("course_tp_schedule").upsert(
    {
      course_id: trainer.course_id!,
      tp_number: Number(tpNumber),
      tp_coursebook_id: tpCoursebookId,
    },
    { onConflict: "course_id,tp_number" }
  );

  if (error) {
    return { error: "Could not save. Try again." };
  }

  revalidatePath("/dashboard/trainer/rotation");
  return { error: null };
}

export async function assignTpRound(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRole("trainer");

  const subgroupId = formData.get("subgroup_id");
  const tpNumber = formData.get("tp_number");
  if (typeof subgroupId !== "string" || typeof tpNumber !== "string") {
    return { error: "Something went wrong. Refresh and try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("assign_tp_round", {
    p_subgroup_id: subgroupId,
    p_tp_number: Number(tpNumber),
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/trainer/rotation");
  return { error: null };
}
