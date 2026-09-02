"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface FormState {
  error: string | null;
}

// Ensures a response row exists for this trainee+task before the first
// autosave or timestamped note -- upsert rather than a separate "start"
// step, matching every other draft-response pattern in this app.
async function ensureResponseRow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  taskId: string,
  traineeId: string
): Promise<void> {
  await supabase
    .from("filmed_observation_task_responses")
    .upsert({ task_id: taskId, trainee_id: traineeId }, { onConflict: "task_id,trainee_id", ignoreDuplicates: true });
}

// Continuous autosave for the full task page's structured fields -- no
// explicit save action, called on blur/debounce from the client. A no-op
// void action (matching other autosave forms in this app) since a failed
// autosave shouldn't interrupt the trainee's writing with an error banner.
export async function saveFilmedObservationTaskDraft(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const taskId = formData.get("task_id");
  if (typeof taskId !== "string" || !taskId) return;

  await ensureResponseRow(supabase, taskId, user.id);

  const { data: existing } = await supabase
    .from("filmed_observation_task_responses")
    .select("completed_at")
    .eq("task_id", taskId)
    .eq("trainee_id", user.id)
    .maybeSingle();
  if (existing?.completed_at) return; // locked once marked complete

  await supabase
    .from("filmed_observation_task_responses")
    .update({
      response_1: (formData.get("response_1") as string | null) ?? null,
      response_2: (formData.get("response_2") as string | null) ?? null,
      response_general: (formData.get("response_general") as string | null) ?? null,
      rating: (formData.get("rating") as string | null) ?? null,
    })
    .eq("task_id", taskId)
    .eq("trainee_id", user.id);

  revalidatePath("/portfolio/[traineeId]/filmed-observation/[sessionId]/task", "page");
}

// Per-field autosave for the eight-prompt task. Writes into the `responses`
// JSON column (migration 0243) rather than the three fixed response_N
// columns, which could only ever hold three of eight answers.
//
// One field at a time, not the whole form: the panel debounces per prompt
// so a candidate working down eight boxes saves each as they finish it,
// rather than nothing saving until they stop typing altogether.
export async function saveFilmedObservationTaskResponse(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const taskId = formData.get("task_id");
  const field = formData.get("field");
  const value = formData.get("value");
  if (typeof taskId !== "string" || !taskId || typeof field !== "string" || typeof value !== "string") return;

  await ensureResponseRow(supabase, taskId, user.id);

  const { data: existing } = await supabase
    .from("filmed_observation_task_responses")
    .select("completed_at, responses")
    .eq("task_id", taskId)
    .eq("trainee_id", user.id)
    .maybeSingle();
  if (existing?.completed_at) return; // locked once marked complete

  // Read-modify-write on one JSON column. Safe here because a candidate
  // only ever writes their own row from one screen at a time, and the
  // debounce means concurrent writes to different fields land in sequence
  // rather than racing.
  const current = (existing?.responses ?? {}) as Record<string, string>;
  const next = { ...current, [field]: value };

  await supabase
    .from("filmed_observation_task_responses")
    .update({ responses: next })
    .eq("task_id", taskId)
    .eq("trainee_id", user.id);
}

// The compact in-session quick-note: captures the current playback second
// alongside a short note, appended to the same timestamped_notes list the
// full task page later shows with click-to-seek -- one running list, not
// two separate note systems.
export async function addFilmedObservationTimestampedNote(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const taskId = formData.get("task_id");
  const timestampRaw = formData.get("timestamp_seconds") as string | null;
  const note = (formData.get("note") as string | null)?.trim();
  if (typeof taskId !== "string" || !taskId || !note || !timestampRaw) return;
  const timestampSeconds = Number(timestampRaw);
  if (Number.isNaN(timestampSeconds)) return;

  await ensureResponseRow(supabase, taskId, user.id);

  const { data: existing } = await supabase
    .from("filmed_observation_task_responses")
    .select("timestamped_notes, completed_at")
    .eq("task_id", taskId)
    .eq("trainee_id", user.id)
    .maybeSingle();
  if (existing?.completed_at) return;

  const notes = Array.isArray(existing?.timestamped_notes) ? existing.timestamped_notes : [];
  await supabase
    .from("filmed_observation_task_responses")
    .update({ timestamped_notes: [...notes, { timestamp_seconds: timestampSeconds, note }] })
    .eq("task_id", taskId)
    .eq("trainee_id", user.id);

  revalidatePath("/portfolio/[traineeId]/filmed-observation/[sessionId]", "page");
  revalidatePath("/portfolio/[traineeId]/filmed-observation/[sessionId]/task", "page");
}

// The one explicit submission action. Locks the response and logs a real
// observations row (filmed=true) so the hour counts toward the existing
// 6-hour requirement through observation-hours.ts -- the same single
// function every other observation path already reads, same auto-created-
// row pattern observation_task_submissions already established. If the
// trainee is still writing when the video ends, nothing here auto-fires --
// this only runs when they click the button themselves.
export async function markFilmedObservationTaskComplete(_prevState: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const taskId = formData.get("task_id");
  const sessionId = formData.get("session_id");
  if (typeof taskId !== "string" || typeof sessionId !== "string" || !taskId || !sessionId) {
    return { error: "Something went wrong. Refresh and try again." };
  }

  const { data: response } = await supabase
    .from("filmed_observation_task_responses")
    .select("completed_at")
    .eq("task_id", taskId)
    .eq("trainee_id", user.id)
    .maybeSingle();
  if (response?.completed_at) return { error: null }; // already complete -- idempotent

  const { data: session } = await supabase
    .from("filmed_observation_sessions")
    .select("course_id, lesson_title, length_minutes, level, learner_count, timetable_event_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return { error: "Could not find that session." };

  const { data: event } = await supabase
    .from("course_timetable_events")
    .select("event_date")
    .eq("id", session.timetable_event_id)
    .maybeSingle();

  const { data: observation, error: obsError } = await supabase
    .from("observations")
    .insert({
      course_id: session.course_id,
      trainee_id: user.id,
      observation_date: event?.event_date ?? null,
      length_minutes: session.length_minutes,
      level: session.level,
      learners_present: session.learner_count,
      lesson_focus: session.lesson_title,
      filmed: true,
    })
    .select("id")
    .single();
  if (obsError || !observation) return { error: "Could not log this observation. Try again." };

  await ensureResponseRow(supabase, taskId, user.id);
  const { error } = await supabase
    .from("filmed_observation_task_responses")
    .update({ completed_at: new Date().toISOString(), observation_id: observation.id })
    .eq("task_id", taskId)
    .eq("trainee_id", user.id);
  if (error) {
    // The message above is what the person reads; this is what we read.
    console.error("[portfolio/[traineeId]/filmed-observation-actions.ts:markFilmedObservationTaskComplete]", error);
    return { error: "Could not save. Try again." };
  }

  revalidatePath("/portfolio/[traineeId]/filmed-observation/[sessionId]", "page");
  revalidatePath("/portfolio/[traineeId]/filmed-observation/[sessionId]/task", "page");
  revalidatePath("/portfolio/[traineeId]/celta5", "page");
  return { error: null };
}
