"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

export interface FormState {
  error: string | null;
}

// master-backlog "Manual TP-point override" -- bypasses assign_tp_round's
// rotation formula entirely for one trainee/TP. Same plan_assignments
// upsert shape as assign_tp_round (0048) and the TP7/8 syllabus grid RPC
// (0025), just sourced from a trainer's direct pick instead of a formula.
// No new SQL needed: trainer/admin already have full RLS write access to
// plan_assignments in their own course (0014), unlike the trainee-facing
// syllabus grid RPC which needed security definer to punch through RLS.
export async function overrideTpPoint(_prevState: FormState, formData: FormData): Promise<FormState> {
  const trainer = await requireRole(["trainer", "admin"]);
  const traineeId = formData.get("trainee_id");
  const tpNumber = formData.get("tp_number");
  const tpPointId = formData.get("tp_point_id");
  if (typeof traineeId !== "string" || typeof tpNumber !== "string" || typeof tpPointId !== "string" || !tpPointId) {
    return { error: "Pick a trainee, TP number, and a TP point first." };
  }

  const supabase = await createClient();

  const { data: trainee } = await supabase
    .from("profiles")
    .select("id, course_id")
    .eq("id", traineeId)
    .eq("role", "trainee")
    .maybeSingle();
  if (!trainee || trainee.course_id !== trainer.course_id) {
    return { error: "That trainee isn't on your course." };
  }

  // A taught lesson is the permanent record -- reassigning the point
  // underneath it after the fact would silently rewrite what they were
  // actually assessed against. Reassignment is for lessons still ahead.
  const { data: existing } = await supabase
    .from("plan_assignments")
    .select("taught_at")
    .eq("trainee_id", traineeId)
    .eq("tp_number", Number(tpNumber))
    .maybeSingle();
  if (existing?.taught_at) {
    return { error: "This TP has already been taught -- its assignment can't be changed after the fact." };
  }

  const { data: point } = await supabase
    .from("tp_points")
    .select("*")
    .eq("id", tpPointId)
    .eq("tp_number", Number(tpNumber))
    .eq("status", "published")
    .maybeSingle();
  if (!point) {
    return { error: "That TP point isn't published, or doesn't match this TP number." };
  }

  const { error } = await supabase.from("plan_assignments").upsert(
    {
      course_id: trainer.course_id!,
      trainee_id: traineeId,
      tp_number: Number(tpNumber),
      tp_point_id: point.id,
      rotation_position_used: null,
      main_lesson_aim: point.main_lesson_aim,
      sub_aim: point.sub_aim,
      short_title: point.short_title,
      materials_description: point.materials_description,
      procedure: point.procedure,
      page_references: point.page_references,
      density_tier: point.density_tier,
      aim_type: point.aim_type,
      assigned_by: trainer.id,
    },
    { onConflict: "trainee_id,tp_number" }
  );
  if (error) {
    // The message above is what the person reads; this is what we read.
    console.error("[trainer/(hub)/rotation/override:overrideTpPoint]", error);
    return { error: "Could not assign. Try again." };
  }

  revalidatePath("/trainer/rotation");
  return { error: null };
}
