"use server";

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { computeAssessorReadiness, buildCandidateCards } from "@/lib/assessor-pack";
import { createResendClient, joinLinkSender } from "@/lib/resend/client";
import { buildAssessorInviteEmailHtml } from "@/lib/assessor-invite-email";

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

export interface SendAssessorEmailState {
  error: string | null;
  sent: boolean;
}

// The welcome email (email #18, design_handoff_all_emails). Reuses the
// exact same readiness-gated token as the copy-link button above -- an
// emailed pack and a copied link point at the same access, so they share
// the same gate.
export async function sendAssessorInviteEmail(
  _prevState: SendAssessorEmailState,
  formData: FormData
): Promise<SendAssessorEmailState> {
  const trainer = await requireRole(["trainer", "admin"]);
  if (!trainer.course_id) return { error: "No course assigned.", sent: false };

  const toEmail = formData.get("email");
  if (typeof toEmail !== "string" || !toEmail.includes("@")) {
    return { error: "Enter a valid email address.", sent: false };
  }

  const { token, error: tokenError, readinessIssues } = await getOrCreateAssessorToken();
  if (!token) {
    return {
      error: readinessIssues && readinessIssues.length > 0 ? "Some portfolios aren't complete yet." : (tokenError ?? "Could not create the link."),
      sent: false,
    };
  }

  const siteUrl = process.env.SITE_URL;
  if (!siteUrl) return { error: "SITE_URL is missing from .env.local.", sent: false };

  const supabase = await createClient();
  const [{ data: course }, { data: center }, readiness, candidates] = await Promise.all([
    supabase.from("courses").select("name, end_date, assessor_visit_date").eq("id", trainer.course_id).maybeSingle(),
    supabase.from("centers").select("name").eq("id", trainer.center_id).maybeSingle(),
    computeAssessorReadiness(supabase, trainer.course_id),
    buildCandidateCards(supabase, trainer.course_id),
  ]);
  if (!course) return { error: "Could not find your course.", sent: false };

  const centerName = center?.name ?? "Your centre";
  const potentialFails = candidates.filter((c) => c.provisionalLabel?.includes("Fail")).length;
  const visitDateLabel = course.assessor_visit_date
    ? new Date(`${course.assessor_visit_date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })
    : null;
  const accessEndsLabel = `When the course closes, ${new Date(`${course.end_date}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;

  try {
    const resend = createResendClient();
    const { error } = await resend.emails.send({
      from: joinLinkSender(centerName),
      to: toEmail,
      subject: `${centerName} · assessment visit pack for ${course.name}`,
      html: buildAssessorInviteEmailHtml({
        centerName,
        courseName: course.name,
        visitDateLabel,
        totalCandidates: readiness.totalCandidates,
        potentialFails,
        accessEndsLabel,
        packUrl: `${siteUrl}/assessor/${token}`,
      }),
    });
    if (error) return { error: "Could not send the email. Try copying the link instead.", sent: false };
  } catch {
    return { error: "Could not send the email. Try copying the link instead.", sent: false };
  }

  return { error: null, sent: true };
}
