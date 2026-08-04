"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { CELTA_CRITERIA_CODES } from "@/lib/celta-criteria";
import type { CriteriaRating, StandardRating } from "@/lib/supabase/types";

export interface FormState {
  error: string | null;
}

const CRITERIA_RATINGS: CriteriaRating[] = ["S+", "S", "N", "X"];
const STANDARD_RATINGS: StandardRating[] = ["above_standard", "to_standard", "not_to_standard"];

function optionalString(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" && value ? value : null;
}

function optionalNumber(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || !value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function optionalRating<T extends string>(
  value: FormDataEntryValue | null,
  allowed: readonly T[]
): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

export async function updateAttendance(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRole("trainer");

  const traineeId = formData.get("trainee_id");
  if (typeof traineeId !== "string" || !traineeId) {
    return { error: "Something went wrong. Refresh and try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("celta5_records")
    .update({ hours_attended: optionalNumber(formData.get("hours_attended")) })
    .eq("trainee_id", traineeId);

  if (error) {
    return { error: "Could not save. Try again." };
  }

  revalidatePath(`/dashboard/trainer/trainees/${traineeId}/celta5`);
  return { error: null };
}

export async function addAbsence(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const trainer = await requireRole("trainer");

  const traineeId = formData.get("trainee_id");
  const category = formData.get("category");
  if (
    typeof traineeId !== "string" ||
    !traineeId ||
    (category !== "unavoidable" && category !== "other")
  ) {
    return { error: "Something went wrong. Refresh and try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("attendance_absences").insert({
    course_id: trainer.course_id!,
    trainee_id: traineeId,
    category,
    session_date: optionalString(formData.get("session_date")),
    reason: optionalString(formData.get("reason")),
    work_made_up: optionalString(formData.get("work_made_up")),
    tutor_comment: optionalString(formData.get("tutor_comment")),
  });

  if (error) {
    return { error: "Could not save. Try again." };
  }

  revalidatePath(`/dashboard/trainer/trainees/${traineeId}/celta5`);
  return { error: null };
}

export async function updateStage1(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRole("trainer");

  const traineeId = formData.get("trainee_id");
  if (typeof traineeId !== "string" || !traineeId) {
    return { error: "Something went wrong. Refresh and try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("celta5_records")
    .update({
      stage1_tutorial_given: formData.get("stage1_tutorial_given") === "on",
      stage1_hours_taught: optionalNumber(formData.get("stage1_hours_taught")),
      stage1_strengths: optionalString(formData.get("stage1_strengths")),
      stage1_action_plan: optionalString(formData.get("stage1_action_plan")),
      stage1_completed_at:
        formData.get("stage1_completed") === "on" ? new Date().toISOString() : null,
    })
    .eq("trainee_id", traineeId);

  if (error) {
    return { error: "Could not save. Try again." };
  }

  revalidatePath(`/dashboard/trainer/trainees/${traineeId}/celta5`);
  return { error: null };
}

export async function updateStage2Ratings(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRole("trainer");

  const traineeId = formData.get("trainee_id");
  if (typeof traineeId !== "string" || !traineeId) {
    return { error: "Something went wrong. Refresh and try again." };
  }

  const supabase = await createClient();

  const updates = CELTA_CRITERIA_CODES.map(async (code) => {
    const status = optionalRating(formData.get(`status__${code}`), CRITERIA_RATINGS);
    return supabase
      .from("celta5_matrix")
      .update({ tutor_status_stage2: status })
      .eq("trainee_id", traineeId)
      .eq("criteria_code", code);
  });

  const results = await Promise.all(updates);
  if (results.some((r) => r.error)) {
    return { error: "Some criteria could not be saved. Try again." };
  }

  revalidatePath(`/dashboard/trainer/trainees/${traineeId}/celta5`);
  return { error: null };
}

export async function updateStage2Overall(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRole("trainer");

  const traineeId = formData.get("trainee_id");
  if (typeof traineeId !== "string" || !traineeId) {
    return { error: "Something went wrong. Refresh and try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("celta5_records")
    .update({
      stage2_tutorial_given: formData.get("stage2_tutorial_given") === "on",
      stage2_hours_taught: optionalNumber(formData.get("stage2_hours_taught")),
      stage2_tutor_overall: optionalRating(formData.get("stage2_tutor_overall"), STANDARD_RATINGS),
      stage2_tutor_notes: optionalString(formData.get("stage2_tutor_notes")),
      stage2_tutor_written_assignments_notes: optionalString(
        formData.get("stage2_tutor_written_assignments_notes")
      ),
      stage2_tutor_other_notes: optionalString(formData.get("stage2_tutor_other_notes")),
      stage2_completed_at:
        formData.get("stage2_completed") === "on" ? new Date().toISOString() : null,
    })
    .eq("trainee_id", traineeId);

  if (error) {
    return { error: "Could not save. Try again." };
  }

  revalidatePath(`/dashboard/trainer/trainees/${traineeId}/celta5`);
  return { error: null };
}

export async function updateStage3Ratings(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRole("trainer");

  const traineeId = formData.get("trainee_id");
  if (typeof traineeId !== "string" || !traineeId) {
    return { error: "Something went wrong. Refresh and try again." };
  }

  const supabase = await createClient();

  const updates = CELTA_CRITERIA_CODES.map(async (code) => {
    const status = optionalRating(formData.get(`status__${code}`), CRITERIA_RATINGS);
    return supabase
      .from("celta5_matrix")
      .update({ tutor_status_stage3: status })
      .eq("trainee_id", traineeId)
      .eq("criteria_code", code);
  });

  const results = await Promise.all(updates);
  if (results.some((r) => r.error)) {
    return { error: "Some criteria could not be saved. Try again." };
  }

  revalidatePath(`/dashboard/trainer/trainees/${traineeId}/celta5`);
  return { error: null };
}

export async function updateStage3Overall(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRole("trainer");

  const traineeId = formData.get("trainee_id");
  if (typeof traineeId !== "string" || !traineeId) {
    return { error: "Something went wrong. Refresh and try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("celta5_records")
    .update({
      stage3_required: formData.get("stage3_required") === "on",
      stage3_tutorial_given: formData.get("stage3_tutorial_given") === "on",
      stage3_hours_taught: optionalNumber(formData.get("stage3_hours_taught")),
      stage3_tutor_overall: optionalRating(formData.get("stage3_tutor_overall"), STANDARD_RATINGS),
      stage3_tutor_notes: optionalString(formData.get("stage3_tutor_notes")),
      stage3_tutor_written_assignments_notes: optionalString(
        formData.get("stage3_tutor_written_assignments_notes")
      ),
      stage3_tutor_other_notes: optionalString(formData.get("stage3_tutor_other_notes")),
      stage3_finalized_at:
        formData.get("stage3_finalized") === "on" ? new Date().toISOString() : null,
    })
    .eq("trainee_id", traineeId);

  if (error) {
    return { error: "Could not save. Try again." };
  }

  revalidatePath(`/dashboard/trainer/trainees/${traineeId}/celta5`);
  return { error: null };
}

export async function updateAdminGrant(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const trainer = await requireRole("trainer");

  const traineeId = formData.get("trainee_id");
  const granted = formData.get("granted") === "on";
  const accessLevel = formData.get("access_level");
  if (
    typeof traineeId !== "string" ||
    !traineeId ||
    (accessLevel !== "read" && accessLevel !== "edit")
  ) {
    return { error: "Something went wrong. Refresh and try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("celta5_records")
    .update(
      granted
        ? {
            admin_access_granted_at: new Date().toISOString(),
            admin_access_granted_by: trainer.id,
            admin_access_level: accessLevel,
          }
        : {
            admin_access_granted_at: null,
            admin_access_granted_by: null,
            admin_access_level: null,
          }
    )
    .eq("trainee_id", traineeId);

  if (error) {
    return { error: "Could not save. Try again." };
  }

  revalidatePath(`/dashboard/trainer/trainees/${traineeId}/celta5`);
  return { error: null };
}

export async function finalizeRecord(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRole("trainer");

  const traineeId = formData.get("trainee_id");
  if (typeof traineeId !== "string" || !traineeId) {
    return { error: "Something went wrong. Refresh and try again." };
  }

  const finalized = formData.get("finalized") === "on";

  const supabase = await createClient();
  const { error } = await supabase
    .from("celta5_records")
    .update({ trainer_signoff_final_at: finalized ? new Date().toISOString() : null })
    .eq("trainee_id", traineeId);

  if (error) {
    return { error: "Could not save. Try again." };
  }

  revalidatePath(`/dashboard/trainer/trainees/${traineeId}/celta5`);
  return { error: null };
}

export async function updateFinalGrade(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRole("trainer");

  const traineeId = formData.get("trainee_id");
  const finalGrade = formData.get("final_recommended_grade");
  if (typeof traineeId !== "string" || !traineeId) {
    return { error: "Something went wrong. Refresh and try again." };
  }

  const validGrades = ["Pass", "Pass B", "Pass A", "Fail", "Withdrawn"] as const;
  const grade =
    typeof finalGrade === "string" && (validGrades as readonly string[]).includes(finalGrade)
      ? (finalGrade as (typeof validGrades)[number])
      : null;

  const teachingGradeRaw = formData.get("final_teaching_grade");
  const validTeachingGrades = ["Pass", "Pass B", "Pass A", "Fail"] as const;
  const teachingGrade =
    typeof teachingGradeRaw === "string" && (validTeachingGrades as readonly string[]).includes(teachingGradeRaw)
      ? (teachingGradeRaw as (typeof validTeachingGrades)[number])
      : null;

  const assignmentsGradeRaw = formData.get("final_assignments_grade");
  const assignmentsGrade = assignmentsGradeRaw === "Pass" || assignmentsGradeRaw === "Fail" ? assignmentsGradeRaw : null;

  const supabase = await createClient();
  const { error } = await supabase
    .from("celta5_records")
    .update({
      final_recommended_grade: grade,
      final_teaching_grade: teachingGrade,
      final_assignments_grade: assignmentsGrade,
      overall_notes: optionalString(formData.get("overall_notes")),
    })
    .eq("trainee_id", traineeId);

  if (error) {
    return { error: "Could not save. Try again." };
  }

  revalidatePath(`/dashboard/trainer/trainees/${traineeId}/celta5`);
  return { error: null };
}
