"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/require-role";
import type { AimType } from "@/lib/aim-type";

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
  const trainer = await requireRole(["trainer", "admin"]);

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

  // for-claude-code-announcements-list.md table A: "TP round released ->
  // whole cohort" -- narrowed here to just this subgroup, since release is
  // itself per-subgroup (a paired TP group's two halves release the same
  // TP number on different real dates, see rotation.ts). source_key makes
  // re-clicking an already-released round a no-op, not a duplicate ping --
  // checked in app code, not via upsert(onConflict), since Postgres won't
  // take a partial unique index as a conflict target through supabase-js
  // (see announcements-catalog.ts's comment for the confirmed 42P10).
  if (trainer.course_id) {
    const sourceKey = `tp_release:${subgroupId}:${tpNumber}`;
    const { data: already } = await supabase
      .from("course_broadcasts")
      .select("id")
      .eq("course_id", trainer.course_id)
      .eq("source_key", sourceKey)
      .maybeSingle();
    if (!already) {
      await supabase.from("course_broadcasts").insert({
        course_id: trainer.course_id,
        author_id: trainer.id,
        title: `TP${tpNumber} points are released — start planning`,
        body: null,
        visible_to_subgroup_id: subgroupId,
        sent_at: new Date().toISOString(),
        source_key: sourceKey,
      });
    }
  }

  revalidatePath("/trainer/rotation");
  revalidatePath("/trainer/announcements");
  return { error: null };
}

// connect-spec-corrections-for-claude-code.md item 10 (Admin Handbook): at
// most one of a candidate's 6 assessed TP lessons may be 1-to-1/small
// group, planned as such in advance, never TP7/TP8. TP1-6 only (mirrors
// the override page's own TP_NUMBERS) -- migration 0182's check constraint
// would reject 7/8 anyway, this just keeps the error message specific
// instead of falling through to the generic DB one. Same "can't edit after
// taught" gate as overrideTpPoint, for the same reason: the record of what
// was actually taught shouldn't change retroactively.
export async function setClassGrouping(_prevState: FormState, formData: FormData): Promise<FormState> {
  const trainer = await requireRole(["trainer", "admin"]);

  const traineeId = formData.get("trainee_id");
  const tpNumber = formData.get("tp_number");
  const classGrouping = formData.get("class_grouping");
  if (typeof traineeId !== "string" || typeof tpNumber !== "string" || typeof classGrouping !== "string" || !traineeId || !tpNumber) {
    return { error: "Pick a trainee and a TP number first." };
  }
  if (classGrouping !== "whole_class" && classGrouping !== "one_to_one_or_small_group") {
    return { error: "Something went wrong. Refresh and try again." };
  }
  const tpNum = Number(tpNumber);
  if (!Number.isInteger(tpNum) || tpNum < 1 || tpNum > 6) {
    return { error: "Only TP1-6 can be marked -- the final two (TP7/TP8) can never be 1-to-1 or small group." };
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

  const { data: existing } = await supabase
    .from("plan_assignments")
    .select("taught_at")
    .eq("trainee_id", traineeId)
    .eq("tp_number", tpNum)
    .maybeSingle();
  if (!existing) {
    return { error: "This TP hasn't been assigned yet -- assign it first." };
  }
  if (existing.taught_at) {
    return { error: "This TP has already been taught -- its grouping can't be changed after the fact." };
  }

  const { error } = await supabase
    .from("plan_assignments")
    .update({ class_grouping: classGrouping })
    .eq("trainee_id", traineeId)
    .eq("tp_number", tpNum);

  if (error) {
    return error.code === "23505"
      ? { error: "This trainee already has a different TP marked 1-to-1/small group -- only one is allowed across the course." }
      : { error: "Could not save. Try again." };
  }

  revalidatePath("/trainer/rotation");
  return { error: null };
}

const VALID_AIM_TYPES: AimType[] = ["grammar", "lexis", "function", "reading", "listening", "speaking", "writing"];

// connect-spec-corrections-for-claude-code.md item 13: "the MCT defines
// which main-aim types are allowed or required for TP7 and TP8, as part of
// setting up the Syllabus Planning Grid -- a constraint field per TP slot.
// This is the rule the rest of this feature must never override." An empty
// selection means unconstrained (every type offered), not "nothing
// allowed" -- there's no UI path to lock a slot out entirely, by design.
export async function setTp78AimConstraints(formData: FormData): Promise<void> {
  const trainer = await requireRole(["trainer", "admin"]);
  if (!trainer.course_id) return;

  const tp7Types = formData.getAll("tp7_aim_types").filter((v): v is AimType => typeof v === "string" && VALID_AIM_TYPES.includes(v as AimType));
  const tp8Types = formData.getAll("tp8_aim_types").filter((v): v is AimType => typeof v === "string" && VALID_AIM_TYPES.includes(v as AimType));

  const supabase = await createClient();
  await supabase
    .from("courses")
    .update({
      tp7_allowed_aim_types: tp7Types.length > 0 ? tp7Types : null,
      tp8_allowed_aim_types: tp8Types.length > 0 ? tp8Types : null,
    })
    .eq("id", trainer.course_id);

  revalidatePath("/trainer/rotation");
}
