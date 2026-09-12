"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/require-role";
import { transcribeAudio } from "@/lib/openai/transcribe";
import { NOTEBOOK_AUDIO_BUCKET, type TraineeNote } from "@/lib/trainee-notebook";

// Migration 0293. The generated types lag until Ramy regenerates them, so
// the two notebook tables are read through an untyped handle on the same
// RLS-scoped client -- the policies, not the types, are what keep a note
// the trainee's own.
import { NOTEBOOK_PAPERS, type NotebookPaper } from "@/lib/trainee-notebook";

async function notebookDb(): Promise<SupabaseClient> {
  return (await createClient()) as unknown as SupabaseClient;
}

/** Create (id null) or update a note. Returns the row's id, or an error. */
export async function saveTraineeNote(input: {
  id: string | null;
  body: string;
  anchorPath: string;
  anchorLabel: string;
}): Promise<{ id: string | null; error: string | null }> {
  const trainee = await requireRole("trainee");
  const db = await notebookDb();
  if (input.id) {
    const { error } = await db.from("trainee_notes").update({ body: input.body }).eq("id", input.id).eq("trainee_id", trainee.id);
    if (error) {
      console.error("[portfolio/notebook-actions:saveTraineeNote]", error);
      return { id: input.id, error: "Couldn't save -- try again." };
    }
    return { id: input.id, error: null };
  }
  const { data, error } = await db
    .from("trainee_notes")
    .insert({
      trainee_id: trainee.id,
      course_id: trainee.course_id,
      anchor_path: input.anchorPath.slice(0, 300),
      anchor_label: input.anchorLabel.slice(0, 120),
      body: input.body,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[portfolio/notebook-actions:saveTraineeNote]", error);
    return { id: null, error: "Couldn't save -- try again." };
  }
  return { id: data.id as string, error: null };
}

export async function deleteTraineeNote(id: string): Promise<void> {
  const trainee = await requireRole("trainee");
  const db = await notebookDb();
  await db.from("trainee_notes").delete().eq("id", id).eq("trainee_id", trainee.id);
}

export async function setNotebookPaper(paper: NotebookPaper): Promise<void> {
  const trainee = await requireRole("trainee");
  if (!NOTEBOOK_PAPERS.includes(paper)) return;
  const db = await notebookDb();
  await db.from("trainee_notebook_settings").upsert({ trainee_id: trainee.id, paper, updated_at: new Date().toISOString() });
}

const SIGNED_URL_SECONDS = 4 * 60 * 60;

/**
 * A voice note: the recording is kept in the trainee's own folder of a
 * private bucket, transcribed once (best effort, same as the speaking task
 * -- a missing OPENAI_API_KEY never loses the recording), and saved as a
 * note whose text is the transcript. Uploaded through the service role and
 * played back through a short-lived signed URL, so no storage policy has to
 * reason about who the trainee is.
 */
export async function saveVoiceNote(formData: FormData): Promise<{ note: TraineeNote | null; error: string | null }> {
  const trainee = await requireRole("trainee");
  const audio = formData.get("audio");
  const anchorPath = String(formData.get("anchor_path") ?? "").slice(0, 300);
  const anchorLabel = String(formData.get("anchor_label") ?? "").slice(0, 120);
  const seconds = Number(formData.get("seconds") ?? 0);
  if (!(audio instanceof File) || audio.size === 0) return { note: null, error: "Nothing was recorded." };

  const admin = createAdminClient();
  const ext = audio.name.split(".").pop() || "webm";
  const path = `${trainee.id}/${Date.now()}.${ext}`;
  const { error: uploadError } = await admin.storage.from(NOTEBOOK_AUDIO_BUCKET).upload(path, audio, { contentType: audio.type || "audio/webm" });
  if (uploadError) {
    console.error("[portfolio/notebook-actions:saveVoiceNote upload]", uploadError);
    return { note: null, error: "Couldn't save the recording -- try again." };
  }

  const transcript = await transcribeAudio(audio, audio.name);
  const db = await notebookDb();
  const { data, error } = await db
    .from("trainee_notes")
    .insert({
      trainee_id: trainee.id,
      course_id: trainee.course_id,
      anchor_path: anchorPath,
      anchor_label: anchorLabel,
      body: transcript ?? "",
      audio_path: path,
      audio_duration_seconds: Number.isFinite(seconds) ? Math.round(seconds) : null,
    })
    .select("id, anchor_path, anchor_label, body, created_at, updated_at, audio_path, audio_duration_seconds")
    .single();
  if (error || !data) {
    console.error("[portfolio/notebook-actions:saveVoiceNote insert]", error);
    return { note: null, error: "Couldn't save the note -- try again." };
  }
  const { data: signed } = await admin.storage.from(NOTEBOOK_AUDIO_BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
  return { note: { ...(data as TraineeNote), audio_url: signed?.signedUrl ?? null }, error: null };
}

/** Signed playback URLs for the notes that carry a recording, for one page load. */
export async function signNotebookAudio(notes: TraineeNote[]): Promise<TraineeNote[]> {
  const admin = createAdminClient();
  return Promise.all(
    notes.map(async (n) => {
      if (!n.audio_path) return n;
      const { data } = await admin.storage.from(NOTEBOOK_AUDIO_BUCKET).createSignedUrl(n.audio_path, SIGNED_URL_SECONDS);
      return { ...n, audio_url: data?.signedUrl ?? null };
    })
  );
}
