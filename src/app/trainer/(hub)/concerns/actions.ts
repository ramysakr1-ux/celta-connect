"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

export interface FormState {
  error: string | null;
}

// "The centre replies to every concern" -- any trainer/admin on the course
// can reply, not just the specific person a concern was routed to (see
// migration 0140's own reasoning: routing directs attention, it isn't an
// access-control boundary at the RLS layer).
export async function replyToConcern(_prevState: FormState, formData: FormData): Promise<FormState> {
  const trainer = await requireRole(["trainer", "admin"]);
  const concernId = formData.get("concern_id");
  const response = (formData.get("response") as string | null)?.trim();
  if (typeof concernId !== "string" || !concernId || !response) {
    return { error: "Write a reply first." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("concerns")
    .update({ response, responded_at: new Date().toISOString(), responded_by: trainer.id })
    .eq("id", concernId)
    .eq("course_id", trainer.course_id ?? "");
  if (error) return { error: "Could not save. Try again." };

  revalidatePath("/trainer/concerns");
  return { error: null };
}
