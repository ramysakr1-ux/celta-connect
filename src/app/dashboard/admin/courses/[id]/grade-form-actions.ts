"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCapabilityOrTrainer } from "@/lib/auth/require-capability";
import { holdsCentre } from "@/lib/branch-scope";
import { isMctOfCourse } from "@/lib/course-tutor-role";
import { logManagementAction } from "@/lib/activity-log";

// The two Appian forms the centre submits by hand around the assessment
// (migrations 0289, 0290).
//
// Administration Handbook 14.1: 2-3 days before the assessment the centre
// must "complete the centre grade form in Appian"; 15.2: the assessor's
// report form "can be accessed once the centre has submitted the grade
// form". 14.4, after the assessor's report: "The centre subsequently
// confirms the final recommended grades on the centre grade approval form."
// Both happen in Appian, where Connect cannot see, so -- like the entry
// form -- a person says it happened. Ramy, 12 Sep 2026: a shared tick, MCT
// or Course Admin, whoever does it first.
//
// Two people who can write one field is exactly the shared responsibility
// the management log exists for: the record says which of them did it.

interface AppianStep {
  atField: "grade_form_submitted_at" | "grade_approval_form_submitted_at";
  byField: "grade_form_submitted_by" | "grade_approval_form_submitted_by";
  logKey: "grade_form" | "grade_approval_form";
}

async function markAppianStep(formData: FormData, step: AppianStep): Promise<void> {
  const actor = await requireCapabilityOrTrainer("courseAdmin.invite");
  const courseId = formData.get("course_id");
  const ticked = Boolean((formData.get(step.atField) as string | null) || null);
  if (typeof courseId !== "string") return;

  const supabase = await createClient();
  const { data: courseRaw } = await supabase.from("courses").select("*").eq("id", courseId).maybeSingle();
  const course = courseRaw as ({ id: string; center_id: string } & Record<string, unknown>) | null;
  if (!course) return;

  // Course Admin holds the centre; a trainer must be this course's main
  // course tutor. isMctOfCourse reads course_tutors, the live source.
  const allowed =
    actor.role === "trainer" ? await isMctOfCourse(actor, courseId) : await holdsCentre(actor, course.center_id);
  if (!allowed) return;

  // The tick means "now", the instant the person confirmed it, not a date
  // they typed; clearing it clears both columns.
  const previous = (course[step.atField] as string | null | undefined) ?? null;
  const next = ticked ? new Date().toISOString() : null;

  // Through the RLS client, not the admin one: the MCT already updates the
  // course row this way (updateAssessorContact) and Course Admin does for the
  // entry form -- and on the shared demo the write-block trigger only bites
  // writes made as the signed-in user. An admin-client write here would let
  // any demo visitor mark the demo's forms submitted, for keeps.
  const { error } = await supabase
    .from("courses")
    .update({ [step.atField]: next, [step.byField]: next ? actor.id : null } as never)
    .eq("id", courseId);
  if (error) {
    console.error(`[dashboard/admin/courses/[id]/grade-form-actions.ts:${step.logKey}]`, error);
    return;
  }

  const asDate = (v: string | null) => (v ? v.slice(0, 10) : null);
  if (asDate(previous) !== asDate(next)) {
    await logManagementAction({
      centerId: course.center_id,
      actorId: actor.id,
      courseId,
      action: next ? `${step.logKey}.marked_submitted` : `${step.logKey}.cleared`,
      targetTable: "courses",
      targetId: courseId,
      previousValue: asDate(previous),
      newValue: asDate(next),
    });
  }

  revalidatePath(`/dashboard/admin/courses/${courseId}`);
  revalidatePath("/trainer/grades-report");
  revalidatePath("/trainer/assessor");
  revalidatePath("/trainer");
  revalidatePath("/assessor");
}

/** The Centre Grade form, with the provisionals, 2-3 days before the visit (14.1). */
export async function markGradeFormSubmitted(formData: FormData): Promise<void> {
  await markAppianStep(formData, {
    atField: "grade_form_submitted_at",
    byField: "grade_form_submitted_by",
    logKey: "grade_form",
  });
}

/** The centre grade approval form, confirming the finals after the assessor's report (14.4). */
export async function markGradeApprovalFormSubmitted(formData: FormData): Promise<void> {
  await markAppianStep(formData, {
    atField: "grade_approval_form_submitted_at",
    byField: "grade_approval_form_submitted_by",
    logKey: "grade_approval_form",
  });
}

// ---------------------------------------------------------------------------
// The course-level half of the Centre Grade Form (migration 0313).
//
// Read off the live form in Appian against TR073-C17/2026 on 25 Sep 2026: it
// opens with four required free-text fields about the course itself, before it
// reaches a single candidate. They belong to the course, so one person writing
// them writes them for everyone -- which is why this goes through the same
// MCT-or-holds-the-centre gate as the submission ticks above, and leaves the
// same footprint in the management log.

const COURSE_GRADE_FIELDS = {
  grade_form_teaching_practice: "Teaching Practice",
  grade_form_tp_supervision: "Teaching Practice Supervision and Feedback",
  grade_form_tutorials: "Tutorials",
  grade_form_additional_comments: "Additional Comments",
} as const;

export type CourseGradeField = keyof typeof COURSE_GRADE_FIELDS;

// Cambridge's own limit on each of the four, stated on the form itself.
const FIELD_LIMIT = 2000;

export async function updateCourseGradeFormField(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const actor = await requireCapabilityOrTrainer("courseAdmin.invite");
  const courseId = formData.get("course_id");
  const field = formData.get("field");
  const value = formData.get("value");
  if (typeof courseId !== "string" || !courseId) return { error: "Something went wrong. Refresh and try again." };
  if (typeof field !== "string" || !(field in COURSE_GRADE_FIELDS)) {
    return { error: "Something went wrong. Refresh and try again." };
  }
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length > FIELD_LIMIT) {
    return { error: `Cambridge allows ${FIELD_LIMIT} characters here; that is ${text.length}.` };
  }

  const supabase = await createClient();
  const { data: courseRaw } = await supabase.from("courses").select("*").eq("id", courseId).maybeSingle();
  const course = courseRaw as ({ id: string; center_id: string } & Record<string, unknown>) | null;
  if (!course) return { error: "Something went wrong. Refresh and try again." };

  const allowed =
    actor.role === "trainer" ? await isMctOfCourse(actor, courseId) : await holdsCentre(actor, course.center_id);
  if (!allowed) return { error: "You cannot edit the grade form for this course." };

  const previous = (course[field] as string | null | undefined) ?? null;
  const next = text || null;
  if (previous === next) return { error: null };

  const { error } = await supabase
    .from("courses")
    .update({ [field]: next } as never)
    .eq("id", courseId);

  if (error) {
    console.error("[dashboard/admin/courses/[id]/grade-form-actions.ts:updateCourseGradeFormField]", error);
    return { error: "Could not save. Try again." };
  }

  await logManagementAction({
    actorId: actor.id,
    centerId: course.center_id,
    courseId,
    action: "grade_form.course_field",
    targetTable: "courses",
    targetId: courseId,
    previousValue: previous,
    newValue: next,
    detail: { field: COURSE_GRADE_FIELDS[field as CourseGradeField] },
  });

  revalidatePath("/trainer/grades-report");
  revalidatePath(`/dashboard/admin/courses/${courseId}`);
  return { error: null };
}
