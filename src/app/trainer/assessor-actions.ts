"use server";

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

// Reuses whatever unexpired assessor token already exists for the course
// rather than minting a new one every time, same as the register-viewer
// link (getOrCreateRegisterViewToken).
export async function getOrCreateAssessorToken(): Promise<{ token: string | null; error: string | null }> {
  const trainer = await requireRole("trainer");
  if (!trainer.course_id) return { token: null, error: "No course assigned." };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("course_access_tokens")
    .select("token")
    .eq("course_id", trainer.course_id)
    .eq("role", "assessor")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (existing) return { token: existing.token, error: null };

  const { data: course } = await supabase.from("courses").select("end_date").eq("id", trainer.course_id).maybeSingle();
  if (!course) return { token: null, error: "Could not find your course." };

  const expiresAt = new Date(`${course.end_date}T23:59:59Z`).toISOString();
  const { data: created, error } = await supabase
    .from("course_access_tokens")
    .insert({ course_id: trainer.course_id, role: "assessor", expires_at: expiresAt })
    .select("token")
    .single();

  if (error || !created) return { token: null, error: "Could not create the link. Try again." };
  return { token: created.token, error: null };
}
