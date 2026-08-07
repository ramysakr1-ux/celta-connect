"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

export interface FormState {
  error: string | null;
}

// checkpoint 3: was a flat 3-per-subgroup cap. Real rule (confirmed with
// Ramy): a TP group is capped at 6 trainees combined across both halves,
// never more, halves can be uneven. An unpaired subgroup can grow to 6 on
// its own (pair_subgroups() re-checks the combined cap at the moment of
// pairing, so a later pairing that would exceed 6 is rejected then).
const MAX_TP_GROUP_SIZE = 6;

export async function createSubgroup(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRole("admin");

  const courseId = formData.get("course_id");
  const name = formData.get("name");
  if (typeof courseId !== "string" || typeof name !== "string" || !name) {
    return { error: "Give the subgroup a name." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("course_subgroups").insert({ course_id: courseId, name });

  if (error) {
    return { error: "Could not create subgroup. Try again." };
  }

  revalidatePath(`/dashboard/admin/courses/${courseId}`);
  return { error: null };
}

export async function addSubgroupMember(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRole("admin");

  const subgroupId = formData.get("subgroup_id");
  const courseId = formData.get("course_id");
  const traineeId = formData.get("trainee_id");
  if (typeof subgroupId !== "string" || typeof traineeId !== "string" || !traineeId) {
    return { error: "Choose a trainee to add." };
  }

  const supabase = await createClient();

  const { count } = await supabase
    .from("course_subgroup_members")
    .select("*", { count: "exact", head: true })
    .eq("subgroup_id", subgroupId);

  // If this subgroup is already paired as a half, its effective cap shrinks
  // by however many are already in the other half -- the combined total
  // across both halves is what's capped at 6, not each half independently.
  const { data: subgroup } = await supabase.from("course_subgroups").select("tp_group_id").eq("id", subgroupId).maybeSingle();
  let partnerCount = 0;
  if (subgroup?.tp_group_id) {
    const { data: partner } = await supabase
      .from("course_subgroups")
      .select("id")
      .eq("tp_group_id", subgroup.tp_group_id)
      .neq("id", subgroupId)
      .maybeSingle();
    if (partner) {
      const { count: pCount } = await supabase
        .from("course_subgroup_members")
        .select("*", { count: "exact", head: true })
        .eq("subgroup_id", partner.id);
      partnerCount = pCount ?? 0;
    }
  }

  const cap = MAX_TP_GROUP_SIZE - partnerCount;
  if ((count ?? 0) >= cap) {
    return {
      error: subgroup?.tp_group_id
        ? `This TP group is capped at ${MAX_TP_GROUP_SIZE} trainees combined across both halves.`
        : `Subgroups are capped at ${MAX_TP_GROUP_SIZE} trainees.`,
    };
  }

  const { error } = await supabase.from("course_subgroup_members").insert({
    subgroup_id: subgroupId,
    trainee_id: traineeId,
    base_slot: count ?? 0,
  });

  if (error) {
    return { error: "Could not add trainee. Are they already in a subgroup?" };
  }

  revalidatePath(`/dashboard/admin/courses/${courseId}`);
  return { error: null };
}

export async function removeSubgroupMember(formData: FormData): Promise<void> {
  await requireRole("admin");

  const memberId = formData.get("member_id");
  const courseId = formData.get("course_id");
  if (typeof memberId !== "string") return;

  const supabase = await createClient();
  await supabase.from("course_subgroup_members").delete().eq("id", memberId);

  if (typeof courseId === "string") {
    revalidatePath(`/dashboard/admin/courses/${courseId}`);
  }
}

// checkpoint 3 -- links two existing, unpaired subgroups as the two halves
// of a TP group (halves of three, alternating real TP days -- see
// specs/build-spec.md and src/lib/rotation.ts). The combined-6 cap is
// re-checked atomically inside pair_subgroups() itself, not just here.
export async function pairSubgroups(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requireRole("admin");

  const courseId = formData.get("course_id");
  const name = formData.get("name");
  const firstSubgroupId = formData.get("first_subgroup_id");
  const secondSubgroupId = formData.get("second_subgroup_id");
  if (
    typeof courseId !== "string" ||
    typeof name !== "string" ||
    !name ||
    typeof firstSubgroupId !== "string" ||
    typeof secondSubgroupId !== "string"
  ) {
    return { error: "Give the TP group a name and choose two subgroups." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("pair_subgroups", {
    p_course_id: courseId,
    p_name: name,
    p_first_subgroup_id: firstSubgroupId,
    p_second_subgroup_id: secondSubgroupId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/dashboard/admin/courses/${courseId}`);
  return { error: null };
}

// Unpairing only loosens constraints (frees up the combined-6 cap), so no
// RPC/atomicity concern here -- plain updates plus a delete, same shape as
// removeSubgroupMember.
export async function unpairTpGroup(formData: FormData): Promise<void> {
  await requireRole("admin");

  const tpGroupId = formData.get("tp_group_id");
  const courseId = formData.get("course_id");
  if (typeof tpGroupId !== "string") return;

  const supabase = await createClient();
  await supabase.from("course_subgroups").update({ tp_group_id: null, half_order: null }).eq("tp_group_id", tpGroupId);
  await supabase.from("course_tp_groups").delete().eq("id", tpGroupId);

  if (typeof courseId === "string") {
    revalidatePath(`/dashboard/admin/courses/${courseId}`);
  }
}
