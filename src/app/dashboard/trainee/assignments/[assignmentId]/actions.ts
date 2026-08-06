"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import type { Database } from "@/lib/supabase/types";

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

export async function submitAssignment(_prevState: FormState, formData: FormData): Promise<FormState> {
  const trainee = await requireRole("trainee");
  const assignmentId = formData.get("assignment_id");
  const round = formData.get("round");
  if (typeof assignmentId !== "string" || typeof round !== "string") {
    return { error: "Invalid request." };
  }

  const supabase = await createClient();
  const saveError = await saveResponses(supabase, assignmentId, round, parseSections(formData));
  if (saveError) return { error: saveError };

  const { error } = await supabase.rpc("submit_assignment_round", { p_assignment_id: assignmentId });
  if (error) return { error: error.message };

  revalidatePath(`/portfolio/${trainee.id}/assignments/${assignmentId}`);
  revalidatePath(`/portfolio/${trainee.id}/assignments`);
  return { error: null };
}
