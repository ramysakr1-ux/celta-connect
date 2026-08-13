"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/require-role";

export interface FormState {
  error: string | null;
}

export async function reorderSubgroup(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRole(["trainer", "admin"]);

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

  revalidatePath("/trainer/rotation");
  return { error: null };
}

export async function setTpSchedule(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const trainer = await requireRole(["trainer", "admin"]);

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

  revalidatePath("/trainer/rotation");
  return { error: null };
}

// specs/build-spec.md "Peer observation" -- "the feedback slot on the
// timetable reveals every note at once... the tutor may open it early."
// A manual trainer action rather than a timetable-time gate (see the
// candidate status card's own note on why: simpler, and "open it early"
// is explicitly normal, not an edge case worth a scheduling mechanism).
// Reveals every sheet for this half's group + TP round at once -- whoever
// already has a sheet (i.e. at least one peer wrote a note); nothing to
// reveal for a lesson nobody has noted yet.
export async function revealPeerNotes(formData: FormData): Promise<void> {
  const trainer = await requireRole(["trainer", "admin"]);
  const subgroupId = formData.get("subgroup_id");
  const tpNumber = formData.get("tp_number");
  if (typeof subgroupId !== "string" || typeof tpNumber !== "string") return;

  const supabase = await createClient();
  const { data: subgroup } = await supabase
    .from("course_subgroups")
    .select("id, course_id, tp_group_id")
    .eq("id", subgroupId)
    .maybeSingle();
  if (!subgroup || subgroup.course_id !== trainer.course_id) return;

  let subgroupIds = [subgroup.id];
  if (subgroup.tp_group_id) {
    const { data: paired } = await supabase.from("course_subgroups").select("id").eq("tp_group_id", subgroup.tp_group_id);
    if (paired && paired.length > 0) subgroupIds = paired.map((s) => s.id);
  }
  const { data: members } = await supabase.from("course_subgroup_members").select("trainee_id").in("subgroup_id", subgroupIds);
  const traineeIds = (members ?? []).map((m) => m.trainee_id);
  if (traineeIds.length === 0) return;

  const admin = createAdminClient();
  await admin
    .from("peer_observation_sheets")
    .update({ revealed_at: new Date().toISOString(), revealed_by: trainer.id })
    .in("trainee_id", traineeIds)
    .eq("tp_number", Number(tpNumber))
    .is("revealed_at", null);

  revalidatePath("/trainer/rotation");
}

export async function assignTpRound(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRole(["trainer", "admin"]);

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

  revalidatePath("/trainer/rotation");
  return { error: null };
}
