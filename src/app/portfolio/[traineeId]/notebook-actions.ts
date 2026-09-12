"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

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
