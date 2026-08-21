"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface SignatureFormState {
  error: string | null;
}

// connect-build-specs-5-gaps-2026-08-21.md item 4: "sign once, reuse
// everywhere," for every role -- not a trainee-only action, so this lives
// outside src/app/dashboard/trainee/. No requireRole() call: any signed-in
// user sets their own signature, and set_my_signature() is self-scoped to
// auth.uid() regardless of role.
export async function setMySignature(_prevState: SignatureFormState, formData: FormData): Promise<SignatureFormState> {
  const name = (formData.get("signature_name") as string | null)?.trim();
  if (!name) {
    return { error: "Type your name first." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_my_signature", { p_name: name });
  if (error) {
    return { error: error.message.includes("already set") ? "Your signature is already set for this course." : "Could not save. Try again." };
  }

  revalidatePath("/", "layout");
  return { error: null };
}
