"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

export interface FormState {
  error: string | null;
}

const MAX_SUBGROUP_SIZE = 3;

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

  if ((count ?? 0) >= MAX_SUBGROUP_SIZE) {
    return { error: `Subgroups are capped at ${MAX_SUBGROUP_SIZE} trainees.` };
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
