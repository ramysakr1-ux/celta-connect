import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// build-spec.md §14. "A referral is **not a re-application**. Everything the
// candidate has done moves with them."
//
// The candidate's own experience is the test of whether this is built right:
// "The candidate gets **one email that asks them for nothing** and never uses
// the words referred or transferred. Their next action is unchanged: wait for
// an offer."

/** Fields that travel. Everything the candidate did once, they never do twice. */
const CARRIED_FIELDS = [
  "full_name",
  "email",
  "phone",
  "date_of_birth",
  "education_summary",
  "elt_experience_summary",
  "special_requirements",
  "cannot_attend_note",
  "anything_else",
  // The task AND its mark -- "never re-marked".
  "writing_task_prompt_id",
  "writing_task_submission",
  "language_awareness_submission",
  "marking_language_awareness",
  "marking_language_awareness_note",
  "marking_accuracy",
  "marking_accuracy_note",
  "marking_organisation",
  "marking_organisation_note",
  "marking_range",
  "marking_range_note",
  // Acknowledgements the candidate already gave -- asking again would be
  // exactly the re-application this is not.
  "acknowledged_no_guarantee_at",
  "acknowledged_no_exemptions_at",
] as const;

export interface ReferralResult {
  error?: string;
  newApplicantId?: string;
}

/**
 * Refers a candidate to another branch in the same organisation.
 *
 * Deliberately NOT a move: the originating record stays and is marked referred
 * out, "so its conversion figures are not flattered by people who went
 * elsewhere in the family."
 *
 * A paid deposit does NOT travel -- "A paid deposit stays at the branch that
 * received it until finance moves it deliberately. Two branches are two sets of
 * books even inside one organisation." So none of the deposit_* fields are in
 * CARRIED_FIELDS, and that omission is load-bearing rather than accidental.
 */
export async function referApplicant(input: {
  applicantId: string;
  toCenterId: string;
  toCourseId: string;
  byProfileId: string;
  fromCenterId: string;
}): Promise<ReferralResult> {
  const admin = createAdminClient();

  const { data: applicant } = await admin
    .from("applicants")
    .select("*")
    .eq("id", input.applicantId)
    .eq("center_id", input.fromCenterId)
    .maybeSingle();
  if (!applicant) return { error: "That applicant isn't at this branch." };
  if (applicant.referred_to_center_id) return { error: "This candidate has already been referred." };

  // Both branches must belong to one organisation. Without this a referral
  // could send a candidate's file to any centre in the system.
  const { data: centres } = await admin
    .from("centers")
    .select("id, name, organisation_id")
    .in("id", [input.fromCenterId, input.toCenterId]);
  const from = (centres ?? []).find((c) => c.id === input.fromCenterId);
  const to = (centres ?? []).find((c) => c.id === input.toCenterId);
  if (!from || !to) return { error: "Could not find both branches." };
  if (!from.organisation_id || from.organisation_id !== to.organisation_id) {
    return { error: "Those branches aren't part of the same organisation." };
  }

  const carried: Record<string, unknown> = {
    center_id: input.toCenterId,
    intake_course_id: input.toCourseId,
    // "they arrive at Interviewed, not back at Enquiry"
    stage: applicant.stage,
    referred_from_applicant_id: applicant.id,
  };
  for (const f of CARRIED_FIELDS) {
    carried[f] = (applicant as Record<string, unknown>)[f];
  }

  const { data: created, error: insertError } = await admin
    .from("applicants")
    .insert(carried as never)
    .select("id")
    .single();
  if (insertError || !created) return { error: `Could not refer: ${insertError?.message ?? "unknown"}` };

  // Interview notes travel "attributed to who wrote them" -- the record is
  // copied with its author intact rather than re-attributed to the referrer.
  const { data: interview } = await admin
    .from("interview_records")
    .select("*")
    .eq("applicant_id", applicant.id)
    .maybeSingle();
  if (interview) {
    const copy = { ...(interview as Record<string, unknown>) };
    delete copy.id;
    copy.applicant_id = created.id;
    await admin.from("interview_records").insert(copy as never);
  }

  const { error: markError } = await admin
    .from("applicants")
    .update({
      referred_to_center_id: input.toCenterId,
      referred_at: new Date().toISOString(),
      referred_by: input.byProfileId,
    })
    .eq("id", applicant.id);
  if (markError) return { error: "Referred, but the originating record could not be marked." };

  return { newApplicantId: created.id };
}
