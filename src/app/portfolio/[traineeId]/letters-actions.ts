"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface AcknowledgeLetterState {
  error: string | null;
}

// Same confirmed_at + narrow-RLS pattern as individual_tutorial_invites: the
// only thing this ever writes is the trainee's own acknowledged_at.
export async function acknowledgeFormalLetter(_prevState: AcknowledgeLetterState, formData: FormData): Promise<AcknowledgeLetterState> {
  const letterId = formData.get("letter_id");
  if (typeof letterId !== "string") return { error: "Missing letter." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase
    .from("formal_letters")
    .update({ acknowledged_at: new Date().toISOString() })
    .eq("id", letterId)
    .eq("trainee_id", user.id);
  if (error) return { error: "Could not save. Try again." };

  revalidatePath("/portfolio/[traineeId]/letters/[letterId]", "page");
  revalidatePath("/portfolio/[traineeId]", "layout");
  return { error: null };
}
