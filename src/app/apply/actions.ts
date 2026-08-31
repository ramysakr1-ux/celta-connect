"use server";

import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { inferCourseCommitmentsMode, buildCourseCommitments, courseCommitmentsToPlainText } from "@/lib/course-commitments";
import { MARKETING_SOURCES, type MarketingSource } from "@/lib/marketing-source";
import { transcribeAudio } from "@/lib/openai/transcribe";

// Public, unauthenticated, and every submission triggers a real AI triage
// call plus a real email to an attacker-controlled address -- 5 per hour
// per IP is generous for a genuine applicant (one course, one submission)
// while making scripted abuse expensive to sustain.
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

async function clientIp(): Promise<string> {
  const h = await headers();
  // Vercel sets x-forwarded-for with the real client IP first in the list.
  const forwardedFor = h.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}

export interface ApplyFormState {
  error: string | null;
  submitted: boolean;
}

// Public, unauthenticated write -- same pattern as join/[token]/actions.ts:
// no anonymous-write RLS policy exists on applicants (by design, see
// migration 0081), so this goes through the admin client after this
// action does its own validation, not a session-scoped client.
export async function submitApplication(_prevState: ApplyFormState, formData: FormData): Promise<ApplyFormState> {
  const centerId = formData.get("center_id");
  const intakeCourseId = formData.get("intake_course_id");
  const fullName = formData.get("full_name");
  const email = formData.get("email");

  if (
    typeof centerId !== "string" ||
    typeof intakeCourseId !== "string" ||
    typeof fullName !== "string" ||
    typeof email !== "string" ||
    !centerId ||
    !intakeCourseId ||
    !fullName ||
    !email
  ) {
    return { error: "Fill in your name, email, and which course you're applying for.", submitted: false };
  }

  if (
    !formData.get("ack_no_guarantee") ||
    !formData.get("ack_no_exemptions") ||
    !formData.get("ack_full_attendance") ||
    !formData.get("ack_writing_task") ||
    !formData.get("ack_commitments")
  ) {
    return { error: "You need to agree to all the acknowledgements to apply.", submitted: false };
  }

  const admin = createAdminClient();

  const ip = await clientIp();
  const { count: recentAttempts } = await admin
    .from("apply_ip_attempts")
    .select("*", { count: "exact", head: true })
    .eq("ip_address", ip)
    .gte("created_at", new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString());
  if ((recentAttempts ?? 0) >= RATE_LIMIT_MAX_ATTEMPTS) {
    return { error: "Too many attempts. Try again in an hour.", submitted: false };
  }
  await admin.from("apply_ip_attempts").insert({ ip_address: ip });

  const { data: course } = await admin
    .from("courses")
    .select("id, name, center_id, accepting_applications, delivery_mode, start_date, end_date")
    .eq("id", intakeCourseId)
    .maybeSingle();
  if (!course || course.center_id !== centerId || !course.accepting_applications) {
    return { error: "That course isn't open for applications right now. Refresh and try again.", submitted: false };
  }

  if (course.delivery_mode === "mixed" && !formData.get("ack_mixed_mode")) {
    return { error: "You need to acknowledge the mixed-mode teaching practice demand to apply.", submitted: false };
  }

  // No age gate here, deliberately.
  //
  // Handbook (June 2025) 7.3 reads: "applicants SHOULD BE SELECTED for the
  // course only if they meet the following entry requirements: applicants
  // must be at least 18. It is generally recommended that candidates should
  // be aged 20 or over, but candidates aged between 18 and 20 can be
  // accepted at the centre's discretion."
  //
  // That governs SELECTION -- who a centre may accept onto a course -- not
  // who may submit an application. I first built it as a refusal at this
  // form; Ramy: "it be flagged but not enforced. Check the handbook as well
  // first." Checking is what settled it: refusing the form is stricter than
  // Cambridge asks, and the same sentence carries the C1/C2 language level
  // and the computer-equipment requirement, neither of which this form
  // blocks on either. Flagging is the consistent treatment.
  //
  // So the age is recorded, and both bands are surfaced to the centre on the
  // applicant, where selection actually happens -- see celtaAgeBand() and
  // dashboard/admissions/[id]/page.tsx.

  // Recomputed server-side from the real course dates rather than trusted
  // from the client's hidden field -- what an applicant is recorded as
  // having accepted shouldn't depend on an unauthenticated form post being
  // honest about it.
  const commitmentsSnapshot = courseCommitmentsToPlainText(
    buildCourseCommitments(inferCourseCommitmentsMode(course.start_date, course.end_date))
  );

  const marketingSourceRaw = formData.get("marketing_source");
  const marketingSource: MarketingSource | null =
    typeof marketingSourceRaw === "string" && (MARKETING_SOURCES as readonly string[]).includes(marketingSourceRaw)
      ? (marketingSourceRaw as MarketingSource)
      : null;
  if (!marketingSource) {
    return { error: "Let us know how you heard about us.", submitted: false };
  }
  const marketingSourceOther =
    marketingSource === "other" ? ((formData.get("marketing_source_other") as string | null)?.trim() || null) : null;

  const writingTaskPromptId = (formData.get("writing_task_prompt_id") as string | null) || null;
  const writingTaskSubmission = (formData.get("writing_task_submission") as string | null)?.trim() || null;
  const languageAwarenessAnswer = (formData.get("language_awareness_answer") as string | null)?.trim() || null;
  const speakingTaskPromptId = (formData.get("speaking_task_prompt_id") as string | null) || null;
  const speakingTaskAudio = formData.get("speaking_task_audio");

  const { data: applicant, error: insertError } = await admin
    .from("applicants")
    .insert({
      center_id: centerId,
      intake_course_id: intakeCourseId,
      full_name: fullName,
      email,
      phone: (formData.get("phone") as string | null)?.trim() || null,
      date_of_birth: (formData.get("date_of_birth") as string | null) || null,
      education_summary: (formData.get("education_summary") as string | null)?.trim() || null,
      elt_experience_summary: (formData.get("elt_experience_summary") as string | null)?.trim() || null,
      special_requirements: (formData.get("special_requirements") as string | null)?.trim() || null,
      cannot_attend_note: (formData.get("cannot_attend_note") as string | null)?.trim() || null,
      marketing_source: marketingSource,
      marketing_source_other: marketingSourceOther,
      anything_else: (formData.get("anything_else") as string | null)?.trim() || null,
      acknowledged_no_guarantee_at: new Date().toISOString(),
      acknowledged_no_exemptions_at: new Date().toISOString(),
      acknowledged_full_attendance_at: new Date().toISOString(),
      acknowledged_mixed_mode_demand_at: course.delivery_mode === "mixed" ? new Date().toISOString() : null,
      commitments_accepted_at: new Date().toISOString(),
      commitments_snapshot: commitmentsSnapshot,
      writing_task_prompt_id: writingTaskPromptId,
      writing_task_submission: writingTaskSubmission,
      speaking_task_prompt_id: speakingTaskPromptId,
      language_awareness_submission: languageAwarenessAnswer
        ? [{ question: "Identify and correct the language errors in the passage provided.", answer: languageAwarenessAnswer }]
        : [],
      stage: "submitted",
    })
    .select("id")
    .single();

  if (insertError || !applicant) {
    return { error: "Could not submit your application. Try again.", submitted: false };
  }

  // Uploaded after the row exists -- the storage path is keyed off the
  // applicant's own id, same reasoning as volunteer-signup-audio (0089):
  // no session to sign a direct browser->Storage write, so this goes
  // through the admin client from here.
  if (speakingTaskAudio instanceof File && speakingTaskAudio.size > 0) {
    const storagePath = `${centerId}/${applicant.id}-${Date.now()}.${speakingTaskAudio.name.split(".").pop() ?? "webm"}`;
    const { error: uploadError } = await admin.storage.from("applicant-speaking-task-audio").upload(storagePath, speakingTaskAudio, {
      contentType: speakingTaskAudio.type || "audio/webm",
    });
    if (!uploadError) {
      // Ramy, 24 Aug 2026: reversed the earlier "reviewed directly by a
      // person, no transcript needed" call -- the actual reason this was
      // wanted in the first place is AI suggestions on the speaking task,
      // same as for-claude-code-speech-to-text-integration.md always said.
      // Best-effort, same as volunteer sign-up's identical call: a missing
      // OPENAI_API_KEY or a flaky API never blocks the application.
      const transcript = await transcribeAudio(speakingTaskAudio, speakingTaskAudio.name);
      await admin
        .from("applicants")
        .update({
          speaking_task_audio_url: storagePath,
          speaking_task_submitted_at: new Date().toISOString(),
          speaking_task_transcript: transcript,
          speaking_task_transcript_generated_at: transcript ? new Date().toISOString() : null,
        })
        .eq("id", applicant.id);
    }
    // A failed upload doesn't fail the whole application -- same
    // reasoning as the confirmation email below: the applicant's record
    // is already saved, and admissions staff can ask them to re-send a
    // recording rather than losing the application entirely.
  }

  // Shadow mode / triage (specs/for-claude-code-email-inventory.md Part 1):
  // both task parts are already in from the single application form above,
  // so this is the one moment a reading can run. No-ops entirely unless the
  // centre has turned shadow mode on; never blocks the application if it
  // fails, same reasoning as the speaking-task upload above.
  const { runSelectionTaskTriage } = await import("@/lib/admissions-ai-triage");
  await runSelectionTaskTriage(admin, applicant.id).catch(() => null);

  // "Notify the centre when an application is submitted -- with the
  // applicant's name, which intake they chose." Phase F builds the full
  // notification system (email + opt-outs); this is the one trigger point
  // simple enough to wire in now rather than leave the pipeline silent
  // until Phase F lands.
  await admin.from("admissions_notifications").insert({
    center_id: centerId,
    applicant_id: applicant.id,
    type: "submitted",
    message: `${fullName} applied for this intake.`,
  });

  // Ramy, 27 Aug 2026: "the right person gets pinged" -- email + push to
  // everyone holding admissions.manage at the centre, not just the silent
  // in-app row above. Never blocks the application on a delivery failure,
  // same reasoning as the AI triage call above.
  {
    const { notifyAdmissionsHandlers } = await import("@/lib/admissions-notify");
    const { applicationSubmittedEmailHtml } = await import("@/lib/admissions-email");
    const siteUrl = process.env.SITE_URL ?? "https://celtaconnect.com";
    const reviewUrl = `${siteUrl}/dashboard/admissions/${applicant.id}`;
    await notifyAdmissionsHandlers(admin, {
      centerId,
      applicantId: applicant.id,
      emailType: "application_submitted",
      subject: `New application -- ${fullName}`,
      pushBody: `${fullName} applied for ${course.name}.`,
      pushUrl: reviewUrl,
      buildEmailHtml: (recipientName) =>
        applicationSubmittedEmailHtml({ recipientName, applicantName: fullName, courseName: course.name, reviewUrl }),
    }).catch(() => null);
  }

  // "Form submitted -> A plain acknowledgement. Says nothing about the
  // outcome." Sent here rather than from a cron so it arrives while they're
  // still on the confirmation screen. Ramy, 26 Aug 2026: keep it generic --
  // "we'll be in touch shortly" -- rather than quoting a specific date.
  // Ramy, 28 Aug 2026, correcting his own earlier framing: "the
  // acknowledgement... gets to everybody. The difference is some receive
  // an interview appointment, and some receive a rejection." Confirmed:
  // this send is unconditional, on purpose -- the AI triage lane
  // (clear_problems) still drives the separate MCT notification
  // (notifyClearProblems, admissions-ai-triage.ts), it just never gates
  // this one.
  //
  // A failure to send is deliberately NOT surfaced to the applicant: their
  // application is already saved, and telling them "could not submit" because
  // an email bounced would be a lie that makes them apply twice. The failure is
  // recorded in applicant_emails either way, which is where admissions looks.
  const { data: centre } = await admin.from("centers").select("name, admissions_email").eq("id", centerId).maybeSingle();

  if (centre) {
    const { sendApplicantEmail, acknowledgementEmailHtml } = await import("@/lib/admissions-email");
    await sendApplicantEmail({
      centerName: centre.name,
      centerAdmissionsEmail: centre.admissions_email,
      to: email,
      subject: "We have your application",
      html: acknowledgementEmailHtml({ applicantName: fullName, courseName: course.name }),
      centerId,
      applicantId: applicant.id,
      type: "acknowledgement",
    });
  }

  return { error: null, submitted: true };
}
