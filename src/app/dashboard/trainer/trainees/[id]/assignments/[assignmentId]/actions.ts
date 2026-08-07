"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
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

  if (decision === "fail" && !isResubmission) {
    return { error: "A fail can only be recorded on the resubmission round." };
  }
  if (isResubmission && (typeof secondMarkerId !== "string" || !secondMarkerId)) {
    return { error: "Pick a second marker before returning a resubmission decision." };
  }

  const supabase = await createClient();
  const commentError = await saveComments(supabase, assignmentId, round, parseComments(formData));
  if (commentError) return { error: commentError };

  const criteriaMarks = parseCriteriaMarks(formData);
  const status = decision === "resubmission_required" ? "resubmission_required" : "approved";
  const grade = decision === "pass" && typeof finalGrade === "string" && finalGrade ? finalGrade : undefined;

  const update: Database["public"]["Tables"]["assignments"]["Update"] = {
    marker_id: marker.id,
    first_status: isResubmission ? undefined : status,
    first_criteria_marks: isResubmission ? undefined : criteriaMarks,
    resubmission_status: isResubmission ? status : undefined,
    resubmission_criteria_marks: isResubmission ? criteriaMarks : undefined,
    resubmission_outcome: isResubmission ? (decision === "fail" ? "fail" : "pass") : undefined,
    second_marker_id: isResubmission ? (secondMarkerId as string) : undefined,
    second_marker_recorded_at: isResubmission ? new Date().toISOString() : undefined,
    final_grade: grade,
  };

  const { error } = await supabase.from("assignments").update(update).eq("id", assignmentId);
  if (error) return { error: "Could not update the assignment. Try again." };

  revalidatePath(`/dashboard/trainer/trainees`);
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
