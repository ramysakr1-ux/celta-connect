"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

// for-claude-code-supervised-review.md: "Time spent -- tracked automatically
// while the task is open/active." Real elapsed time from the client's own
// ticking timer, reported in small increments rather than trusted as one
// final self-reported number -- the client only ever sends how much time
// passed since its last successful heartbeat, added to whatever's already
// stored, so a page reload or a dropped request can't zero it out.
export async function heartbeatSupervisedSession(eventId: string, deltaSeconds: number): Promise<void> {
  const trainee = await requireRole("trainee");
  if (deltaSeconds <= 0) return;
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("supervised_session_completions")
    .select("time_spent_seconds, submitted_at")
    .eq("timetable_event_id", eventId)
    .eq("trainee_id", trainee.id)
    .maybeSingle();
  if (existing?.submitted_at) return; // locked, no more ticking
  await supabase.from("supervised_session_completions").upsert(
    {
      timetable_event_id: eventId,
      trainee_id: trainee.id,
      time_spent_seconds: (existing?.time_spent_seconds ?? 0) + deltaSeconds,
    },
    { onConflict: "timetable_event_id,trainee_id" }
  );
}

export interface SubmitState {
  error: string | null;
}

export async function submitSupervisedSession(_prev: SubmitState, formData: FormData): Promise<SubmitState> {
  const trainee = await requireRole("trainee");
  const eventId = formData.get("event_id");
  const response = formData.get("response");
  if (typeof eventId !== "string" || !eventId) return { error: "Invalid request." };
  if (typeof response !== "string" || !response.trim()) return { error: "Write something before marking this complete." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("supervised_session_completions")
    .upsert(
      { timetable_event_id: eventId, trainee_id: trainee.id, response: response.trim(), submitted_at: new Date().toISOString() },
      { onConflict: "timetable_event_id,trainee_id" }
    );
  if (error) return { error: error.message };

  revalidatePath(`/portfolio/${trainee.id}/supervised/${eventId}`);
  revalidatePath(`/portfolio/${trainee.id}/timetable`);
  return { error: null };
}
