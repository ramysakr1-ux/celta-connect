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

// Deferral specifically -- an agreement, not a notice (see migration
// 0188's own comment). Requires the unified signature to already be set;
// the page only ever shows this button once it is (SetSignatureForm
// covers the "not set yet" case first), so this is a defensive guard,
// same shape as the celta5 sign-off RPCs' own "set your signature first."
export async function signDeferralLetter(_prevState: AcknowledgeLetterState, formData: FormData): Promise<AcknowledgeLetterState> {
  const letterId = formData.get("letter_id");
  if (typeof letterId !== "string") return { error: "Missing letter." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: profile } = await supabase.from("profiles").select("signature_name").eq("id", user.id).maybeSingle();
  if (!profile?.signature_name) return { error: "Set your signature first." };

  const { error } = await supabase
    .from("formal_letters")
    .update({ acknowledged_at: new Date().toISOString(), candidate_signature_name: profile.signature_name })
    .eq("id", letterId)
    .eq("trainee_id", user.id)
    .eq("letter_type", "deferral");
  if (error) return { error: "Could not save. Try again." };

  revalidatePath("/portfolio/[traineeId]/letters/[letterId]", "page");
  revalidatePath("/portfolio/[traineeId]", "layout");
  return { error: null };
}
