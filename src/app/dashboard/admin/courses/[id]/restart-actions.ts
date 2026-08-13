"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/require-role";
import type { CarriedAssignmentSnapshot } from "@/lib/supabase/types";

// specs/build-spec.md §3 "First-half withdrawal with a restart" -- the
// destination side. Links a pending restart_transfers row (created on the
// source course, see status-actions.ts's markForRestart) to a trainee who
// has now actually joined this new course, and copies the frozen carried
// assignments onto their per-type row. Every real trainee gets these 4 rows
// auto-created at join (join/actions.ts), so this is normally an update --
// but upserts on the real unique (trainee_id, assignment_type) constraint
// (migration 0001) rather than assuming that row already exists, since
// there's no guarantee worth trusting blindly for an otherwise-irreversible
// portfolio-carrying action.
export async function linkRestartTransfer(formData: FormData): Promise<void> {
  const admin = await requireRole("admin");
  const transferId = formData.get("transfer_id");
  const destinationTraineeId = formData.get("destination_trainee_id");
  const courseId = formData.get("course_id");
  if (typeof transferId !== "string" || typeof destinationTraineeId !== "string" || typeof courseId !== "string" || !destinationTraineeId) {
    return;
  }

  const supabase = await createClient();
  const { data: transfer } = await supabase
    .from("restart_transfers")
    .select("id, center_id, carried_assignments, destination_trainee_id")
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

  const adminClient = createAdminClient();
  const carried = (transfer.carried_assignments ?? []) as CarriedAssignmentSnapshot[];

  await Promise.all(
    carried.map((c) =>
      adminClient.from("assignments").upsert(
        {
          course_id: courseId,
          trainee_id: destinationTraineeId,
          assignment_type: c.assignment_type,
          first_status: "approved",
          first_content_grade: c.content_grade,
          first_english_grade: c.english_grade,
          first_submitted_at: c.submitted_at,
          marker_id: c.marker_id,
          tutor_feedback: c.tutor_feedback,
        },
        { onConflict: "trainee_id,assignment_type" }
      )
    )
  );

  await adminClient
    .from("restart_transfers")
    .update({
      destination_trainee_id: destinationTraineeId,
      destination_course_id: courseId,
      linked_at: new Date().toISOString(),
      linked_by: admin.id,
    })
    .eq("id", transferId);

  revalidatePath(`/dashboard/admin/courses/${courseId}`);
}
