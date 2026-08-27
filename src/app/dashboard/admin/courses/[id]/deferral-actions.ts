"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/require-role";
import type {
  DeferredAssignmentSnapshot,
  CarriedTpSnapshot,
  CarriedCelta5MatrixEntry,
  CarriedCelta5Record,
} from "@/lib/supabase/types";

// specs/build-spec.md §3 "Deferral" -- the destination side. Links a
// pending deferral_transfers row (created on the source course, see
// status-actions.ts's markForDeferral) to a trainee who has now actually
// joined this new course, and restores the frozen carried state: full
// assignment state, taught TPs (credited, read-only -- their next TP is
// left to the trainer's Manual Override, not the automatic rotation
// board), CELTA5 criteria, and tutorial record content.
export async function linkDeferralTransfer(formData: FormData): Promise<void> {
  const admin = await requireRole("admin");
  const transferId = formData.get("transfer_id");
  const destinationTraineeId = formData.get("destination_trainee_id");
  const courseId = formData.get("course_id");
  const modeChangeAgreed = formData.get("mode_change_agreed") === "on";
  const familiarisationPlan = ((formData.get("familiarisation_plan") as string | null) ?? "").trim() || null;
  if (typeof transferId !== "string" || typeof destinationTraineeId !== "string" || typeof courseId !== "string" || !destinationTraineeId) {
    return;
  }

  const supabase = await createClient();
  const { data: transfer } = await supabase
    .from("deferral_transfers")
    .select("id, center_id, source_course_id, carried_assignments, carried_tps, carried_celta5_matrix, carried_celta5_record, destination_trainee_id")
    .eq("id", transferId)
    .maybeSingle();
  if (!transfer || transfer.center_id !== admin.center_id || transfer.destination_trainee_id) {
    return;
  }

  const { data: destination } = await supabase
    .from("profiles")
    .select("id, course_id, role, center_id")
    .eq("id", destinationTraineeId)
    .maybeSingle();
  if (!destination || destination.role !== "trainee" || destination.course_id !== courseId || destination.center_id !== admin.center_id) {
    return;
  }

  // Handbook 7.9 (June 2025 numbering): "The new course should be in the same mode of delivery
  // as the original course, unless otherwise agreed in writing by the
  // candidate." Both courses definitely exist by link time, so the
  // comparison happens here rather than being snapshotted earlier.
  const [{ data: sourceCourse }, { data: destinationCourse }] = await Promise.all([
    supabase.from("courses").select("delivery_mode").eq("id", transfer.source_course_id).maybeSingle(),
    supabase.from("courses").select("delivery_mode").eq("id", courseId).maybeSingle(),
  ]);
  const modeChanged = Boolean(sourceCourse && destinationCourse && sourceCourse.delivery_mode !== destinationCourse.delivery_mode);
  if (modeChanged && !modeChangeAgreed) {
    return;
  }

  const adminClient = createAdminClient();
  const carriedAssignments = (transfer.carried_assignments ?? []) as DeferredAssignmentSnapshot[];
  const carriedTps = (transfer.carried_tps ?? []) as CarriedTpSnapshot[];
  const carriedMatrix = (transfer.carried_celta5_matrix ?? []) as CarriedCelta5MatrixEntry[];
  const carriedRecord = transfer.carried_celta5_record as CarriedCelta5Record | null;

  const writes = [
    ...carriedAssignments.map((a) =>
      adminClient.from("assignments").upsert(
        {
          course_id: courseId,
          trainee_id: destinationTraineeId,
          assignment_type: a.assignment_type,
          first_submission_url: a.first_submission_url,
          first_status: a.first_status,
          first_submitted_at: a.first_submitted_at,
          first_content_grade: a.first_content_grade,
          first_english_grade: a.first_english_grade,
          resubmission_url: a.resubmission_url,
          resubmission_status: a.resubmission_status,
          resubmission_submitted_at: a.resubmission_submitted_at,
          resubmission_content_grade: a.resubmission_content_grade,
          resubmission_english_grade: a.resubmission_english_grade,
          resubmission_outcome: a.resubmission_outcome,
          marker_id: a.marker_id,
          second_marker_id: a.second_marker_id,
          first_ai_declared: a.first_ai_declared,
          first_ai_conversation_url: a.first_ai_conversation_url,
          resubmission_ai_declared: a.resubmission_ai_declared,
          resubmission_ai_conversation_url: a.resubmission_ai_conversation_url,
          first_own_work_confirmed: a.first_own_work_confirmed,
          resubmission_own_work_confirmed: a.resubmission_own_work_confirmed,
          tutor_feedback: a.tutor_feedback,
        },
        { onConflict: "trainee_id,assignment_type" }
      )
    ),
    ...carriedTps.map((t) =>
      adminClient.from("plan_assignments").upsert(
        {
          course_id: courseId,
          trainee_id: destinationTraineeId,
          tp_number: t.tp_number,
          tp_point_id: t.tp_point_id,
          rotation_position_used: null,
          main_lesson_aim: t.main_lesson_aim,
          sub_aim: t.sub_aim,
          materials_description: t.materials_description,
          procedure: t.procedure,
          page_references: t.page_references,
          density_tier: t.density_tier,
          aim_type: t.aim_type,
          taught_at: t.taught_at,
          assigned_by: admin.id,
        },
        { onConflict: "trainee_id,tp_number" }
      )
    ),
    ...carriedMatrix.map((m) =>
      adminClient.from("celta5_matrix").upsert(
        {
          course_id: courseId,
          trainee_id: destinationTraineeId,
          criteria_code: m.criteria_code,
          tutor_status_stage2: m.tutor_status_stage2,
          tutor_status_stage3: m.tutor_status_stage3,
        },
        { onConflict: "trainee_id,criteria_code" }
      )
    ),
  ];

  await Promise.all(writes);

  if (carriedRecord) {
    // No unique constraint on celta5_records.trainee_id to upsert against
    // -- select-then-update-or-insert instead. Every real trainee gets a
    // bare row auto-created at join (join/actions.ts), so this is normally
    // an update.
    const { data: existing } = await adminClient
      .from("celta5_records")
      .select("id")
      .eq("trainee_id", destinationTraineeId)
      .maybeSingle();
    if (existing) {
      await adminClient.from("celta5_records").update(carriedRecord).eq("id", existing.id);
    } else {
      await adminClient.from("celta5_records").insert({ course_id: courseId, trainee_id: destinationTraineeId, ...carriedRecord });
    }
  }

  await adminClient
    .from("deferral_transfers")
    .update({
      destination_trainee_id: destinationTraineeId,
      destination_course_id: courseId,
      mode_change_agreed_at: modeChanged ? new Date().toISOString() : null,
      familiarisation_plan: modeChanged ? familiarisationPlan : null,
      linked_at: new Date().toISOString(),
      linked_by: admin.id,
    })
    .eq("id", transferId);

  revalidatePath(`/dashboard/admin/courses/${courseId}`);
}
