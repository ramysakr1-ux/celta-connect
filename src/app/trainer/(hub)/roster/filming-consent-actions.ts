"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

// specs/admissions-and-close-out.md §10: the signature is on paper, kept
// with the class register -- this just records that the trainer has
// actually collected it from a given trainee.
export async function toggleFilmingConsent(formData: FormData): Promise<void> {
  const trainer = await requireRole(["trainer", "admin"]);
  const traineeId = formData.get("trainee_id");
  const confirmed = formData.get("confirmed") === "true";
  if (typeof traineeId !== "string" || !trainer.course_id) return;

  const supabase = await createClient();
  const { data: trainee } = await supabase.from("profiles").select("id, course_id").eq("id", traineeId).maybeSingle();
  if (!trainee || trainee.course_id !== trainer.course_id) return;

  await supabase
    .from("profiles")
    .update({
      filming_consent_confirmed_at: confirmed ? new Date().toISOString() : null,
      filming_consent_confirmed_by: confirmed ? trainer.id : null,
    })
    .eq("id", traineeId);

  revalidatePath("/trainer/roster");
}
