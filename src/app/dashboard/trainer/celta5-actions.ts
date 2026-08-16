"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { CELTA_CRITERIA_CODES } from "@/lib/celta-criteria";
import { PROVISIONAL_SLOTS } from "@/lib/provisional-grade";
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

  const validGrades = ["Pass", "Pass B", "Pass A", "Fail", "Withdrawn", "Extension", "Deferred"] as const;
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
  revalidatePath("/trainer/grades-report");
  return { error: null };
}

const PROVISIONAL_GRADES = ["Pass", "Pass B", "Pass A", "Fail", "Withdrawn"] as const;

// Only these 3 adjacent pairs are real "slashed, undecided" states --
// specs/README.md's own rule: "Provisional grades with a slash (Fail/Pass,
// Pass/Pass B, Pass B/Pass A) mean undecided." The old two-independent-
// selects form let a trainer save any of the 25 combinations (including
// nonsense like Fail/Pass A) -- this is a real correctness tightening, not
// just a restyle. `provisional_grade`/`provisional_grade_upper` stay the
// same two columns underneath; only the picker and its validation change.
const VALID_SLASH_PAIRS: [string, string][] = [
  ["Fail", "Pass"],
  ["Pass", "Pass B"],
  ["Pass B", "Pass A"],
];

// The real provisional grade, set by the trainer around Stage 2 (~TP6) --
// distinct from final_recommended_grade, which stays hidden from trainees
// (see 0034_hide_final_grade_from_trainee.sql). computeTrajectory() can
// suggest a starting point, but this is always the trainer's own call, same
// as every other rating in this app -- including whether to mark the
// candidate as "slashed" between two adjacent grades.
export async function updateProvisionalGrade(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRole("trainer");

  const traineeId = formData.get("trainee_id");
  const slot = formData.get("provisional_slot");
  if (typeof traineeId !== "string" || !traineeId) {
    return { error: "Something went wrong. Refresh and try again." };
  }
  if (typeof slot !== "string" || !(PROVISIONAL_SLOTS as readonly string[]).includes(slot)) {
    return { error: "Something went wrong. Refresh and try again." };
  }

  let grade: (typeof PROVISIONAL_GRADES)[number] | null = null;
  let upper: (typeof PROVISIONAL_GRADES)[number] | null = null;

  if (slot.includes("/")) {
    const [lower, higher] = slot.split("/");
    const isValidPair = VALID_SLASH_PAIRS.some(([l, h]) => l === lower && h === higher);
    if (!isValidPair) {
      return { error: "Not a real slashed pair -- only Fail/Pass, Pass/Pass B, and Pass B/Pass A mean undecided." };
    }
    grade = optionalRating(lower, PROVISIONAL_GRADES);
    upper = optionalRating(higher, PROVISIONAL_GRADES);
  } else {
    grade = optionalRating(slot, PROVISIONAL_GRADES);
  }

  const supabase = await createClient();
  const { error: provisionalError } = await supabase
    .from("celta5_records")
    .update({
      provisional_grade: grade,
      provisional_grade_upper: upper,
      provisional_set_at: grade ? new Date().toISOString() : null,
    })
    .eq("trainee_id", traineeId);

  if (provisionalError) {
    return { error: "Could not save. Try again." };
  }

  revalidatePath(`/dashboard/trainer/trainees/${traineeId}/celta5`);
  revalidatePath("/trainer/grades-report");
  return { error: null };
}

// The tutor's free-text "in order to deserve a higher grade, they need
// to..." working note (migration 0053) -- one condition per line, gated to
// release to the candidate only alongside the final report (same UI-layer
// gate as final_recommended_grade/overall_notes; celta5_records has no
// trainee-self SELECT policy at all).
export async function updateUpgradeConditions(
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
    .update({ provisional_upgrade_conditions: optionalString(formData.get("provisional_upgrade_conditions")) })
    .eq("trainee_id", traineeId);

  if (error) {
    return { error: "Could not save. Try again." };
  }

  revalidatePath(`/dashboard/trainer/trainees/${traineeId}/celta5`);
  revalidatePath("/trainer/grades-report");
  return { error: null };
}

// The "INFORMATION FOR THE CELTA GRADE REVIEW" box -- required when
// stage3_required is true, Cambridge/assessor-facing commentary, never
// shown to the trainee (same treatment as final_recommended_grade/
// overall_notes per migration 0034).
export async function updateGradeReviewComments(
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
    .update({ grade_review_tutor_comments: optionalString(formData.get("grade_review_tutor_comments")) })
    .eq("trainee_id", traineeId);

  if (error) {
    return { error: "Could not save. Try again." };
  }

  revalidatePath(`/dashboard/trainer/trainees/${traineeId}/celta5`);
  revalidatePath(`/portfolio/${traineeId}/celta5`);
  return { error: null };
}


