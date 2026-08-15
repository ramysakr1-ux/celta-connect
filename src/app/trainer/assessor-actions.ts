"use server";

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { computeAssessorReadiness } from "@/lib/assessor-pack";

export interface AssessorTokenResult {
  token: string | null;
  error: string | null;
  readinessIssues: string[] | null;
}

// Reuses whatever unexpired assessor token already exists for the course
// rather than minting a new one every time, same as the register-viewer
// link (getOrCreateRegisterViewToken). for-claude-code-assessor-
// interface.md: "it must check the pack is actually complete and name
// what isn't ... it should refuse quietly rather than export a gap" --
// the check is bypassable only by re-running once the named issues are
// actually fixed, not by a force flag.
export async function getOrCreateAssessorToken(): Promise<AssessorTokenResult> {
  const trainer = await requireRole(["trainer", "admin"]);
  if (!trainer.course_id) return { token: null, error: "No course assigned.", readinessIssues: null };

  const supabase = await createClient();

  // Reusing an already-minted link is just "copy it again" -- the pack was
  // already exported once, the readiness gate below only applies to
  // actually creating a NEW export/link.
  const { data: existing } = await supabase
    .from("course_access_tokens")
    .select("token")
    .eq("course_id", trainer.course_id)
    .eq("role", "assessor")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (existing) return { token: existing.token, error: null, readinessIssues: null };

  const readiness = await computeAssessorReadiness(supabase, trainer.course_id);
  if (!readiness.ready) {
    return {
      token: null,
      error: "Some portfolios aren't complete yet.",
      readinessIssues: readiness.issues.map((i) => `${i.traineeName}: ${i.reason}`),
    };
  }

  const { data: course } = await supabase.from("courses").select("end_date").eq("id", trainer.course_id).maybeSingle();
  if (!course) return { token: null, error: "Could not find your course.", readinessIssues: null };

  const expiresAt = new Date(`${course.end_date}T23:59:59Z`).toISOString();
  const { data: created, error } = await supabase
    .from("course_access_tokens")
    .insert({ course_id: trainer.course_id, role: "assessor", expires_at: expiresAt })
    .select("token")
    .single();

  if (error || !created) return { token: null, error: "Could not create the link. Try again.", readinessIssues: null };
  return { token: created.token, error: null, readinessIssues: null };
}
