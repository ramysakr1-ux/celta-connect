"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

// SS7 addendum -- fans a TP material out to every volunteer student on the
// course register at once (not per-individual targeting), the only way
// material reaches the /student/[token] view (migration 0030).
//
// Ramy, 12 Sep 2026: a candidate shares their own handouts with the students
// they are about to teach -- it is their lesson and their handout, and on an
// online lesson the students need it beforehand. These actions took
// requireRole(["trainer", "admin"]) and the candidate's own materials card
// carried no control at all, so only a tutor could do it. A candidate may now
// share MATERIAL ON THEIR OWN PLAN; a tutor may still share anyone's on the
// course, which is what the demo-lesson case needs.
async function resolveSharer(tpMaterialId: string) {
  const actor = await requireRole(["trainer", "admin", "trainee"]);
  const supabase = await createClient();
  if (actor.role !== "trainee") {
    return actor.course_id ? { supabase, courseId: actor.course_id, actorId: actor.id } : null;
  }
  // A candidate's reach stops at their own plan.
  const { data: material } = await supabase
    .from("tp_materials")
    .select("tp_plan_id, tp_plans(trainee_id, course_id)")
    .eq("id", tpMaterialId)
    .maybeSingle();
  const plan = material?.tp_plans as unknown as { trainee_id: string; course_id: string } | null;
  if (!plan || plan.trainee_id !== actor.id) return null;
  return { supabase, courseId: plan.course_id, actorId: actor.id };
}

export async function shareMaterialWithStudents(formData: FormData): Promise<void> {
  const tpMaterialId = formData.get("tp_material_id");
  const traineeId = formData.get("trainee_id");
  const tpNumber = formData.get("tp_number");
  if (typeof tpMaterialId !== "string") return;
  const ctx = await resolveSharer(tpMaterialId);
  if (!ctx) return;

  await ctx.supabase.from("volunteer_shared_materials").upsert(
    { course_id: ctx.courseId, tp_material_id: tpMaterialId, shared_by: ctx.actorId },
    { onConflict: "course_id,tp_material_id", ignoreDuplicates: true }
  );

  if (typeof traineeId === "string") {
    revalidatePath(`/portfolio/${traineeId}/tp/${tpNumber}`);
  }
}

export async function unshareMaterialWithStudents(formData: FormData): Promise<void> {
  const tpMaterialId = formData.get("tp_material_id");
  const traineeId = formData.get("trainee_id");
  const tpNumber = formData.get("tp_number");
  if (typeof tpMaterialId !== "string") return;
  const ctx = await resolveSharer(tpMaterialId);
  if (!ctx) return;

  await ctx.supabase
    .from("volunteer_shared_materials")
    .delete()
    .eq("tp_material_id", tpMaterialId)
    .eq("course_id", ctx.courseId);

  if (typeof traineeId === "string") {
    revalidatePath(`/portfolio/${traineeId}/tp/${tpNumber}`);
  }
}
