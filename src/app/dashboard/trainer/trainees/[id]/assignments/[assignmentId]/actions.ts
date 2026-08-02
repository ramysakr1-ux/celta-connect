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

async function returnAssignment(formData: FormData, decision: "pass" | "resubmission_required"): Promise<FormState> {
  await requireRole("trainer");
  const assignmentId = formData.get("assignment_id");
  const round = formData.get("round");
  const finalGrade = formData.get("final_grade");
  if (typeof assignmentId !== "string" || typeof round !== "string") {
    return { error: "Invalid request." };
  }

  const supabase = await createClient();
  const commentError = await saveComments(supabase, assignmentId, round, parseComments(formData));
  if (commentError) return { error: commentError };

  const status = decision === "pass" ? "approved" : "resubmission_required";
  const isResubmission = round === "resubmission";
  const grade = decision === "pass" && typeof finalGrade === "string" && finalGrade ? finalGrade : undefined;
  const update: Database["public"]["Tables"]["assignments"]["Update"] = {
    first_status: isResubmission ? undefined : status,
    resubmission_status: isResubmission ? status : undefined,
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
