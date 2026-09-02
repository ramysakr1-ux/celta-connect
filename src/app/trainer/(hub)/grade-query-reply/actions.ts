"use server";

// build-spec.md "Grade query -- the reply before an appeal". Three trainer
// actions, each an explicit step -- nothing here auto-happens:
// 1. generateGradeQueryReply -- assembles the live evidence into a frozen
//    snapshot and inserts a new (unfiled) draft row.
// 2. updateGradeQueryReplyDraft -- saves the two tutor-authored paragraphs
//    on a still-unfiled draft.
// 3. fileGradeQueryReply -- the "sign and release" action. Requires both
//    paragraphs to be non-empty (the honest sentences a tutor writes
//    themselves), then sets filed_at/filed_by. Never sent to the candidate
//    by the app itself -- filing only marks it as the record of what was
//    sent, the same "generated but never sent automatically" rule the spec
//    states explicitly.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { assembleGradeQueryEvidence } from "@/lib/grade-query-reply";

export interface FormState {
  error: string | null;
}

function optionalString(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export async function generateGradeQueryReply(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const trainer = await requireRole(["trainer", "admin"]);

  const traineeId = formData.get("trainee_id");
  if (typeof traineeId !== "string" || !traineeId) {
    return { error: "Something went wrong. Refresh and try again." };
  }

  const courseId = trainer.course_id;
  if (!courseId) {
    return { error: "No course assigned to your account." };
  }

  const supabase = await createClient();

  const { data: trainee } = await supabase
    .from("profiles")
    .select("id, course_id, role")
    .eq("id", traineeId)
    .maybeSingle();

  if (!trainee || trainee.course_id !== courseId || trainee.role !== "trainee") {
    return { error: "Could not find that candidate on your course." };
  }

  const [
    { data: course },
    { data: record },
    { data: matrixRows },
    { data: taughtPlans },
    { data: tpFeedbackRows },
    { data: assignments },
  ] = await Promise.all([
    supabase.from("courses").select("total_hours").eq("id", courseId).maybeSingle(),
    supabase.from("celta5_records").select("*").eq("trainee_id", traineeId).maybeSingle(),
    supabase
      .from("celta5_matrix")
      .select("criteria_code, tutor_status_stage2, tutor_status_stage3")
      .eq("trainee_id", traineeId),
    // Real "taught" signal is plan_assignments.taught_at -- tp_lessons is
    // the dead pre-rebuild table (see project memory), never populated by
    // the live app.
    supabase
      .from("plan_assignments")
      .select("tp_number, taught_at")
      .eq("trainee_id", traineeId)
      .not("taught_at", "is", null),
    supabase.from("tp_feedback").select("tp_number, grade, submitted_at").eq("trainee_id", traineeId),
    supabase
      .from("assignments")
      .select("assignment_type, first_status, first_submitted_at, resubmission_status, resubmission_submitted_at, final_grade")
      .eq("trainee_id", traineeId),
  ]);

  // assembleGradeQueryEvidence's grade ladder only knows the four gradeable
  // rungs (Fail/Pass/Pass B/Pass A) -- Withdrawn was already outside that,
  // and Extension (added later) is too, so both narrow to null here rather
  // than the ladder needing to understand "not actually a grade" states.
  const asLadderGrade = (g: string | null): "Fail" | "Pass" | "Pass B" | "Pass A" | null =>
    g === "Fail" || g === "Pass" || g === "Pass B" || g === "Pass A" ? g : null;

  const evidence = assembleGradeQueryEvidence({
    courseTotalHours: course?.total_hours ?? 120,
    celta5Record: record
      ? {
          ...record,
          provisional_grade: asLadderGrade(record.provisional_grade),
          provisional_grade_upper: asLadderGrade(record.provisional_grade_upper),
          final_recommended_grade: asLadderGrade(record.final_recommended_grade),
        }
      : null,
    matrixRows: matrixRows ?? [],
    taughtPlanAssignments: taughtPlans ?? [],
    tpFeedbackRows: tpFeedbackRows ?? [],
    assignments: assignments ?? [],
  });

  const { data: inserted, error } = await supabase
    .from("grade_query_replies")
    .insert({
      course_id: courseId,
      trainee_id: traineeId,
      generated_by: trainer.id,
      evidence_snapshot: evidence,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { error: "Could not generate the reply. Try again." };
  }

  revalidatePath(`/trainer/grade-query-reply/${traineeId}`);
  redirect(`/trainer/grade-query-reply/${traineeId}/${inserted.id}`);
}

export async function updateGradeQueryReplyDraft(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const trainer = await requireRole(["trainer", "admin"]);

  const replyId = formData.get("reply_id");
  const traineeId = formData.get("trainee_id");
  if (typeof replyId !== "string" || !replyId || typeof traineeId !== "string" || !traineeId) {
    return { error: "Something went wrong. Refresh and try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("grade_query_replies")
    .update({
      what_would_have_made_the_difference: optionalString(formData.get("what_would_have_made_the_difference")),
      what_happens_next: optionalString(formData.get("what_happens_next")),
    })
    .eq("id", replyId)
    .eq("course_id", trainer.course_id ?? "")
    .is("filed_at", null); // drafts only -- a filed reply is a signed record, not editable (also guarded in the UI, which stops rendering this form once filed_at is set)

  if (error) {
    // The message below is what the person reads; this is what we read.
    console.error("[trainer/(hub)/grade-query-reply:updateGradeQueryReplyDraft]", error);
    return { error: "Could not save. Try again." };
}

  revalidatePath(`/trainer/grade-query-reply/${traineeId}/${replyId}`);
  return { error: null };
}

const FILE_VALIDATION_ERROR =
  'Write both "what would have made the difference" and "what happens next" before filing -- these are the two sentences only a person can write, and filing is how the tutor signs the reply.';

export async function fileGradeQueryReply(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const trainer = await requireRole(["trainer", "admin"]);

  const replyId = formData.get("reply_id");
  const traineeId = formData.get("trainee_id");
  const whatWouldHaveMadeTheDifference = optionalString(formData.get("what_would_have_made_the_difference"));
  const whatHappensNext = optionalString(formData.get("what_happens_next"));

  if (typeof replyId !== "string" || !replyId || typeof traineeId !== "string" || !traineeId) {
    return { error: "Something went wrong. Refresh and try again." };
  }
  if (!whatWouldHaveMadeTheDifference || !whatHappensNext) {
    return { error: FILE_VALIDATION_ERROR };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("grade_query_replies")
    .update({
      what_would_have_made_the_difference: whatWouldHaveMadeTheDifference,
      what_happens_next: whatHappensNext,
      filed_at: new Date().toISOString(),
      filed_by: trainer.id,
    })
    .eq("id", replyId)
    .eq("course_id", trainer.course_id ?? "")
    .is("filed_at", null); // no-op if another request already filed it first

  if (error) {
    // The message below is what the person reads; this is what we read.
    console.error("[trainer/(hub)/grade-query-reply:fileGradeQueryReply]", error);
    return { error: "Could not file. Try again." };
}

  revalidatePath(`/trainer/grade-query-reply/${traineeId}/${replyId}`);
  revalidatePath(`/trainer/grade-query-reply/${traineeId}`);
  return { error: null };
}

// connect-build-specs-5-gaps-2026-08-21.md item 5: the formal Cambridge
// appeal itself happens entirely outside Connect, so this is a manual
// flag a trainer/admin sets when they learn (out of band) that a filed
// reply has gone to a formal appeal -- not a live tracker. Close-out
// checks it (blocking-rules.ts).
export async function markAppealRaised(formData: FormData): Promise<void> {
  const trainer = await requireRole(["trainer", "admin"]);
  const replyId = formData.get("reply_id");
  const traineeId = formData.get("trainee_id");
  if (typeof replyId !== "string" || typeof traineeId !== "string") return;

  const supabase = await createClient();
  await supabase
    .from("grade_query_replies")
    .update({ appeal_raised_at: new Date().toISOString(), appeal_raised_by: trainer.id, appeal_resolved_at: null, appeal_resolved_by: null })
    .eq("id", replyId)
    .eq("course_id", trainer.course_id ?? "")
    .not("filed_at", "is", null);

  revalidatePath(`/trainer/grade-query-reply/${traineeId}/${replyId}`);
}

export async function markAppealResolved(formData: FormData): Promise<void> {
  const trainer = await requireRole(["trainer", "admin"]);
  const replyId = formData.get("reply_id");
  const traineeId = formData.get("trainee_id");
  if (typeof replyId !== "string" || typeof traineeId !== "string") return;

  const supabase = await createClient();
  await supabase
    .from("grade_query_replies")
    .update({ appeal_resolved_at: new Date().toISOString(), appeal_resolved_by: trainer.id })
    .eq("id", replyId)
    .eq("course_id", trainer.course_id ?? "")
    .not("appeal_raised_at", "is", null);

  revalidatePath(`/trainer/grade-query-reply/${traineeId}/${replyId}`);
}
