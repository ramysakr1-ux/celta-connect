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
