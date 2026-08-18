"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

export interface FormState {
  error: string | null;
}

// Setup is one form: recording link + lesson title + expected length. One
// session per timetable event -- upsert on the unique timetable_event_id
// rather than requiring a separate "create" step, so re-saving to fix a
// typo'd URL doesn't create a second row.
export async function saveFilmedObservationSession(_prevState: FormState, formData: FormData): Promise<FormState> {
  const trainer = await requireRole(["trainer", "admin"]);
  if (!trainer.course_id) return { error: "No course assigned." };

  const eventId = formData.get("event_id");
  const lessonTitle = (formData.get("lesson_title") as string | null)?.trim() || null;
  const recordingUrl = (formData.get("recording_url") as string | null)?.trim() || null;
  const lengthRaw = formData.get("length_minutes") as string | null;
  const lengthMinutes = lengthRaw ? Number(lengthRaw) : null;
  const level = (formData.get("level") as string | null)?.trim() || null;
  const learnerCountRaw = formData.get("learner_count") as string | null;
  const learnerCount = learnerCountRaw ? Number(learnerCountRaw) : null;
  if (typeof eventId !== "string" || !eventId) return { error: "Something went wrong. Refresh and try again." };
  if (lengthMinutes !== null && (Number.isNaN(lengthMinutes) || lengthMinutes <= 0)) {
    return { error: "Length must be a positive number of minutes." };
  }
  if (learnerCount !== null && (Number.isNaN(learnerCount) || learnerCount < 0)) {
    return { error: "Learner count must be a positive number." };
  }

  const supabase = await createClient();
  const { data: event } = await supabase
    .from("course_timetable_events")
    .select("id, course_id")
    .eq("id", eventId)
    .eq("course_id", trainer.course_id)
    .maybeSingle();
  if (!event) return { error: "Could not find that timetable event." };

  const { error } = await supabase.from("filmed_observation_sessions").upsert(
    {
      course_id: trainer.course_id,
      timetable_event_id: eventId,
      lesson_title: lessonTitle,
      recording_url: recordingUrl,
      length_minutes: lengthMinutes,
      level,
      learner_count: learnerCount,
      created_by: trainer.id,
    },
    { onConflict: "timetable_event_id" }
  );
  if (error) return { error: "Could not save. Try again." };

  revalidatePath(`/trainer/timetable/filmed-observation/${eventId}`);
  revalidatePath("/trainer/timetable");
  return { error: null };
}

// Breaks are added one at a time (timestamp + duration + prompt), numbered
// by insertion order -- simplest authoring shape for something the spec
// itself says "not designed yet."
export async function addFilmedObservationBreak(_prevState: FormState, formData: FormData): Promise<FormState> {
  const trainer = await requireRole(["trainer", "admin"]);
  if (!trainer.course_id) return { error: "No course assigned." };

  const sessionId = formData.get("session_id");
  const timestampRaw = formData.get("timestamp_seconds") as string | null;
  const durationRaw = formData.get("duration_seconds") as string | null;
  const prompt = (formData.get("prompt") as string | null)?.trim();
  if (typeof sessionId !== "string" || !sessionId || !timestampRaw || !prompt) {
    return { error: "Fill in the timestamp and a prompt." };
  }
  const timestampSeconds = Number(timestampRaw);
  const durationSeconds = durationRaw ? Number(durationRaw) : 180;
  if (Number.isNaN(timestampSeconds) || timestampSeconds < 0) return { error: "Timestamp must be a number of seconds." };
  if (Number.isNaN(durationSeconds) || durationSeconds <= 0) return { error: "Duration must be a positive number of seconds." };

  const supabase = await createClient();
  const { data: session } = await supabase
    .from("filmed_observation_sessions")
    .select("id, course_id")
    .eq("id", sessionId)
    .eq("course_id", trainer.course_id)
    .maybeSingle();
  if (!session) return { error: "Could not find that session." };

  const { count } = await supabase
    .from("filmed_observation_breaks")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId);

  const { error } = await supabase.from("filmed_observation_breaks").insert({
    session_id: sessionId,
    break_number: (count ?? 0) + 1,
    timestamp_seconds: timestampSeconds,
    duration_seconds: durationSeconds,
    prompt,
  });
  if (error) return { error: "Could not save. Try again." };

  revalidatePath("/trainer/timetable/filmed-observation");
  return { error: null };
}

// No manual course-ownership filter needed -- the RLS policy above already
// scopes any delete to breaks whose session belongs to the trainer's own
// course, so a mismatched id is simply a no-op.
export async function deleteFilmedObservationBreak(formData: FormData): Promise<void> {
  await requireRole(["trainer", "admin"]);
  const breakId = formData.get("break_id");
  if (typeof breakId !== "string") return;

  const supabase = await createClient();
  await supabase.from("filmed_observation_breaks").delete().eq("id", breakId);

  revalidatePath("/trainer/timetable/filmed-observation");
}

// Task is one authored form: 2 criterion-specific prompts, the fixed
// general prompt (editable), and a rating axis (label + comma-separated
// options). Upserts on session_id -- one task per session, same reasoning
// as the session upsert above.
export async function saveFilmedObservationTask(_prevState: FormState, formData: FormData): Promise<FormState> {
  const trainer = await requireRole(["trainer", "admin"]);
  if (!trainer.course_id) return { error: "No course assigned." };

  const sessionId = formData.get("session_id");
  const criteriaRaw = (formData.get("criteria_codes") as string | null) ?? "";
  const prompt1 = (formData.get("prompt_1") as string | null)?.trim();
  const prompt2 = (formData.get("prompt_2") as string | null)?.trim();
  const generalPrompt = (formData.get("general_prompt") as string | null)?.trim() || "What would you borrow for your own teaching?";
  const ratingLabel = (formData.get("rating_label") as string | null)?.trim() || "Pace";
  const ratingOptionsRaw = (formData.get("rating_options") as string | null) ?? "Too slow, Just right, Too fast";

  if (typeof sessionId !== "string" || !sessionId || !prompt1 || !prompt2) {
    return { error: "Fill in both criterion-specific prompts." };
  }

  const supabase = await createClient();
  const { data: session } = await supabase
    .from("filmed_observation_sessions")
    .select("id, course_id")
    .eq("id", sessionId)
    .eq("course_id", trainer.course_id)
    .maybeSingle();
  if (!session) return { error: "Could not find that session." };

  const criteriaCodes = criteriaRaw
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  const ratingOptions = ratingOptionsRaw
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  const { error } = await supabase.from("filmed_observation_tasks").upsert(
    {
      session_id: sessionId,
      criteria_codes: criteriaCodes,
      prompt_1: prompt1,
      prompt_2: prompt2,
      general_prompt: generalPrompt,
      rating_label: ratingLabel,
      rating_options: ratingOptions.length > 0 ? ratingOptions : ["Too slow", "Just right", "Too fast"],
      created_by: trainer.id,
    },
    { onConflict: "session_id" }
  );
  if (error) return { error: "Could not save. Try again." };

  revalidatePath("/trainer/timetable/filmed-observation");
  return { error: null };
}
