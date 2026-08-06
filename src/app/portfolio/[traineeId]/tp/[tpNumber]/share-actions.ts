"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

// SS7 addendum -- fans a TP material out to every volunteer student on the
// course register at once (not per-individual targeting), the only way
// material reaches the /student/[token] view (migration 0030).
export async function shareMaterialWithStudents(formData: FormData): Promise<void> {
  const trainer = await requireRole(["trainer", "admin"]);
  if (!trainer.course_id) return;
  const tpMaterialId = formData.get("tp_material_id");
  const traineeId = formData.get("trainee_id");
  const tpNumber = formData.get("tp_number");
  if (typeof tpMaterialId !== "string") return;

  const supabase = await createClient();
  await supabase.from("volunteer_shared_materials").upsert(
    { course_id: trainer.course_id, tp_material_id: tpMaterialId, shared_by: trainer.id },
    { onConflict: "course_id,tp_material_id", ignoreDuplicates: true }
  );

  if (typeof traineeId === "string") {
    revalidatePath(`/portfolio/${traineeId}/tp/${tpNumber}`);
  }
}

export async function unshareMaterialWithStudents(formData: FormData): Promise<void> {
  const trainer = await requireRole(["trainer", "admin"]);
  const tpMaterialId = formData.get("tp_material_id");
  const traineeId = formData.get("trainee_id");
  const tpNumber = formData.get("tp_number");
  if (typeof tpMaterialId !== "string") return;

  const supabase = await createClient();
  await supabase
    .from("volunteer_shared_materials")
    .delete()
    .eq("tp_material_id", tpMaterialId)
    .eq("course_id", trainer.course_id ?? "");

  if (typeof traineeId === "string") {
    revalidatePath(`/portfolio/${traineeId}/tp/${tpNumber}`);
  }
}
