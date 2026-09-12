"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import type { FeedbackPoint } from "@/lib/tp-plan-content";
import type { StandardRating } from "@/lib/supabase/types";
import { recordAssessedLesson } from "@/lib/assessed-lesson-record";
import { ensureStage3Flag } from "@/lib/stage3-status";
import { checkTaughtMilestones } from "@/lib/cohort-milestones";

export interface FormState {
  error: string | null;
}

function optionalString(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" && value ? value : null;
}

function parseJsonField<T>(formData: FormData, key: string, fallback: T): T {
  const raw = formData.get(key);
  if (typeof raw !== "string" || !raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function saveFeedback(formData: FormData, lock: boolean): Promise<FormState> {
  const trainer = await requireRole("trainer");
  const planId = formData.get("plan_id");
  const traineeId = formData.get("trainee_id");
  const tpNumber = Number(formData.get("tp_number"));
  if (typeof planId !== "string" || typeof traineeId !== "string" || !Number.isInteger(tpNumber)) {
    return { error: "Invalid request." };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("tp_feedback")
    .select("id")
    .eq("tp_plan_id", planId)
    .maybeSingle();

  const grade = optionalString(formData.get("grade")) as StandardRating | null;
  // Handbook 10.2: the summary of a feedback sheet "should include an
  // unambiguous comment on the overall standard of the lesson". The grade is
  // that comment, in the CELTA 5's own three words -- a sheet can be drafted
  // without one, but not released.
  if (lock && !grade) {
    return { error: "Say which standard the lesson reached before releasing -- Cambridge asks for an unambiguous comment on the overall standard of every lesson (Handbook 10.2)." };
  }
  const fields = {
    trainer_id: trainer.id,
    grade,
    strengths_planning: parseJsonField<FeedbackPoint[]>(formData, "strengths_planning", []),
    action_points_planning: parseJsonField<FeedbackPoint[]>(formData, "action_points_planning", []),
    strengths_teaching: parseJsonField<FeedbackPoint[]>(formData, "strengths_teaching", []),
    action_points_teaching: parseJsonField<FeedbackPoint[]>(formData, "action_points_teaching", []),
    overall_comment: optionalString(formData.get("overall_comment")),
    self_eval_comment: optionalString(formData.get("self_eval_comment")),
    ...(lock ? { submitted_at: new Date().toISOString() } : {}),
  };

  const { error } = existing
    ? await supabase.from("tp_feedback").update(fields).eq("id", existing.id)
    : await supabase.from("tp_feedback").insert({
        tp_plan_id: planId,
        trainee_id: traineeId,
        tp_number: tpNumber,
        ...fields,
      });

  if (error) {
    // The message below is what the person reads; this is what we read.
    console.error("[dashboard/trainer/trainees/[id]/tp/[tpNumber]:action]", error);
    return { error: "Could not save the feedback. Try again." };
}

  // Released feedback fills the candidate's CELTA 5 record of assessed
  // teaching practice -- see assessed-lesson-record.ts.
  if (lock && trainer.course_id) {
    await recordAssessedLesson(supabase, {
      courseId: trainer.course_id,
      traineeId,
      tpNumber,
      planId,
      trainerId: trainer.id,
      grade,
      overallComment: fields.overall_comment,
    });
    // Releasing the feedback IS logging the outcome, so it is what marks the
    // lesson taught. createTpLesson (the separate CELTA 5 record form) has
    // always done this, with the right reason in its own comment -- "one
    // action for the trainer, not a separate Mark taught click" -- but the
    // feedback path never did, and that is the path a tutor actually uses.
    //
    // Walked as a tutor on 12 Sep 2026: the feedback went out, the CELTA 5
    // record was written, and plan_assignments.taught_at stayed null. So the
    // lesson counted as untaught everywhere it matters -- the candidate's
    // self-evaluation stayed locked behind "unlocks once your trainer has
    // logged this lesson as taught", the assessed hours did not move, and the
    // roster still showed the round outstanding.
    //
    // Idempotent, like the other two call sites: a lesson already marked
    // taught is left alone.
    const { data: newlyTaught } = await supabase
      .from("plan_assignments")
      .update({ taught_at: new Date().toISOString() })
      .eq("trainee_id", traineeId)
      .eq("tp_number", tpNumber)
      .is("taught_at", null)
      .select("id");
    if ((newlyTaught ?? []).length > 0) {
      await checkTaughtMilestones(supabase, trainer.course_id, trainer.id, tpNumber);
    }
    // A released grade after Stage 2 can be the Handbook's "not making the
    // expected progress" -- the flag the roster reads is set here, not left
    // to a tutor remembering a checkbox.
    await ensureStage3Flag(supabase, traineeId);
    revalidatePath(`/dashboard/trainer/trainees/${traineeId}/celta5`);
    revalidatePath(`/trainer/roster`);
    revalidatePath(`/portfolio/${traineeId}/tp/${tpNumber}`);
  }
  revalidatePath(`/dashboard/trainer/trainees/${traineeId}/tp/${tpNumber}`);
  return { error: null };
}

export async function saveFeedbackDraft(_prevState: FormState, formData: FormData): Promise<FormState> {
  return saveFeedback(formData, false);
}

export async function submitFeedback(_prevState: FormState, formData: FormData): Promise<FormState> {
  return saveFeedback(formData, true);
}