/**
 * Administration Handbook 13.6: end-of-course reports must not be released
 * before the final day. Nothing enforced this -- both release paths set
 * final_report_released_at with no date check, so a whole cohort's reports
 * could go out on day one. Found by the 2026-08-16 compliance audit.
 *
 * A hard block rather than a warning, because releasing early cannot be undone
 * in a candidate's memory: the report is visible to them the moment it lands
 * (portfolio/[traineeId]/celta5), and un-setting the timestamp afterwards does
 * not unsee it.
 *
 * A course with no end date is also blocked -- if nobody has said when the
 * course ends, "the final day" has not arrived by definition, and guessing
 * would defeat the rule.
 */
async function finalDayBlock(
  supabase: Awaited<ReturnType<typeof createClient>>,
  courseId: string
): Promise<string | null> {
  const { data: course } = await supabase.from("courses").select("end_date, name").eq("id", courseId).maybeSingle();
  if (!course?.end_date) {
    return "This course has no end date set, so reports can't be released yet -- set the course dates first.";
  }
  const today = new Date().toISOString().slice(0, 10);
  if (today < course.end_date) {
    const finalDay = new Date(`${course.end_date}T00:00:00`).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
    });
    return `Reports can't be released before the final day of the course (${finalDay}) -- Administration Handbook 13.6.`;
  }
  return null;
}

// Cohort sheet's "Release final reports" -- the same release as
// releaseFinalReport above, just batched for everyone on the course who is
// actually ready (recommended grade set, not Withdrawn, trainer already
// signed off, not already released). Silently skips anyone not ready
// instead of erroring -- the point of a bulk action is releasing everyone
// who's genuinely done, not blocking the whole batch on stragglers.
export async function releaseAllFinalReports(_prevState: FormState, formData: FormData): Promise<FormState> {
  const trainer = await requireRole("trainer");
  const courseId = formData.get("course_id");
  if (typeof courseId !== "string" || !courseId || courseId !== trainer.course_id) {
    return { error: "Something went wrong. Refresh and try again." };
  }

  const supabase = await createClient();
  const blocked = await finalDayBlock(supabase, courseId);
  if (blocked) return { error: blocked };

  const { error } = await supabase
    .from("celta5_records")
    .update({ final_report_released_at: new Date().toISOString() })
    .eq("course_id", courseId)
    .not("final_recommended_grade", "is", null)
    .neq("final_recommended_grade", "Withdrawn")
    .neq("final_recommended_grade", "Extension")
    .neq("final_recommended_grade", "Deferred")
    .not("trainer_signoff_final_at", "is", null)
    .is("final_report_released_at", null);

  if (error) {
    return { error: "Could not save. Try again." };
  }

  revalidatePath("/trainer/grades-report");
  return { error: null };
}

// Releases the trainee's own copy of the Final Report (the certificate-
// style PDF) -- a deliberately separate, later action from finalizing the
// record. Ramy: trainees only ever see this "maybe a week after the
// course... never during the course," once Cambridge has actually
// confirmed things -- not the moment the trainer finalizes internally. No
// automated timer; a trainer/admin clicks this when it's genuinely time.
// Unrelated to the Grades Report (provisional/final grade), which stays
// trainer+assessor-only forever regardless of this.
export async function releaseFinalReport(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRole("trainer");

  const traineeId = formData.get("trainee_id");
  if (typeof traineeId !== "string" || !traineeId) {
    return { error: "Something went wrong. Refresh and try again." };
  }

  const supabase = await createClient();
  // Same gate as the bulk path -- releasing one candidate early breaches 13.6
  // exactly as much as releasing everyone.
  const { data: record } = await supabase
    .from("celta5_records")
    .select("course_id")
    .eq("trainee_id", traineeId)
    .maybeSingle();
  if (!record?.course_id) return { error: "Could not find that candidate's course." };
  const blocked = await finalDayBlock(supabase, record.course_id);
  if (blocked) return { error: blocked };

  const { error } = await supabase
    .from("celta5_records")
    .update({ final_report_released_at: new Date().toISOString() })
    .eq("trainee_id", traineeId)
    .not("trainer_signoff_final_at", "is", null);

  if (error) {
    return { error: "Could not save. Try again." };
  }

  revalidatePath(`/dashboard/trainer/trainees/${traineeId}/celta5`);
  revalidatePath(`/portfolio/${traineeId}/celta5`);
  return { error: null };
}
