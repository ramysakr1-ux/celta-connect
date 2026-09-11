"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCapabilityOrTrainer } from "@/lib/auth/require-capability";
import { holdsCentre } from "@/lib/branch-scope";
import { isMctOfCourse } from "@/lib/course-tutor-role";
import { logManagementAction } from "@/lib/activity-log";

// The Centre Grade form, submitted in Appian (migration 0289).
//
// Administration Handbook 14.1: 2-3 days before the assessment the centre
// must "complete the centre grade form in Appian"; 15.2: the assessor's
// report form "can be accessed once the centre has submitted the grade
// form". It happens in Appian, where Connect cannot see, so -- like the
// entry form -- a person says it happened. Ramy, 12 Sep 2026: a shared
// tick, MCT or Course Admin, whoever does it first.
//
// Two people who can write one field is exactly the shared responsibility
// the management log exists for: the record says which of them did it.
export async function markGradeFormSubmitted(formData: FormData): Promise<void> {
  const actor = await requireCapabilityOrTrainer("courseAdmin.invite");
  const courseId = formData.get("course_id");
  const ticked = Boolean((formData.get("grade_form_submitted_at") as string | null) || null);
  if (typeof courseId !== "string") return;

  const supabase = await createClient();
  const { data: courseRaw } = await supabase.from("courses").select("*").eq("id", courseId).maybeSingle();
  const course = courseRaw as ({ id: string; center_id: string; grade_form_submitted_at?: string | null } & Record<string, unknown>) | null;
  if (!course) return;

  // Course Admin holds the centre; a trainer must be this course's main
  // course tutor. isMctOfCourse reads course_tutors, the live source.
  const allowed =
    actor.role === "trainer" ? await isMctOfCourse(actor, courseId) : await holdsCentre(actor, course.center_id);
  if (!allowed) return;

  // The tick means "now", the instant the person confirmed it, not a date
  // they typed; clearing it clears both columns.
  const previous = course.grade_form_submitted_at ?? null;
  const next = ticked ? new Date().toISOString() : null;

  // Through the RLS client, not the admin one: the MCT already updates the
  // course row this way (updateAssessorContact) and Course Admin does for the
  // entry form -- and on the shared demo the write-block trigger only bites
  // writes made as the signed-in user. An admin-client write here would have
  // let any demo visitor mark the demo's grade form submitted, for keeps.
  const { error } = await supabase
    .from("courses")
    .update({ grade_form_submitted_at: next, grade_form_submitted_by: next ? actor.id : null } as never)
    .eq("id", courseId);
  if (error) {
    console.error("[dashboard/admin/courses/[id]/grade-form-actions.ts:markGradeFormSubmitted]", error);
    return;
  }

  const asDate = (v: string | null) => (v ? v.slice(0, 10) : null);
  if (asDate(previous) !== asDate(next)) {
    await logManagementAction({
      centerId: course.center_id,
      actorId: actor.id,
      courseId,
      action: next ? "grade_form.marked_submitted" : "grade_form.cleared",
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
