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

export async function submitStage2SelfAssessment(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRole("trainee");

  const overall = formData.get("overall");
  if (typeof overall !== "string" || !STANDARD_RATINGS.includes(overall as StandardRating)) {
    return { error: "Choose an overall progress option." };
  }

  const ratings: Record<string, CriteriaRating> = {};
  for (const code of CELTA_CRITERIA_CODES) {
    const value = formData.get(`status__${code}`);
    if (typeof value === "string" && CRITERIA_RATINGS.includes(value as CriteriaRating)) {
      ratings[code] = value as CriteriaRating;
    }
  }

  if (Object.keys(ratings).length < CELTA_CRITERIA_CODES.length) {
    return { error: "Rate every criterion before submitting." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_stage2_self_assessment", {
    ratings,
    overall: overall as StandardRating,
    notes: (formData.get("notes") as string) || null,
    written_assignments_notes: (formData.get("written_assignments_notes") as string) || null,
    other_notes: (formData.get("other_notes") as string) || null,
  });

  if (error) {
    return { error: "Could not submit. Try again." };
  }

  revalidatePath("/dashboard/trainee/celta5");
  return { error: null };
}

export async function signOffStage2(): Promise<void> {
  await requireRole("trainee");
  const supabase = await createClient();
  await supabase.rpc("trainee_sign_off_stage2");
  revalidatePath("/dashboard/trainee/celta5");
}

export async function signOffFinal(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requireRole("trainee");
  const supabase = await createClient();
  const { error } = await supabase.rpc("trainee_sign_off_final", {
    p_checklist_tp: formData.get("checklist_tp") === "on",
    p_checklist_observations: formData.get("checklist_observations") === "on",
    p_checklist_assignments: formData.get("checklist_assignments") === "on",
    p_checklist_own_work: formData.get("checklist_own_work") === "on",
    p_checklist_all_records: formData.get("checklist_all_records") === "on",
  });

  if (error) {
    return { error: "Could not sign off -- make sure all five confirmations are checked." };
  }

  revalidatePath("/dashboard/trainee/celta5");
  revalidatePath("/portfolio", "layout");
  return { error: null };
}

export interface ObservationFormState {
  error: string | null;
}

export async function saveObservation(
  _prevState: ObservationFormState,
  formData: FormData
): Promise<ObservationFormState> {
  const trainee = await requireRole("trainee");

  const observationId = formData.get("observation_id");
  const supabase = await createClient();

  const payload = {
    observation_date: (formData.get("observation_date") as string) || null,
    length_minutes: formData.get("length_minutes")
      ? Number(formData.get("length_minutes"))
      : null,
    level: (formData.get("level") as string) || null,
    learners_present: formData.get("learners_present")
      ? Number(formData.get("learners_present"))
      : null,
    lesson_focus: (formData.get("lesson_focus") as string) || null,
    filmed: formData.get("filmed") === "on",
  };

  const { error } =
    typeof observationId === "string" && observationId
      ? await supabase.from("observations").update(payload).eq("id", observationId)
      : await supabase.from("observations").insert({
          ...payload,
          course_id: trainee.course_id!,
          trainee_id: trainee.id,
        });

  if (error) {
    return { error: "Could not save. Try again." };
  }

  revalidatePath("/dashboard/trainee/celta5");
  return { error: null };
}

export interface ObservationTaskFormState {
  error: string | null;
}

// Submitting a directed observation task also creates a real `observations`
// row (date/length/level/filmed, same fields as the plain self-log) so the
// task-based path feeds the same 6-hour requirement through the same one
// computeObservationHours() function -- no second hour-tracking system.
export async function submitObservationTask(
  _prevState: ObservationTaskFormState,
  formData: FormData
): Promise<ObservationTaskFormState> {
  const trainee = await requireRole("trainee");

  const taskId = formData.get("task_id");
  const response = (formData.get("response") as string | null)?.trim();
  if (typeof taskId !== "string" || !taskId) return { error: "Missing task." };
  if (!response) return { error: "Write a response before submitting." };

  const observationDate = (formData.get("observation_date") as string) || null;
  const lengthMinutes = formData.get("length_minutes") ? Number(formData.get("length_minutes")) : null;
  const level = (formData.get("level") as string) || null;
  const learnersPresent = formData.get("learners_present") ? Number(formData.get("learners_present")) : null;
  const filmed = formData.get("filmed") === "on";

  const supabase = await createClient();

  const { data: observation, error: observationError } = await supabase
    .from("observations")
    .insert({
      course_id: trainee.course_id!,
      trainee_id: trainee.id,
      observation_date: observationDate,
      length_minutes: lengthMinutes,
      level,
      learners_present: learnersPresent,
      filmed,
    })
    .select("id")
    .single();

  if (observationError || !observation) {
    return { error: "Could not save. Try again." };
  }

  const { error: submissionError } = await supabase.from("observation_task_submissions").insert({
    task_id: taskId,
    trainee_id: trainee.id,
    observation_id: observation.id,
    response,
  });

  if (submissionError) {
    // Roll back the observation row -- otherwise a failed submission
    // (e.g. already submitted, unique constraint) would still silently
    // count toward the trainee's observation hours with no visible task
    // response attached to it.
    await supabase.from("observations").delete().eq("id", observation.id);
    return { error: "Could not submit -- you may have already submitted this task." };
  }

  revalidatePath("/portfolio", "layout");
  return { error: null };
}
