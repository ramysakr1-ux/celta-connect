"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { CELTA_CRITERIA_CODES } from "@/lib/celta-criteria";
import type { PassFail, StandardRating, SubmissionStatus } from "@/lib/supabase/types";

export interface FormState {
  error: string | null;
}

const SUBMISSION_STATUSES: SubmissionStatus[] = [
  "not_submitted",
  "pending",
  "submitted",
  "resubmission_required",
  "approved",
];

const STANDARD_RATINGS: StandardRating[] = ["above_standard", "to_standard", "not_to_standard"];
const PASS_FAILS: PassFail[] = ["pass", "fail"];

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

export async function createTpLesson(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const trainer = await requireRole("trainer");

  const traineeId = formData.get("trainee_id");
  if (typeof traineeId !== "string" || !traineeId) {
    return { error: "Something went wrong. Refresh and try again." };
  }

  const tpNumber = optionalNumber(formData.get("tp_number"));

  const supabase = await createClient();
  const { error } = await supabase.from("tp_lessons").insert({
    course_id: trainer.course_id!,
    trainee_id: traineeId,
    trainer_id: trainer.id,
    lesson_date: optionalString(formData.get("lesson_date")),
    length_minutes: optionalNumber(formData.get("length_minutes")),
    level: optionalString(formData.get("level")),
    learner_count: optionalNumber(formData.get("learner_count")),
    lesson_focus: optionalString(formData.get("lesson_focus")),
    tutor_assessment: optionalRating(formData.get("tutor_assessment"), STANDARD_RATINGS),
    tutor_comments: optionalString(formData.get("tutor_comments")),
    tp_number: tpNumber,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: `This trainee already has a lesson logged for TP${tpNumber} -- edit that entry instead.` };
    }
    return { error: "Could not save the lesson. Try again." };
  }

  // Logging the outcome for a TP round is also what unlocks the next one --
  // one action for the trainer, not a separate "Mark taught" click. `.is`
  // guard keeps this idempotent if the trainee's TP was somehow already
  // marked taught.
  if (tpNumber !== null) {
    await supabase
      .from("plan_assignments")
      .update({ taught_at: new Date().toISOString() })
      .eq("trainee_id", traineeId)
      .eq("tp_number", tpNumber)
      .is("taught_at", null);
  }

  revalidatePath(`/dashboard/trainer/trainees/${traineeId}`);
  revalidatePath("/dashboard/trainer");
  revalidatePath("/dashboard/trainer/rotation");
  revalidatePath("/dashboard/trainee/plan");
  return { error: null };
}

export async function updateTpLesson(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRole("trainer");

  const lessonId = formData.get("lesson_id");
  const traineeId = formData.get("trainee_id");
  if (typeof lessonId !== "string" || typeof traineeId !== "string") {
    return { error: "Something went wrong. Refresh and try again." };
  }

  const tpNumber = optionalNumber(formData.get("tp_number"));

  const supabase = await createClient();
  const { error } = await supabase
    .from("tp_lessons")
    .update({
      lesson_date: optionalString(formData.get("lesson_date")),
      length_minutes: optionalNumber(formData.get("length_minutes")),
      level: optionalString(formData.get("level")),
      learner_count: optionalNumber(formData.get("learner_count")),
      lesson_focus: optionalString(formData.get("lesson_focus")),
      tutor_assessment: optionalRating(formData.get("tutor_assessment"), STANDARD_RATINGS),
      tutor_comments: optionalString(formData.get("tutor_comments")),
      tp_number: tpNumber,
    })
    .eq("id", lessonId);

  if (error) {
    if (error.code === "23505") {
      return { error: `This trainee already has a lesson logged for TP${tpNumber} -- edit that entry instead.` };
    }
    return { error: "Could not save. Try again." };
  }

  // A trainer might add the TP number on a later edit rather than at
  // creation -- still unlocks the next TP when that happens.
  if (tpNumber !== null) {
    await supabase
      .from("plan_assignments")
      .update({ taught_at: new Date().toISOString() })
      .eq("trainee_id", traineeId)
      .eq("tp_number", tpNumber)
      .is("taught_at", null);
  }

  revalidatePath(`/dashboard/trainer/trainees/${traineeId}`);
  revalidatePath("/dashboard/trainer");
  revalidatePath("/dashboard/trainer/rotation");
  revalidatePath("/dashboard/trainee/plan");
  return { error: null };
}

export async function addCriteriaTag(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRole("trainer");

  const lessonId = formData.get("lesson_id");
  const traineeId = formData.get("trainee_id");
  const criteriaCode = formData.get("criteria_code");
  const tagType = formData.get("tag_type");

  if (
    typeof lessonId !== "string" ||
    typeof traineeId !== "string" ||
    typeof criteriaCode !== "string" ||
    !CELTA_CRITERIA_CODES.includes(criteriaCode) ||
    (tagType !== "strength" && tagType !== "action_point")
  ) {
    return { error: "Pick a criterion and a type." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("tp_lesson_criteria_tags").insert({
    tp_lesson_id: lessonId,
    criteria_code: criteriaCode,
    tag_type: tagType,
  });

  if (error) {
    return { error: "Could not save the tag. Try again." };
  }

  revalidatePath(`/dashboard/trainer/trainees/${traineeId}`);
  revalidatePath(`/dashboard/trainer/trainees/${traineeId}/celta5`);
  return { error: null };
}

export async function removeCriteriaTag(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRole("trainer");

  const tagId = formData.get("tag_id");
  const traineeId = formData.get("trainee_id");
  if (typeof tagId !== "string" || typeof traineeId !== "string") {
    return { error: "Something went wrong. Refresh and try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("tp_lesson_criteria_tags").delete().eq("id", tagId);

  if (error) {
    return { error: "Could not remove the tag. Try again." };
  }

  revalidatePath(`/dashboard/trainer/trainees/${traineeId}`);
  revalidatePath(`/dashboard/trainer/trainees/${traineeId}/celta5`);
  return { error: null };
}

export async function updateAssignment(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRole("trainer");

  const assignmentId = formData.get("assignment_id");
  const traineeId = formData.get("trainee_id");
  const firstStatus = formData.get("first_status");
  const resubmissionStatus = formData.get("resubmission_status");
  const finalGrade = formData.get("final_grade");

  if (
    typeof assignmentId !== "string" ||
    typeof traineeId !== "string" ||
    typeof firstStatus !== "string" ||
    typeof resubmissionStatus !== "string" ||
    !SUBMISSION_STATUSES.includes(firstStatus as SubmissionStatus) ||
    !SUBMISSION_STATUSES.includes(resubmissionStatus as SubmissionStatus)
  ) {
    return { error: "Something went wrong. Refresh and try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("assignments")
    .update({
      first_status: firstStatus as SubmissionStatus,
      first_content_grade: optionalRating(formData.get("first_content_grade"), PASS_FAILS),
      first_english_grade: optionalRating(formData.get("first_english_grade"), PASS_FAILS),
      resubmission_status: resubmissionStatus as SubmissionStatus,
      resubmission_content_grade: optionalRating(
        formData.get("resubmission_content_grade"),
        PASS_FAILS
      ),
      resubmission_english_grade: optionalRating(
        formData.get("resubmission_english_grade"),
        PASS_FAILS
      ),
      final_grade: optionalString(formData.get("final_grade")) ?? (finalGrade ? String(finalGrade) : null),
    })
    .eq("id", assignmentId);

  if (error) {
    return { error: "Could not save. Try again." };
  }

  revalidatePath(`/dashboard/trainer/trainees/${traineeId}`);
  revalidatePath("/dashboard/trainer");
  return { error: null };
}
