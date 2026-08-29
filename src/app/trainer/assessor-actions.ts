"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { isMctOnCourse } from "@/lib/course-mct";
import { syncAssessorMeetingEvent } from "@/lib/assessor-day";
import { computeAssessorReadiness, buildCandidateCards } from "@/lib/assessor-pack";
import { joinLinkSender } from "@/lib/resend/client";
import { sendApplicantEmail } from "@/lib/admissions-email";
import { buildAssessorInviteEmailHtml } from "@/lib/assessor-invite-email";

// for-claude-code-assessor-pack-decisions.md §1: "Centres need a way to
// mark which candidates are 'selected for this visit'... a simple toggle."
// One candidate per submit, same auto-submit-on-change pattern as the
// Entry Form's "Mark as sent" checkbox -- no separate save step, each
// toggle is its own real write.
export async function toggleAssessorSelection(formData: FormData): Promise<void> {
  const trainer = await requireRole(["trainer", "admin"]);
  const traineeId = formData.get("trainee_id");
  const selected = formData.get("selected") === "true";
  if (typeof traineeId !== "string") return;

  const supabase = await createClient();
  const { data: trainee } = await supabase.from("profiles").select("id, course_id").eq("id", traineeId).maybeSingle();
  if (!trainee || trainee.course_id !== trainer.course_id) return;

  await supabase.from("profiles").update({ selected_for_assessor_visit: selected }).eq("id", traineeId);
  revalidatePath("/trainer/roster");
}

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
    supabase.from("centers").select("name, admissions_email").eq("id", trainer.center_id).maybeSingle(),
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

  // for-claude-code-email-delivery-tracking.md -- was a raw resend.emails.
  // send() call, untracked. Routed through sendApplicantEmail as
  // "assessor_pack" -- a type already declared in ApplicantEmailType/the
  // reply-to map per the original 19-email inventory, but never actually
  // wired to a real sender until now.
  const { error } = await sendApplicantEmail({
    centerName,
    centerAdmissionsEmail: center?.admissions_email ?? null,
    to: toEmail,
    subject: `assessment visit pack for ${course.name}`,
    html: buildAssessorInviteEmailHtml({
      centerName,
      courseName: course.name,
      visitDateLabel,
      totalCandidates: readiness.totalCandidates,
      potentialFails,
      accessEndsLabel,
      packUrl: `${siteUrl}/assessor/${token}`,
    }),
    centerId: trainer.center_id,
    applicantId: null,
    type: "assessor_pack",
    from: joinLinkSender(centerName),
  });
  if (error) return { error: "Could not send the email. Try copying the link instead.", sent: false };

  return { error: null, sent: true };
}

export interface AssessorContactState {
  error: string | null;
}

// for-claude-code-course-admin-landing-and-admissions.md §4: "a single
// field on the course record, writable by both the Course Administrator...
// and the MCT... whichever side sets it first is what the other side
// sees." This is the MCT-side write path -- same columns Course Admin's
// own Assessor card writes (dashboard/admin/courses/[id]/roster-actions.ts's
// updateAssessor/updateAssessorVisitDate), just reachable from inside the
// course once it's running, MCT-only (structural, course-level -- same
// reasoning as the rest of this session's MCT-only timetable gates).
export async function updateAssessorContact(_prevState: AssessorContactState, formData: FormData): Promise<AssessorContactState> {
  const trainer = await requireRole(["trainer", "admin"]);
  if (!trainer.course_id) return { error: "No course assigned." };

  const supabase = await createClient();
  if (trainer.role === "trainer" && !(await isMctOnCourse(supabase, trainer.course_id, trainer.id))) {
    return { error: "Only the main course tutor can set this." };
  }

  const assessorName = (formData.get("assessor_name") as string | null)?.trim() || null;
  const assessorEmail = (formData.get("assessor_email") as string | null)?.trim().toLowerCase() || null;
  const assessorVisitDate = (formData.get("assessor_visit_date") as string | null) || null;
  // Handbook 13.1's two kinds of visit. Only 'two_yearly' is accepted as a
  // deviation from the default, so a malformed or absent value lands on
  // 'regular' -- which is both the Handbook's own default and the safer
  // wrong answer for a centre preparing (it asks for fewer portfolios, so a
  // centre that under-declares finds out from the assessor, not the reverse).
  const assessmentKindRaw = formData.get("assessment_kind");
  const assessmentKind = assessmentKindRaw === "two_yearly" ? "two_yearly" : "regular";

  const { error } = await supabase
    .from("courses")
    .update({
      assessor_name: assessorName,
      assessor_email: assessorEmail,
      assessor_visit_date: assessorVisitDate,
      assessment_kind: assessmentKind,
    } as never)
    .eq("id", trainer.course_id);
  if (error) return { error: "Could not save. Try again." };

  // The candidates' half of the visit day, put on their timetable. Ramy, 30
  // Aug 2026: "we do include the assessor meeting, which is basically the
  // assessor meeting the trainees" -- and nothing was creating it, so the
  // announcement composer's day-offset anchoring had nothing to hang a
  // countdown on. See src/lib/assessor-day.ts; the grading meeting is
  // deliberately not timetabled.
  await syncAssessorMeetingEvent(supabase, trainer.course_id, assessorVisitDate);

  revalidatePath("/trainer");
  revalidatePath("/trainer/timetable");
  return { error: null };
}
