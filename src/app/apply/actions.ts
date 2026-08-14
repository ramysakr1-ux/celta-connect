"use server";

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

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
    !formData.get("ack_writing_task")
  ) {
    return { error: "You need to agree to all the acknowledgements to apply.", submitted: false };
  }

  const admin = createAdminClient();

  const { data: course } = await admin
    .from("courses")
    .select("id, center_id, accepting_applications, delivery_mode")
    .eq("id", intakeCourseId)
    .maybeSingle();
  if (!course || course.center_id !== centerId || !course.accepting_applications) {
    return { error: "That course isn't open for applications right now. Refresh and try again.", submitted: false };
  }

  if (course.delivery_mode === "mixed" && !formData.get("ack_mixed_mode")) {
    return { error: "You need to acknowledge the mixed-mode teaching practice demand to apply.", submitted: false };
  }

  const writingTaskPromptId = (formData.get("writing_task_prompt_id") as string | null) || null;
  const writingTaskSubmission = (formData.get("writing_task_submission") as string | null)?.trim() || null;
  const languageAwarenessAnswer = (formData.get("language_awareness_answer") as string | null)?.trim() || null;

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
      anything_else: (formData.get("anything_else") as string | null)?.trim() || null,
      acknowledged_no_guarantee_at: new Date().toISOString(),
      acknowledged_no_exemptions_at: new Date().toISOString(),
      acknowledged_mixed_mode_demand_at: course.delivery_mode === "mixed" ? new Date().toISOString() : null,
      writing_task_prompt_id: writingTaskPromptId,
      writing_task_submission: writingTaskSubmission,
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

  return { error: null, submitted: true };
}
