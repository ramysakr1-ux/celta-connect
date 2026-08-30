"use server";

import { revalidatePath } from "next/cache";
import { CELTA_CRITERIA_CODES } from "@/lib/celta-criteria";

const VALID_LISTS = new Set(["planningStrengths", "planningActionPoints", "teachingStrengths", "teachingActionPoints"]);
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { PROVISIONAL_SLOTS } from "@/lib/provisional-grade";
import { isMctOnCourse } from "@/lib/course-mct";
import { checkStage1RecordsMilestone, checkFinalGradeMilestone } from "@/lib/cohort-milestones";
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
  // migration 0249 -- the remaining columns CELTA 5 p.9 prints. The tutor
  // signature is stamped with its own timestamp rather than leaning on
  // created_at: a row can be logged first and signed later, and the date
  // beside a signature is the evidence, so it has to be the date of the
  // signature and not of the row.
  const tutorSignature = optionalString(formData.get("tutor_signature_name"));
  const { error } = await supabase.from("attendance_absences").insert({
    course_id: trainer.course_id!,
    trainee_id: traineeId,
    category,
    session_date: optionalString(formData.get("session_date")),
    session_missed: optionalString(formData.get("session_missed")),
    reason: optionalString(formData.get("reason")),
    work_made_up: optionalString(formData.get("work_made_up")),
    candidate_comment: optionalString(formData.get("candidate_comment")),
    tutor_comment: optionalString(formData.get("tutor_comment")),
    tutor_signature_name: tutorSignature,
    tutor_signed_at: tutorSignature ? new Date().toISOString() : null,
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
  const trainer = await requireRole("trainer");

  const traineeId = formData.get("trainee_id");
  if (typeof traineeId !== "string" || !traineeId) {
    return { error: "Something went wrong. Refresh and try again." };
  }

  const completed = formData.get("stage1_completed") === "on";
  if (completed && !trainer.signature_name) {
    return { error: "Set your signature first (below) before marking this complete." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("celta5_records")
    .update({
      stage1_tutorial_given: formData.get("stage1_tutorial_given") === "on",
      stage1_hours_taught: optionalNumber(formData.get("stage1_hours_taught")),
      stage1_strengths: optionalString(formData.get("stage1_strengths")),
      stage1_action_plan: optionalString(formData.get("stage1_action_plan")),
      stage1_completed_at: completed ? new Date().toISOString() : null,
      stage1_tutor_signature_name: completed ? trainer.signature_name : null,
    })
    .eq("trainee_id", traineeId);

  if (error) {
    return { error: "Could not save. Try again." };
  }

  if (completed && trainer.course_id) await checkStage1RecordsMilestone(supabase, trainer.course_id, trainer.id);

  revalidatePath(`/dashboard/trainer/trainees/${traineeId}/celta5`);
  return { error: null };
}

// Ramy, 29 Aug 2026: "the trainee sees nothing until the tutor hits Release
// to trainee; before that they get a 'not yet released' state. Tutor can
// also un-release."
//
// Separate from updateStage1 on purpose. Saving the report and publishing
// it to the candidate are two decisions, and merging them is exactly the
// bug this fixes -- stage1_completed_at used to mean both, so finishing the
// report published it in the same click.
//
// Re-releasing clears the candidate's signature. That is the mechanism, not
// a side effect: a signature attests to specific text, so text that changes
// needs signing again. Enforced by a trigger in migration 0246 as well, so
// it holds whichever code path moves the release date.
export async function setStage1Release(_prevState: FormState, formData: FormData): Promise<FormState> {
  const trainer = await requireRole("trainer");

  const traineeId = formData.get("trainee_id");
  const release = formData.get("release") === "on";
  if (typeof traineeId !== "string" || !traineeId) {
    return { error: "Something went wrong. Refresh and try again." };
  }

  const supabase = await createClient();
  const { data: record } = await supabase
    .from("celta5_records")
    .select("stage1_completed_at, stage1_candidate_signed_at")
    .eq("trainee_id", traineeId)
    .maybeSingle();
  if (!record) return { error: "Could not find that record." };
  if (release && !record.stage1_completed_at) {
    return { error: "Finish and sign Stage One before releasing it." };
  }

  const { error } = await supabase
    .from("celta5_records")
    .update({ stage1_released_at: release ? new Date().toISOString() : null })
    .eq("trainee_id", traineeId);
  if (error) return { error: "Could not save. Try again." };

  revalidatePath(`/dashboard/trainer/trainees/${traineeId}/celta5`);
  revalidatePath(`/portfolio/${traineeId}/celta5`);
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
  const trainer = await requireRole("trainer");

  const traineeId = formData.get("trainee_id");
  if (typeof traineeId !== "string" || !traineeId) {
    return { error: "Something went wrong. Refresh and try again." };
  }

  const completed = formData.get("stage2_completed") === "on";
  if (completed && !trainer.signature_name) {
    return { error: "Set your signature first (below) before marking this complete." };
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
      stage2_completed_at: completed ? new Date().toISOString() : null,
      stage2_tutor_signature_name: completed ? trainer.signature_name : null,
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
  const trainer = await requireRole("trainer");

  const traineeId = formData.get("trainee_id");
  if (typeof traineeId !== "string" || !traineeId) {
    return { error: "Something went wrong. Refresh and try again." };
  }

  const finalized = formData.get("stage3_finalized") === "on";
  if (finalized && !trainer.signature_name) {
    return { error: "Set your signature first (below) before marking this complete." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("celta5_records")
    .update({
      stage3_tutorial_required: formData.get("stage3_tutorial_required") === "on",
      stage3_tutorial_given: formData.get("stage3_tutorial_given") === "on",
      stage3_hours_taught: optionalNumber(formData.get("stage3_hours_taught")),
      stage3_tutor_overall: optionalRating(formData.get("stage3_tutor_overall"), STANDARD_RATINGS),
      stage3_tutor_notes: optionalString(formData.get("stage3_tutor_notes")),
      stage3_tutor_written_assignments_notes: optionalString(
        formData.get("stage3_tutor_written_assignments_notes")
      ),
      stage3_tutor_other_notes: optionalString(formData.get("stage3_tutor_other_notes")),
      stage3_finalized_at: finalized ? new Date().toISOString() : null,
      stage3_tutor_signature_name: finalized ? trainer.signature_name : null,
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
  const trainer = await requireRole("trainer");

  const traineeId = formData.get("trainee_id");
  if (typeof traineeId !== "string" || !traineeId) {
    return { error: "Something went wrong. Refresh and try again." };
  }

  const finalized = formData.get("finalized") === "on";
  if (finalized && !trainer.signature_name) {
    return { error: "Set your signature first (below) before finalizing." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("celta5_records")
    .update({
      trainer_signoff_final_at: finalized ? new Date().toISOString() : null,
      final_tutor_signature_name: finalized ? trainer.signature_name : null,
    })
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
  const trainer = await requireRole("trainer");

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

  if (grade && trainer.course_id) await checkFinalGradeMilestone(supabase, trainer.course_id, trainer.id);

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
  const trainer = await requireRole("trainer");

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
      provisional_proposed_by: grade ? trainer.id : null,
      // Editing un-approves rather than locking -- see migration 0127.
      provisional_approved_at: null,
      provisional_approved_by: null,
    })
    .eq("trainee_id", traineeId);

  if (provisionalError) {
    return { error: "Could not save. Try again." };
  }

  revalidatePath(`/dashboard/trainer/trainees/${traineeId}/celta5`);
  revalidatePath("/trainer/grades-report");
  return { error: null };
}

// MCT-only. "Each TP tutor proposes for their own group; the MCT approves
// all of them before anything is sent" -- proposing stays open to any
// trainer (unchanged above), but approval is the one action gated to the
// single MCT on the course.
export async function approveProvisionalGrade(formData: FormData): Promise<FormState> {
  const trainer = await requireRole("trainer");
  if (!trainer.course_id) return { error: "No course assigned." };

  const traineeId = formData.get("trainee_id");
  if (typeof traineeId !== "string" || !traineeId) {
    return { error: "Something went wrong. Refresh and try again." };
  }

  const supabase = await createClient();
  if (!(await isMctOnCourse(supabase, trainer.course_id, trainer.id))) {
    return { error: "Only the Main Course Tutor can approve provisional grades." };
  }

  const { data: record } = await supabase
    .from("celta5_records")
    .select("provisional_grade")
    .eq("trainee_id", traineeId)
    .maybeSingle();
  if (!record?.provisional_grade) {
    return { error: "Set a provisional grade before approving it." };
  }

  const { error } = await supabase
    .from("celta5_records")
    .update({ provisional_approved_at: new Date().toISOString(), provisional_approved_by: trainer.id })
    .eq("trainee_id", traineeId);
  if (error) return { error: "Could not approve. Try again." };

  revalidatePath("/trainer/grades-report");
  return { error: null };
}

// MCT-only, course-wide -- one deadline for the whole cohort, set from the
// actual timetable rather than computed from the assessor visit date. See
// migration 0127.
export async function setProvisionalGradesDueDate(_prevState: FormState, formData: FormData): Promise<FormState> {
  const trainer = await requireRole("trainer");
  if (!trainer.course_id) return { error: "No course assigned." };

  const dueDate = formData.get("due_date");
  if (typeof dueDate !== "string") return { error: "Something went wrong. Refresh and try again." };

  const supabase = await createClient();
  if (!(await isMctOnCourse(supabase, trainer.course_id, trainer.id))) {
    return { error: "Only the Main Course Tutor can set this deadline." };
  }

  const { error } = await supabase
    .from("courses")
    .update({ provisional_grades_due_at: dueDate ? new Date(`${dueDate}T23:59:59`).toISOString() : null })
    .eq("id", trainer.course_id);
  if (error) return { error: "Could not save. Try again." };

  revalidatePath("/trainer/grades-report");
  revalidatePath("/trainer");
  return { error: null };
}

// Grade Pipeline handoff, "Decided": Stage 2/3 (not Stage 1, which is
// fixed) can be moved earlier by the MCT with a required reason, "if
// there's a standing concern before the standard checkpoint... Not
// available once a stage has already been given."
export async function moveStage2Earlier(_prevState: FormState, formData: FormData): Promise<FormState> {
  const trainer = await requireRole("trainer");
  if (!trainer.course_id) return { error: "No course assigned." };

  const traineeId = formData.get("trainee_id");
  const reason = formData.get("reason");
  if (typeof traineeId !== "string" || !traineeId) return { error: "Something went wrong. Refresh and try again." };
  if (typeof reason !== "string" || !reason.trim()) return { error: "A reason is required." };

  const supabase = await createClient();
  if (!(await isMctOnCourse(supabase, trainer.course_id, trainer.id))) {
    return { error: "Only the Main Course Tutor can move a stage earlier." };
  }

  const { data: record } = await supabase
    .from("celta5_records")
    .select("stage2_completed_at")
    .eq("trainee_id", traineeId)
    .maybeSingle();
  if (record?.stage2_completed_at) return { error: "Stage 2 has already been given." };

  const { error } = await supabase
    .from("celta5_records")
    .update({ stage2_moved_earlier_at: new Date().toISOString(), stage2_moved_earlier_reason: reason.trim(), stage2_moved_earlier_by: trainer.id })
    .eq("trainee_id", traineeId);
  if (error) return { error: "Could not save. Try again." };

  revalidatePath("/trainer/roster");
  return { error: null };
}

export async function moveStage3Earlier(_prevState: FormState, formData: FormData): Promise<FormState> {
  const trainer = await requireRole("trainer");
  if (!trainer.course_id) return { error: "No course assigned." };

  const traineeId = formData.get("trainee_id");
  const reason = formData.get("reason");
  if (typeof traineeId !== "string" || !traineeId) return { error: "Something went wrong. Refresh and try again." };
  if (typeof reason !== "string" || !reason.trim()) return { error: "A reason is required." };

  const supabase = await createClient();
  if (!(await isMctOnCourse(supabase, trainer.course_id, trainer.id))) {
    return { error: "Only the Main Course Tutor can move a stage earlier." };
  }

  const { data: record } = await supabase
    .from("celta5_records")
    .select("stage3_finalized_at")
    .eq("trainee_id", traineeId)
    .maybeSingle();
  if (record?.stage3_finalized_at) return { error: "Stage 3 has already been given." };

  const { error } = await supabase
    .from("celta5_records")
    .update({ stage3_moved_earlier_at: new Date().toISOString(), stage3_moved_earlier_reason: reason.trim(), stage3_moved_earlier_by: trainer.id })
    .eq("trainee_id", traineeId);
  if (error) return { error: "Could not save. Try again." };

  revalidatePath("/trainer/roster");
  return { error: null };
}

// The tutor's free-text "in order to achieve a pass or a higher grade, they need
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

// The two fields the assessor actually submits, written by the tutor.
//
// Handbook 14.4: "The course tutor must contact the assessor to confirm the
// final recommended grade for each candidate, providing an update on
// strengths and areas for development for each candidate and a rationale for
// each final grade." The assessor then types them into their Appian report.
//
// 15.2 on the first of them: "This is a required field in the form and must
// be completed for all candidates including those being granted an extension
// or deferral or any withdrawn candidates." On the second: "optional but
// should be completed for any candidates that were borderline (e.g.,
// Pass/Fail, Pass/Pass B) so there is a justification recorded for the final
// recommended grade."
//
// Same visibility treatment as the rest of the final report -- gated at the
// UI layer, since celta5_records has no trainee-self SELECT policy.
export async function updateFinalReportFields(
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
      final_update_notes: optionalString(formData.get("final_update_notes")),
      final_higher_grade_evidence: optionalString(formData.get("final_higher_grade_evidence")),
      overall_notes: optionalString(formData.get("overall_notes")),
    } as never)
    .eq("trainee_id", traineeId);

  if (error) {
    return { error: "Could not save. Try again." };
  }

  revalidatePath(`/dashboard/trainer/trainees/${traineeId}/celta5`);
  revalidatePath("/trainer/grades-report");
  return { error: null };
}

// The "INFORMATION FOR THE CELTA GRADE REVIEW" box -- required when
// stage3_tutorial_required is true, Cambridge/assessor-facing commentary, never
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
 * Administration Handbook 2022 s13.4 / June 2025 s14.4: end-of-course reports
 * must not be released before the final day. Nothing enforced this -- both
 * release paths set
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
    return `Reports can't be released before the final day of the course (${finalDay}) -- Administration Handbook s13.4 (2022) / s14.4 (June 2025).`;
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
  // Same gate as the bulk path -- releasing one candidate early breaches
  // s13.4/s14.4 exactly as much as releasing everyone.
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

// The tutor's curation of the four Grades Report lists. Ramy, 30 Aug 2026:
// the lists are the S+ and N ratings "in a way, or the weak S's" -- and there
// is no weak-S rating, so raising a borderline S is a judgement only a tutor
// can make.
//
// Codes only. The wording is always looked up from CRITERIA_LABELS when the
// line is rendered, so nothing stored here can introduce a variant phrasing.
// A removal is remembered against the code and survives a later change to
// that criterion's rating: taking a line out is a decision about this report,
// and silently reinstating it would undo the tutor's work without telling
// them.
export async function setGradesReportListOverride(formData: FormData): Promise<void> {
  const trainer = await requireRole(["trainer", "admin"]);
  const traineeId = formData.get("trainee_id");
  const list = formData.get("list");
  const code = formData.get("code");
  const op = formData.get("op");
  if (typeof traineeId !== "string" || typeof list !== "string" || typeof code !== "string") return;
  if (op !== "add" && op !== "remove") return;
  if (!VALID_LISTS.has(list)) return;
  if (!CELTA_CRITERIA_CODES.includes(code)) return;

  const supabase = await createClient();
  const { data: trainee } = await supabase.from("profiles").select("course_id").eq("id", traineeId).maybeSingle();
  if (!trainee || trainee.course_id !== trainer.course_id) return;

  const { data: record } = await supabase
    .from("celta5_records")
    .select("grades_report_list_overrides")
    .eq("trainee_id", traineeId)
    .maybeSingle();

  const overrides = ((record as { grades_report_list_overrides?: unknown } | null)?.grades_report_list_overrides ??
    {}) as Record<string, { add?: string[]; remove?: string[] }>;
  const entry = { add: [], remove: [], ...(overrides[list] ?? {}) };

  // Adding cancels a previous removal and vice versa, so a tutor can change
  // their mind without the two lists fighting each other.
  if (op === "add") {
    entry.remove = (entry.remove ?? []).filter((c) => c !== code);
    if (!(entry.add ?? []).includes(code)) entry.add = [...(entry.add ?? []), code];
  } else {
    entry.add = (entry.add ?? []).filter((c) => c !== code);
    if (!(entry.remove ?? []).includes(code)) entry.remove = [...(entry.remove ?? []), code];
  }

  await supabase
    .from("celta5_records")
    .update({ grades_report_list_overrides: { ...overrides, [list]: entry } } as never)
    .eq("trainee_id", traineeId);

  revalidatePath("/trainer/grades-report");
}
