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
