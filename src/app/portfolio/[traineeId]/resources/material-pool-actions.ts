"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

export interface ClaimState {
  error: string | null;
}

// connect-spec-corrections-for-claude-code.md item 6: "candidates browse
// the pool and pick/claim... once claimed, it should be reserved so two
// candidates in the same TP group don't plan around the same material."
// First-come, claimed directly by the candidate -- tp_group_id/course_id
// resolved server-side from their own subgroup membership, never trusted
// from the form. The unique(material_item_id, tp_group_id) index is the
// actual race guard; a duplicate-key error here just means someone else
// claimed it a moment first.
export async function claimMaterialItem(_prevState: ClaimState, formData: FormData): Promise<ClaimState> {
  const trainee = await requireRole("trainee");
  const materialItemId = formData.get("material_item_id");
  const tpNumberRaw = formData.get("tp_number");
  const tpNumber = tpNumberRaw === "7" ? 7 : tpNumberRaw === "8" ? 8 : null;
  if (typeof materialItemId !== "string" || !tpNumber) return { error: "Something went wrong. Refresh and try again." };
  if (!trainee.course_id) return { error: "No course assigned." };

  const supabase = await createClient();
  const { data: subgroupMember } = await supabase
    .from("course_subgroup_members")
    .select("subgroup_id")
    .eq("trainee_id", trainee.id)
    .maybeSingle();
  if (!subgroupMember) return { error: "You're not in a TP subgroup yet -- ask your tutor." };

  const { data: subgroup } = await supabase
    .from("course_subgroups")
    .select("tp_group_id")
    .eq("id", subgroupMember.subgroup_id)
    .maybeSingle();
  if (!subgroup?.tp_group_id) return { error: "Your subgroup isn't paired into a TP group yet -- ask your tutor." };

  const { error } = await supabase.from("tp_material_pool_claims").insert({
    material_item_id: materialItemId,
    tp_group_id: subgroup.tp_group_id,
    course_id: trainee.course_id,
    tp_number: tpNumber,
    trainee_id: trainee.id,
  });
  if (error) {
    // The message below is what the person reads; this is what we read.
    console.error("[portfolio/[traineeId]/resources/material-pool-actions.ts:claimMaterialItem]", error);
    if (error.code === "23505") return { error: "Someone in your TP group just claimed this -- pick another." };
    return { error: "Could not claim it. Try again." };
}

  revalidatePath(`/portfolio/${trainee.id}/resources`);
  return { error: null };
}

export async function releaseMaterialClaim(formData: FormData): Promise<void> {
  const trainee = await requireRole("trainee");
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const supabase = await createClient();
  await supabase.from("tp_material_pool_claims").delete().eq("id", id).eq("trainee_id", trainee.id);
  revalidatePath(`/portfolio/${trainee.id}/resources`);
}
