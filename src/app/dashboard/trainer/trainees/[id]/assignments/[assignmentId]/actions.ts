"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { ASSIGNMENT_INFO } from "@/lib/assignment-info";
import type { Database } from "@/lib/supabase/types";

export interface FormState {
  error: string | null;
}

type SectionResponseInsert = Database["public"]["Tables"]["assignment_section_responses"]["Insert"];

interface SectionCommentPayload {
  key: string;
  title: string;
  comment: string;
}

// Each section's comment is its own named field (comment_<key>), not a
// combined JSON blob -- TrainerFeedbackTextarea's AI tone-cleanup buttons
// write straight to the DOM node, which only round-trips correctly for an
// uncontrolled field read via FormData at submit time.
function parseComments(formData: FormData): SectionCommentPayload[] {
  const raw = formData.get("section_keys");
  if (typeof raw !== "string" || !raw) return [];
  let keys: { key: string; title: string }[];
  try {
    keys = JSON.parse(raw);
  } catch {
    return [];
  }
  return keys.map(({ key, title }) => ({
    key,
    title,
    comment: (formData.get(`comment_${key}`) as string | null) ?? "",
  }));
}

function parseCriteriaMarks(formData: FormData): Record<string, boolean> {
  const raw = formData.get("criteria_marks");
  if (typeof raw !== "string" || !raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveComments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  assignmentId: string,
  round: string,
  comments: SectionCommentPayload[]
): Promise<string | null> {
  const isResubmission = round === "resubmission";
  for (const c of comments) {
    const row: SectionResponseInsert = {
      assignment_id: assignmentId,
      section_key: c.key,
      section_title: c.title,
      first_comments: isResubmission ? undefined : c.comment,
      resubmission_comments: isResubmission ? c.comment : undefined,
    };
    const { error } = await supabase
      .from("assignment_section_responses")
      .upsert(row, { onConflict: "assignment_id,section_key" });
    if (error) return "Could not save the comments. Try again.";
  }
  return null;
}

async function returnAssignment(
  formData: FormData,
  decision: "pass" | "resubmission_required" | "fail"
): Promise<FormState> {
  const marker = await requireRole("trainer");
  const assignmentId = formData.get("assignment_id");
  const round = formData.get("round");
  const finalGrade = formData.get("final_grade");
  const secondMarkerId = formData.get("second_marker_id");
  if (typeof assignmentId !== "string" || typeof round !== "string") {
    return { error: "Invalid request." };
  }

  const isResubmission = round === "resubmission";
  const supabase = await createClient();

  // build-spec.md "Assignment 5": "One chance, pass or fail, as with the
  // resubmission it accompanies" -- a Plagiarism Reflection never gets a
  // resubmission round of its own, so a fail is final on the first round
  // for this type only.
  const { data: assignmentRow } = await supabase
    .from("assignments")
    .select("assignment_type, trainee_id, course_id")
    .eq("id", assignmentId)
    .maybeSingle();
  const isOneChanceReflection = assignmentRow?.assignment_type === "Plagiarism Reflection";

  if (decision === "resubmission_required" && isOneChanceReflection) {
    return { error: "A Plagiarism Reflection has one chance only -- pass or fail, no resubmission." };
  }
  if (decision === "fail" && !isResubmission && !isOneChanceReflection) {
    return { error: "A fail can only be recorded on the resubmission round." };
  }
  if (isResubmission && (typeof secondMarkerId !== "string" || !secondMarkerId)) {
    return { error: "Pick a second marker before returning a resubmission decision." };
  }

  const commentError = await saveComments(supabase, assignmentId, round, parseComments(formData));
  if (commentError) return { error: commentError };

  const criteriaMarks = parseCriteriaMarks(formData);
  const status = decision === "resubmission_required" ? "resubmission_required" : "approved";
  const grade = decision === "pass" && typeof finalGrade === "string" && finalGrade ? finalGrade : undefined;

  // A Plagiarism Reflection's fail is final on the first round -- the
  // schema only has a distinct pass/fail outcome field on the
  // resubmission side (resubmission_outcome), so a first-round fail for
  // this type reuses it rather than a first_status value that doesn't
  // exist ('approved' alone would read as a pass everywhere else in the
  // app that shows ASSIGNMENT_STATUS_LABEL.approved = "Pass").
  const reflectionFirstRoundFail = isOneChanceReflection && !isResubmission && decision === "fail";

  const update: Database["public"]["Tables"]["assignments"]["Update"] = {
    marker_id: marker.id,
    first_status: isResubmission ? undefined : status,
    first_criteria_marks: isResubmission ? undefined : criteriaMarks,
    resubmission_status: isResubmission ? status : undefined,
    resubmission_criteria_marks: isResubmission ? criteriaMarks : undefined,
    resubmission_outcome: isResubmission ? (decision === "fail" ? "fail" : "pass") : reflectionFirstRoundFail ? "fail" : undefined,
    second_marker_id: isResubmission ? (secondMarkerId as string) : undefined,
    second_marker_recorded_at: isResubmission ? new Date().toISOString() : undefined,
    // A fail is written, not inferred.
    //
    // final_grade used to be set only on a pass, so a failed assignment kept
    // final_grade = null forever and the Fail column on CELTA 5 page 14 --
    // Pass 1st / Pass 2nd / Fail -- could never be ticked. Every reader had
    // to infer the fail from the ABSENCE of a pass, and one export that
    // forgot the rule would silently print a blank where a fail belongs.
    // Ramy, 31 Aug 2026, choosing this over deriving it: "right fail for the
    // assignments... one fail, they cannot get an A. Two fail assignments,
    // they fail."
    //
    // Which decisions are final fails: a fail on a RESUBMISSION (the second
    // and last chance), and a first-round fail of the Plagiarism Reflection,
    // which gets only one chance by design. A first-round
    // "resubmission_required" is NOT a fail -- it is the candidate's second
    // chance being issued, and writing Fail there would condemn work that
    // may well pass.
    final_grade: grade ?? (isResubmission && decision === "fail" ? "Fail" : reflectionFirstRoundFail ? "Fail" : undefined),
  };

  const { error } = await supabase.from("assignments").update(update).eq("id", assignmentId);
  if (error) {
    // The message above is what the person reads; this is what we read.
    console.error("[dashboard/trainer/trainees/[id]/assignments/[assignmentId]:action]", error);
    return { error: "Could not update the assignment. Try again." };
  }

  // for-claude-code-announcements-list.md table B (system-event, personal
  // scope): "an assignment is marked / feedback returned -> the one
  // candidate." Fires immediately, not scheduled -- there's no timetable
  // anchor for "whenever a trainer happens to finish marking."
  if (assignmentRow?.trainee_id && assignmentRow.course_id) {
    const label = assignmentRow.assignment_type ? ASSIGNMENT_INFO[assignmentRow.assignment_type]?.title : null;
    const title =
      status === "resubmission_required"
        ? `${label ?? "An assignment"} needs resubmission`
        : `${label ?? "An assignment"} feedback is ready`;
    await supabase.from("course_broadcasts").insert({
      course_id: assignmentRow.course_id,
      author_id: marker.id,
      title,
      body:
        status === "resubmission_required"
          ? "Check the brief for what to revise before resubmitting."
          : "Open your Written Assignments tab to see the full feedback.",
      visible_to_trainee_id: assignmentRow.trainee_id,
      sent_at: new Date().toISOString(),
    });
  }

  revalidatePath(`/dashboard/trainer/trainees`);
  revalidatePath(`/portfolio/[traineeId]`, "layout");
  return { error: null };
}

export async function returnWithPass(_prevState: FormState, formData: FormData): Promise<FormState> {
  return returnAssignment(formData, "pass");
}

export async function returnForResubmission(_prevState: FormState, formData: FormData): Promise<FormState> {
  return returnAssignment(formData, "resubmission_required");
}

export async function returnAsFail(_prevState: FormState, formData: FormData): Promise<FormState> {
  return returnAssignment(formData, "fail");
}

export async function updateAssignmentDueDate(formData: FormData): Promise<void> {
  await requireRole("trainer");
  const assignmentId = formData.get("assignment_id");
  const dueDate = formData.get("due_date");
  if (typeof assignmentId !== "string") return;

  const supabase = await createClient();
  await supabase
    .from("assignments")
    .update({ due_date: typeof dueDate === "string" && dueDate ? dueDate : null })
    .eq("id", assignmentId);

  revalidatePath(`/dashboard/trainer/trainees`);
}
