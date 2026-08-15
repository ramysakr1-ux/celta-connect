"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import type { Database } from "@/lib/supabase/types";
import { runPlagiarismScan } from "@/lib/plagiarism/scan";

type SectionResponseInsert = Database["public"]["Tables"]["assignment_section_responses"]["Insert"];

export interface FormState {
  error: string | null;
}

interface SectionPayload {
  key: string;
  title: string;
  text: string;
}

function parseSections(formData: FormData): SectionPayload[] {
  const raw = formData.get("sections_payload");
  if (typeof raw !== "string" || !raw) return [];
  try {
    return JSON.parse(raw) as SectionPayload[];
  } catch {
    return [];
  }
}

async function saveResponses(
  supabase: Awaited<ReturnType<typeof createClient>>,
  assignmentId: string,
  round: string,
  sections: SectionPayload[]
): Promise<string | null> {
  const isResubmission = round === "resubmission";
  for (const s of sections) {
    const row: SectionResponseInsert = {
      assignment_id: assignmentId,
      section_key: s.key,
      section_title: s.title,
      first_response: isResubmission ? undefined : s.text,
      resubmission_response: isResubmission ? s.text : undefined,
    };
    const { error } = await supabase
      .from("assignment_section_responses")
      .upsert(row, { onConflict: "assignment_id,section_key" });
    if (error) return "Could not save -- this assignment may already be locked.";
  }
  return null;
}

export async function saveAssignmentDraft(_prevState: FormState, formData: FormData): Promise<FormState> {
  const trainee = await requireRole("trainee");
  const assignmentId = formData.get("assignment_id");
  const round = formData.get("round");
  if (typeof assignmentId !== "string" || typeof round !== "string") {
    return { error: "Invalid request." };
  }

  const supabase = await createClient();
  const error = await saveResponses(supabase, assignmentId, round, parseSections(formData));
  if (error) return { error };

  revalidatePath(`/portfolio/${trainee.id}/assignments/${assignmentId}`);
  return { error: null };
}

function wordCount(text: string): number {
  return text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length;
}

export async function submitAssignment(_prevState: FormState, formData: FormData): Promise<FormState> {
  const trainee = await requireRole("trainee");
  const assignmentId = formData.get("assignment_id");
  const round = formData.get("round");
  if (typeof assignmentId !== "string" || typeof round !== "string") {
    return { error: "Invalid request." };
  }

  const sections = parseSections(formData);
  const totalWords = sections.reduce((sum, s) => sum + wordCount(s.text), 0);
  const aiDeclared = formData.get("ai_declared") === "true";
  const aiConversationUrl = formData.get("ai_conversation_url");
  const ownWorkConfirmed = formData.get("own_work_confirmed") === "true";

  const supabase = await createClient();
  const saveError = await saveResponses(supabase, assignmentId, round, sections);
  if (saveError) return { error: saveError };

  const { error } = await supabase.rpc("submit_assignment_round", {
    p_assignment_id: assignmentId,
    p_word_count: totalWords,
    p_ai_declared: aiDeclared,
    p_ai_conversation_url: typeof aiConversationUrl === "string" ? aiConversationUrl : null,
    p_own_work_confirmed: ownWorkConfirmed,
  });
  if (error) return { error: error.message };

  // build-spec.md: the scanner "runs automatically on submission, visible
  // to tutors only". A scan failure must never block the trainee's
  // submission, which already succeeded above -- log and move on.
  try {
    await runPlagiarismScan(assignmentId, round === "resubmission" ? "resubmission" : "first");
  } catch (scanError) {
    console.error("Plagiarism scan failed for assignment", assignmentId, scanError);
  }

  revalidatePath(`/portfolio/${trainee.id}/assignments/${assignmentId}`);
  revalidatePath(`/portfolio/${trainee.id}/assignments`);
  return { error: null };
}

// for-claude-code-trainee-interface.md's Assignments tab: "can withdraw only
// while it's unopened; once a tutor opens it, it locks to 'being marked.'"
// This app has no "opened_at" tracking at all (marker_id is only set once a
// trainer actually returns a decision, not when they merely view it), so
// the closest real signal available is first_status still being 'submitted'
// -- coarser than "opened," but honest about what the schema can actually
// tell. Goes through the withdraw_assignment_submission RPC (migration 0097)
// rather than a plain .update() -- migration 0023 dropped the trainee's
// direct UPDATE policy on assignments, so a plain client-side update matches
// zero rows and silently no-ops. The RPC's own WHERE guard is the atomic
// check: if a trainer's decision landed between page load and this click,
// first_status has already moved on and the update simply matches zero rows.
export async function withdrawAssignmentSubmission(formData: FormData): Promise<void> {
  const trainee = await requireRole("trainee");
  const assignmentId = formData.get("assignment_id");
  if (typeof assignmentId !== "string") return;

  const supabase = await createClient();
  await supabase.rpc("withdraw_assignment_submission", { p_assignment_id: assignmentId });

  revalidatePath(`/portfolio/${trainee.id}/assignments/${assignmentId}`);
  revalidatePath(`/portfolio/${trainee.id}/assignments`);
}
