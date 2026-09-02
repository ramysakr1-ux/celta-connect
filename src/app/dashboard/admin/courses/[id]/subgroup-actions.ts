"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCapabilityOrTrainer } from "@/lib/auth/require-capability";
import { syncAssignmentDueDates } from "@/lib/assignment-due-dates";

export interface FormState {
  error: string | null;
}

// Moved to /trainer/rotation 2026-08-27 -- these actions and their UI
// (subgroups-form.tsx) were left unmounted when Course Admin's page was
// trimmed 23 Aug ("MCT territory once the course is running"). Widened from
// admin-only to any trainer on the course (not MCT-gated): unlike close-out
// or chat retention, nothing here is administrative -- setTpGroupTutor's own
// comment already established "the MCT/ACT distinction governs
// announcements, not teaching," and /trainer/rotation itself has never been
// MCT-restricted, so subgroup/pairing management follows the same openness.
//
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
  await requireCapabilityOrTrainer("courseAdmin.groups");

  const courseId = formData.get("course_id");
  const name = formData.get("name");
  if (typeof courseId !== "string" || typeof name !== "string" || !name) {
    return { error: "Give the subgroup a name." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("course_subgroups").insert({ course_id: courseId, name });

  if (error) {
    // The message below is what the person reads; this is what we read.
    console.error("[dashboard/admin/courses/[id]/subgroup-actions.ts:createSubgroup]", error);
    return { error: "Could not create subgroup. Try again." };
}

  revalidatePath("/trainer/rotation");
  return { error: null };
}

export async function addSubgroupMember(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  await requireCapabilityOrTrainer("courseAdmin.groups");

  const subgroupId = formData.get("subgroup_id");
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
    // The message below is what the person reads; this is what we read.
    console.error("[dashboard/admin/courses/[id]/subgroup-actions.ts:addSubgroupMember]", error);
    return { error: "Could not add trainee. Are they already in a subgroup?" };
}

  revalidatePath("/trainer/rotation");
  return { error: null };
}

export async function removeSubgroupMember(formData: FormData): Promise<void> {
  await requireCapabilityOrTrainer("courseAdmin.groups");

  const memberId = formData.get("member_id");
  const courseId = formData.get("course_id");
  if (typeof memberId !== "string") return;

  const supabase = await createClient();
  await supabase.from("course_subgroup_members").delete().eq("id", memberId);

  if (typeof courseId === "string") {
    revalidatePath("/trainer/rotation");
  }
}

// checkpoint 3 -- links two existing, unpaired subgroups as the two halves
// of a TP group (halves of three, alternating real TP days -- see
// specs/build-spec.md and src/lib/rotation.ts). The combined-6 cap is
// re-checked atomically inside pair_subgroups() itself, not just here.
export async function pairSubgroups(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requireCapabilityOrTrainer("courseAdmin.groups");

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

  // Pairing determines which calendar date is "the other half's TP day" --
  // design_handoff_timetable_decisions' group-split due dates (Skills, LfC)
  // read straight off this, so a pairing change has to re-resolve them.
  // Harmless no-op if the timetable isn't generated yet.
  await syncAssignmentDueDates(supabase, courseId);

  revalidatePath("/trainer/rotation");
  return { error: null };
}

// Unpairing only loosens constraints (frees up the combined-6 cap), so no
// RPC/atomicity concern here -- plain updates plus a delete, same shape as
// removeSubgroupMember.
export async function unpairTpGroup(formData: FormData): Promise<void> {
  await requireCapabilityOrTrainer("courseAdmin.groups");

  const tpGroupId = formData.get("tp_group_id");
  const courseId = formData.get("course_id");
  if (typeof tpGroupId !== "string") return;

  const supabase = await createClient();
  await supabase.from("course_subgroups").update({ tp_group_id: null, half_order: null }).eq("tp_group_id", tpGroupId);
  await supabase.from("course_tp_groups").delete().eq("id", tpGroupId);

  if (typeof courseId === "string") {
    await syncAssignmentDueDates(supabase, courseId);
    revalidatePath("/trainer/rotation");
  }
}

/**
 * Assign a tutor to a TP group, and record when it meets.
 *
 * The group is the unit a tutor actually owns -- they observe it, feed back on
 * it, and sign its candidates' CELTA 5s -- so "who has Group ABC" is a
 * question the app should be able to answer. Until migration 0121 it could
 * not.
 *
 * Deliberately permissive about who can hold it: any trainer on the course,
 * with no tutor_role requirement. A TP tutor, an assistant course tutor and
 * the MCT can all own a group, and Ramy was clear that the MCT/ACT
 * distinction governs announcements, not teaching.
 */
export async function setTpGroupTutor(_prevState: FormState, formData: FormData): Promise<FormState> {
  const profile = await requireCapabilityOrTrainer("courseAdmin.groups");

  const groupId = formData.get("group_id");
  const courseId = formData.get("course_id");
  const tutorId = (formData.get("tutor_profile_id") as string | null) || null;
  const meetingDays = (formData.get("meeting_days") as string | null)?.trim() || null;

  if (typeof groupId !== "string" || typeof courseId !== "string") {
    return { error: "Something went wrong. Refresh and try again." };
  }

  const admin = createAdminClient();
  const { data: course } = await admin.from("courses").select("id, center_id").eq("id", courseId).maybeSingle();
  if (!course || course.center_id !== profile.center_id) return { error: "Course not found." };

  // A tutor from another course would look plausible in the dropdown and be
  // wrong in every downstream screen, so the link is checked rather than
  // trusted.
  if (tutorId) {
    const { data: onCourse } = await admin
      .from("profiles")
      .select("id")
      .eq("id", tutorId)
      .eq("course_id", courseId)
      .eq("role", "trainer")
      .maybeSingle();
    if (!onCourse) return { error: "That tutor isn't on this course." };
  }

  const { error } = await admin
    .from("course_tp_groups")
    .update({ tutor_profile_id: tutorId, meeting_days: meetingDays })
    .eq("id", groupId)
    .eq("course_id", courseId);
  if (error) {
    // The message above is what the person reads; this is what we read.
    console.error("[dashboard/admin/courses/[id]/subgroup-actions.ts:setTpGroupTutor]", error);
    return { error: "Could not save. Try again." };
  }

  revalidatePath("/trainer/rotation");
  return { error: null };
}
