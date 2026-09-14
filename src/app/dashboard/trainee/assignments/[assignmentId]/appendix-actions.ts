"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { APPENDIX_BUCKET } from "@/lib/assignment-appendices";

// Migration 0302. Typed since the drift check caught the table missing from
// src/lib/supabase/types.ts (14 Sep 2026) -- this used to go through an
// untyped handle. RLS is still what keeps an appendix the candidate's own and
// refuses it once the round has locked; the types just stop a typo reaching
// production.
async function appendixDb() {
  return createClient();
}

// Mirrors the file itself: the browser uploads straight to Storage (the 1MB
// Server Action body cap makes anything else a trap for a scanned worksheet),
// and only this small metadata row comes back through an action.
export async function attachAppendix(input: {
  assignmentId: string;
  round: "first" | "resubmission";
  label: string | null;
  storagePath?: string;
  linkUrl?: string;
  fileName: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
}): Promise<{ error: string | null }> {
  const trainee = await requireRole("trainee");
  const db = await appendixDb();

  const { error } = await db.from("assignment_appendices").insert({
    assignment_id: input.assignmentId,
    round: input.round,
    label: input.label,
    storage_path: input.storagePath ?? null,
    link_url: input.linkUrl ?? null,
    file_name: input.fileName,
    mime_type: input.mimeType ?? null,
    size_bytes: input.sizeBytes ?? null,
    uploaded_by: trainee.id,
  });

  if (error) {
    console.error("[trainee/assignments/appendix-actions:attachAppendix]", error);
    // The row was refused, so the file it points at is an orphan. Take it
    // back out rather than leave it billing storage for nothing.
    if (input.storagePath) await db.storage.from(APPENDIX_BUCKET).remove([input.storagePath]);
    return { error: "Could not attach that -- this assignment may already be submitted." };
  }

  revalidatePath(`/portfolio/${trainee.id}/assignments/${input.assignmentId}`);
  return { error: null };
}

export async function removeAppendix(input: {
  appendixId: string;
  assignmentId: string;
}): Promise<{ error: string | null }> {
  const trainee = await requireRole("trainee");
  const db = await appendixDb();

  const { data: row } = await db
    .from("assignment_appendices")
    .select("storage_path")
    .eq("id", input.appendixId)
    .maybeSingle();

  const { error } = await db.from("assignment_appendices").delete().eq("id", input.appendixId);
  if (error) {
    console.error("[trainee/assignments/appendix-actions:removeAppendix]", error);
    return { error: "Could not remove that -- this assignment may already be submitted." };
  }
  if (row?.storage_path) await db.storage.from(APPENDIX_BUCKET).remove([row.storage_path as string]);

  revalidatePath(`/portfolio/${trainee.id}/assignments/${input.assignmentId}`);
  return { error: null };
}

/**
 * A private bucket, so nothing is readable by URL alone. Both the candidate
 * and the tutor open an appendix through here, and the link they get is good
 * for ten minutes.
 */
export async function appendixDownloadUrl(storagePath: string): Promise<{ url: string | null; error: string | null }> {
  const db = await appendixDb();
  const { data, error } = await db.storage.from(APPENDIX_BUCKET).createSignedUrl(storagePath, 600);
  if (error || !data) {
    console.error("[trainee/assignments/appendix-actions:appendixDownloadUrl]", error);
    return { url: null, error: "Could not open that file." };
  }
  return { url: data.signedUrl, error: null };
}
