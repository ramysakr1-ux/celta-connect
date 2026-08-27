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

// for-claude-code-pre-course-task-screens.md, screen 1a0g: "if you do not
// pick, your tutor picks for you." Picks the first of the three already-
// offered activities (already level/mode-matched and deduped within the
// TP group by resolveGtkyAssignments) rather than a fresh random draw --
// simplest reading of "pick for them" that still respects what was
// already offered. Same "locked once made" guard as the trainee's own
// choice.
export async function pickGtkyActivityForTrainee(formData: FormData): Promise<void> {
  const trainer = await requireRole(["trainer", "admin"]);
  if (!trainer.course_id) return;

  const traineeId = formData.get("trainee_id");
  if (typeof traineeId !== "string") return;

  const supabase = await createClient();
  const { data: assignment } = await supabase
    .from("gtky_assignments")
    .select("offered_slugs, chosen_slug, course_id")
    .eq("trainee_id", traineeId)
    .maybeSingle();
  if (!assignment || assignment.chosen_slug || assignment.course_id !== trainer.course_id) return;
  const slug = assignment.offered_slugs[0];
  if (!slug) return;

  await supabase
    .from("gtky_assignments")
    .update({ chosen_slug: slug, chosen_at: new Date().toISOString() })
    .eq("trainee_id", traineeId)
    .is("chosen_slug", null);

  revalidatePath("/trainer/gtky");
  revalidatePath(`/portfolio/${traineeId}`, "layout");
}

// Candidate picks one of their three offered activities -- locked once
// made, same rule as any other assignment ("no re-randomization once a
// candidate has made their pick").
export async function chooseGtkyActivity(formData: FormData): Promise<void> {
  const trainee = await requireRole("trainee");
  const slug = formData.get("slug");
  if (typeof slug !== "string" || !slug) return;

  const supabase = await createClient();
  // Ramy, 28 Aug 2026: "the logic behind everything" -- nothing previously
  // checked slug against this trainee's own offered_slugs (unlike
  // pickGtkyActivityForTrainee above, which only ever writes
  // offered_slugs[0]), so a tampered form could lock in any activity in the
  // whole bank, not just one of the three level/mode-matched picks actually
  // offered.
  const { data: assignment } = await supabase
    .from("gtky_assignments")
    .select("offered_slugs")
    .eq("trainee_id", trainee.id)
    .maybeSingle();
  if (!assignment || !assignment.offered_slugs.includes(slug)) return;

  await supabase
    .from("gtky_assignments")
    .update({ chosen_slug: slug, chosen_at: new Date().toISOString() })
    .eq("trainee_id", trainee.id)
    .is("chosen_slug", null);

  revalidatePath(`/portfolio/${trainee.id}`, "layout");
}
