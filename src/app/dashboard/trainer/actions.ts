"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
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
  });

  if (error) {
    return { error: "Could not save the lesson. Try again." };
  }

  revalidatePath(`/dashboard/trainer/trainees/${traineeId}`);
  revalidatePath("/dashboard/trainer");
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
    })
    .eq("id", lessonId);

  if (error) {
    return { error: "Could not save. Try again." };
  }

  revalidatePath(`/dashboard/trainer/trainees/${traineeId}`);
  revalidatePath("/dashboard/trainer");
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
