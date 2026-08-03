"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

export interface FormState {
  error: string | null;
}

export async function saveSyllabusPlanningEntry(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRole("trainee");
  const supabase = await createClient();

  const tpNumber = Number(formData.get("tp_number"));
  const mainAim = (formData.get("main_aim") as string | null)?.trim();
  const subAim = (formData.get("sub_aim") as string | null)?.trim() || null;
  const material = (formData.get("material") as string | null)?.trim();

  if (tpNumber !== 7 && tpNumber !== 8) {
    return { error: "Invalid TP number." };
  }
  if (!mainAim || !material) {
    return { error: "Main aim and material are required." };
  }

  const { error } = await supabase.rpc("save_syllabus_planning_entry", {
    p_tp_number: tpNumber,
    p_main_aim: mainAim,
    p_sub_aim: subAim,
    p_material: material,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/trainee/plan/syllabus-grid");
  revalidatePath("/dashboard/trainee/plan");
  revalidatePath(`/dashboard/trainee/plan/${tpNumber}`);
  return { error: null };
}
