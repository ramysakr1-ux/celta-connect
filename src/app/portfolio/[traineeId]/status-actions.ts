"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/require-role";
import type { CarriedAssignmentSnapshot } from "@/lib/supabase/types";

export interface WithdrawFormState {
  error: string | null;
}

// specs/build-spec.md §3 "Withdrawal" -- formal and final, no reversal.
// Reportability is computed once, right now, from whether the course's
// entry_form_sent_at is already set -- not re-derived later, since setting
// that field afterward must never retroactively rewrite this candidate's
// history.
export async function withdrawTrainee(
  _prevState: WithdrawFormState,
  formData: FormData
): Promise<WithdrawFormState> {
  const staff = await requireRole(["trainer", "admin"]);
  const traineeId = formData.get("trainee_id");
  const note = ((formData.get("note") as string | null) ?? "").trim() || null;
  if (typeof traineeId !== "string") {
    return { error: "Missing candidate." };
  }

  const supabase = await createClient();
  const { data: trainee } = await supabase
    .from("profiles")
    .select("id, course_id, role, course_status")
    .eq("id", traineeId)
    .maybeSingle();
  if (!trainee || trainee.role !== "trainee" || trainee.course_id !== staff.course_id) {
    return { error: "Candidate not found on your course." };
  }
  if (trainee.course_status !== "active") {
    return { error: "This candidate already has a course status set." };
  }

  const { data: course } = await supabase
    .from("courses")
    .select("entry_form_sent_at")
    .eq("id", trainee.course_id as string)
    .maybeSingle();

  const now = new Date().toISOString();
  // profiles RLS only lets a user update their own row (or an admin update
  // anyone in their center) -- a trainer withdrawing someone else's row
  // needs the admin client, same as removeRosterMember. Authorization is
  // already independently checked above (role + same course), so this
  // isn't bypassing anything, just reaching past a policy that has no
  // "trainer, but only this one field, on someone else's row" carve-out.
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({
      course_status: "withdrawn",
      course_status_set_at: now,
      course_status_set_by: staff.id,
      course_status_note: note,
      withdrawal_reportable: Boolean(course?.entry_form_sent_at),
      withdrawal_letter_generated_at: now,
    })
    .eq("id", traineeId);
  if (error) {
    return { error: "Could not withdraw this candidate. Try again." };
  }

  revalidatePath(`/portfolio/${traineeId}`);
  revalidatePath("/trainer/roster");
  return { error: null };
}

export interface RestartFormState {
  error: string | null;
}

// specs/build-spec.md §3 "First-half withdrawal with a restart... can
// transfer any successful assessment to the new course. Teaching starts
// again from TP1; passed assignments carry. This is not a deferral and
// must not reuse the deferral flow." Snapshots currently-passed assignments
// into restart_transfers now (see migration 0070) -- the destination course
// usually doesn't exist yet, so there's nothing to link to at this point,
// only something to freeze and wait with. "Plagiarism Reflection" is
// deliberately excluded: it's tied to a specific malpractice case on the
// old course and has no standalone meaning on a new one.
export async function markForRestart(
  _prevState: RestartFormState,
  formData: FormData
): Promise<RestartFormState> {
  const staff = await requireRole(["trainer", "admin"]);
  const traineeId = formData.get("trainee_id");
  const note = ((formData.get("note") as string | null) ?? "").trim() || null;
  if (typeof traineeId !== "string") {
    return { error: "Missing candidate." };
  }

  const supabase = await createClient();
  const { data: trainee } = await supabase
    .from("profiles")
    .select("id, course_id, center_id, role, course_status")
    .eq("id", traineeId)
    .maybeSingle();
  if (!trainee || trainee.role !== "trainee" || trainee.course_id !== staff.course_id) {
    return { error: "Candidate not found on your course." };
  }
  if (trainee.course_status !== "active") {
    return { error: "This candidate already has a course status set." };
  }

  const { data: assignments } = await supabase
    .from("assignments")
    .select(
      "id, assignment_type, first_status, first_content_grade, first_english_grade, first_submitted_at, resubmission_status, resubmission_content_grade, resubmission_english_grade, resubmission_submitted_at, marker_id, tutor_feedback"
    )
    .eq("trainee_id", traineeId);

  const carried: CarriedAssignmentSnapshot[] = (assignments ?? [])
    .filter((a) => a.assignment_type !== "Plagiarism Reflection")
    .filter((a) => a.first_status === "approved" || a.resubmission_status === "approved")
    .map((a) => {
      const passedOnResubmission = a.resubmission_status === "approved";
      return {
        assignment_type: a.assignment_type,
        content_grade: passedOnResubmission ? a.resubmission_content_grade : a.first_content_grade,
        english_grade: passedOnResubmission ? a.resubmission_english_grade : a.first_english_grade,
        marker_id: a.marker_id,
        tutor_feedback: a.tutor_feedback,
        submitted_at: passedOnResubmission ? a.resubmission_submitted_at : a.first_submitted_at,
        source_assignment_id: a.id,
      };
    });

  const admin = createAdminClient();
  const [{ error: transferError }, { error: statusError }] = await Promise.all([
    admin.from("restart_transfers").insert({
      center_id: trainee.center_id,
      source_trainee_id: traineeId,
      source_course_id: trainee.course_id as string,
      carried_assignments: carried,
      note,
      created_by: staff.id,
    }),
    admin
      .from("profiles")
      .update({
        course_status: "restarting",
        course_status_set_at: new Date().toISOString(),
        course_status_set_by: staff.id,
        course_status_note: note,
      })
      .eq("id", traineeId),
  ]);
  if (transferError || statusError) {
    return { error: "Could not record the restart. Try again." };
  }

  revalidatePath(`/portfolio/${traineeId}`);
  revalidatePath("/trainer/roster");
  return { error: null };
}

export interface ExtensionFormState {
  error: string | null;
}

// specs/build-spec.md §3 "Extension -- for special consideration... The
// candidate completes after the official end date... Close-out waits."
// Unlike withdrawTrainee, this does NOT freeze the portfolio -- course_status
// changes but isCourseStatusReadOnly deliberately excludes 'extension'.
export async function grantExtension(
  _prevState: ExtensionFormState,
  formData: FormData
): Promise<ExtensionFormState> {
  const staff = await requireRole(["trainer", "admin"]);
  const traineeId = formData.get("trainee_id");
  const note = ((formData.get("note") as string | null) ?? "").trim() || null;
  const completesBy = (formData.get("completes_by") as string | null) || null;
  if (typeof traineeId !== "string") {
    return { error: "Missing candidate." };
  }

  const supabase = await createClient();
  const { data: trainee } = await supabase
    .from("profiles")
    .select("id, course_id, role, course_status")
    .eq("id", traineeId)
    .maybeSingle();
  if (!trainee || trainee.role !== "trainee" || trainee.course_id !== staff.course_id) {
    return { error: "Candidate not found on your course." };
  }
  if (trainee.course_status !== "active") {
    return { error: "This candidate already has a course status set." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({
      course_status: "extension",
      course_status_set_at: new Date().toISOString(),
      course_status_set_by: staff.id,
      course_status_note: note,
      extension_completes_by: completesBy,
    })
    .eq("id", traineeId);
  if (error) {
    return { error: "Could not record the extension. Try again." };
  }

  revalidatePath(`/portfolio/${traineeId}`);
  revalidatePath("/trainer/roster");
  return { error: null };
}
