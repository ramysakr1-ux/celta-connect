"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { resolveGtkyAssignments } from "@/lib/gtky-assignment";

export interface FormState {
  error: string | null;
}

export async function assignGtkyActivities(): Promise<void> {
  const trainer = await requireRole(["trainer", "admin"]);
  if (!trainer.course_id) return;

  const supabase = await createClient();
  await resolveGtkyAssignments(supabase, trainer.course_id);

  revalidatePath("/trainer/gtky");
}

// Candidate picks one of their three offered activities -- locked once
// made, same rule as any other assignment ("no re-randomization once a
// candidate has made their pick").
export async function chooseGtkyActivity(formData: FormData): Promise<void> {
  const trainee = await requireRole("trainee");
  const slug = formData.get("slug");
  if (typeof slug !== "string" || !slug) return;

  const supabase = await createClient();
  await supabase
    .from("gtky_assignments")
    .update({ chosen_slug: slug, chosen_at: new Date().toISOString() })
    .eq("trainee_id", trainee.id)
    .is("chosen_slug", null);

  revalidatePath(`/portfolio/${trainee.id}`, "layout");
}
