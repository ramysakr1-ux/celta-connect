import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendApplicantEmail, referralEmailHtml } from "@/lib/admissions-email";

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
    .select("id, name, organisation_id, admissions_email")
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

  // "The candidate gets one email that asks them for nothing and never uses
  // the words referred or transferred." Sent here, not by each caller, so
  // the direct-referral path and the accepted-request path can't diverge.
  // Best-effort: a failed send shouldn't undo a referral that already
  // succeeded -- same tolerance sendApplicantEmail's own callers show
  // elsewhere in this app.
  await sendApplicantEmail({
    centerName: to.name,
    centerAdmissionsEmail: to.admissions_email ?? null,
    to: applicant.email,
    subject: "your application",
    centerId: input.toCenterId,
    applicantId: created.id,
    type: "referral",
    sentBy: input.byProfileId,
    recipientName: applicant.full_name,
    html: referralEmailHtml({ candidateName: applicant.full_name, centreName: to.name }),
  });

  return { newApplicantId: created.id };
}

export interface ReferralRequestResult {
  error?: string;
  requestId?: string;
}

/**
 * "Where nobody spans the two, it becomes a request the receiving branch
 * accepts." Unlike referApplicant(), this moves nothing yet -- it just asks.
 * The destination course is chosen by whoever ACCEPTS, not the requester,
 * since the requester typically has no visibility into the destination
 * branch's own intakes.
 */
export async function requestBranchReferral(input: {
  applicantId: string;
  fromCenterId: string;
  toCenterId: string;
  byProfileId: string;
}): Promise<ReferralRequestResult> {
  const admin = createAdminClient();

  const { data: applicant } = await admin
    .from("applicants")
    .select("id, full_name, referred_to_center_id")
    .eq("id", input.applicantId)
    .eq("center_id", input.fromCenterId)
    .maybeSingle();
  if (!applicant) return { error: "That applicant isn't at this branch." };
  if (applicant.referred_to_center_id) return { error: "This candidate has already been referred." };

  const { data: existing } = await admin
    .from("branch_referral_requests")
    .select("id, status")
    .eq("applicant_id", input.applicantId)
    .maybeSingle();
  if (existing) return { error: `A referral request for this candidate already exists (${existing.status}).` };

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

  const { data: created, error: insertError } = await admin
    .from("branch_referral_requests")
    .insert({
      applicant_id: input.applicantId,
      from_center_id: input.fromCenterId,
      to_center_id: input.toCenterId,
      requested_by: input.byProfileId,
    } as never)
    .select("id")
    .single();
  if (insertError || !created) return { error: `Could not send the request: ${insertError?.message ?? "unknown"}` };

  // "The area owner is notified. Not a request for permission -- a
  // statement" -- same reasoning applied to a receiving branch that hasn't
  // asked for this candidate but needs to know one is waiting.
  const referralMessage = `${from.name} is asking to refer ${applicant.full_name} to your branch.`;
  await admin.from("admissions_notifications").insert({
    center_id: input.toCenterId,
    applicant_id: input.applicantId,
    type: "referral_request",
    message: referralMessage,
  } as never);
  {
    const { notifyAdmissionsHandlers } = await import("@/lib/admissions-notify");
    const { referralRequestStaffEmailHtml } = await import("@/lib/admissions-email");
    await notifyAdmissionsHandlers(admin, {
      centerId: input.toCenterId,
      applicantId: input.applicantId,
      emailType: "referral_request_notify",
      subject: `Referral request -- ${applicant.full_name}`,
      pushBody: referralMessage,
      pushUrl: `${process.env.SITE_URL ?? "https://celtaconnect.com"}/dashboard/admissions/referral-requests`,
      buildEmailHtml: (recipientName) => referralRequestStaffEmailHtml({ recipientName, message: referralMessage, reviewUrl: null }),
    }).catch(() => null);
  }

  return { requestId: created.id };
}

export interface AcceptReferralResult {
  error?: string;
  newApplicantId?: string;
}

export async function acceptBranchReferralRequest(input: {
  requestId: string;
  toCourseId: string;
  byProfileId: string;
}): Promise<AcceptReferralResult> {
  const admin = createAdminClient();

  const { data: request } = await admin
    .from("branch_referral_requests")
    .select("*")
    .eq("id", input.requestId)
    .maybeSingle();
  if (!request) return { error: "That referral request no longer exists." };
  if (request.status !== "pending") return { error: `That request has already been ${request.status}.` };

  const result = await referApplicant({
    applicantId: request.applicant_id,
    fromCenterId: request.from_center_id,
    toCenterId: request.to_center_id,
    toCourseId: input.toCourseId,
    byProfileId: input.byProfileId,
  });
  if (result.error) return { error: result.error };

  const { error: updateError } = await admin
    .from("branch_referral_requests")
    .update({
      status: "accepted",
      decided_by: input.byProfileId,
      decided_at: new Date().toISOString(),
      resulting_applicant_id: result.newApplicantId,
    })
    .eq("id", request.id);
  if (updateError) return { error: "Referred, but the request record could not be updated." };

  return { newApplicantId: result.newApplicantId };
}

export async function declineBranchReferralRequest(input: {
  requestId: string;
  byProfileId: string;
  reason?: string | null;
}): Promise<{ error?: string }> {
  const admin = createAdminClient();

  const { data: request } = await admin
    .from("branch_referral_requests")
    .select("id, status, from_center_id, to_center_id, applicant_id")
    .eq("id", input.requestId)
    .maybeSingle();
  if (!request) return { error: "That referral request no longer exists." };
  if (request.status !== "pending") return { error: `That request has already been ${request.status}.` };

  const { error: updateError } = await admin
    .from("branch_referral_requests")
    .update({
      status: "declined",
      decided_by: input.byProfileId,
      decided_at: new Date().toISOString(),
      decline_reason: input.reason ?? null,
    })
    .eq("id", request.id);
  if (updateError) return { error: "Could not decline the request." };

  const { data: to } = await admin.from("centers").select("name").eq("id", request.to_center_id).maybeSingle();
  const declineMessage = `${to?.name ?? "The branch"} declined your referral request.`;
  await admin.from("admissions_notifications").insert({
    center_id: request.from_center_id,
    applicant_id: request.applicant_id,
    type: "referral_request",
    message: declineMessage,
  } as never);
  {
    const { notifyAdmissionsHandlers } = await import("@/lib/admissions-notify");
    const { referralRequestStaffEmailHtml } = await import("@/lib/admissions-email");
    await notifyAdmissionsHandlers(admin, {
      centerId: request.from_center_id,
      applicantId: request.applicant_id,
      emailType: "referral_request_notify",
      subject: "Referral request declined",
      pushBody: declineMessage,
      pushUrl: `${process.env.SITE_URL ?? "https://celtaconnect.com"}/dashboard/admissions/referral-requests`,
      buildEmailHtml: (recipientName) => referralRequestStaffEmailHtml({ recipientName, message: declineMessage, reviewUrl: null }),
    }).catch(() => null);
  }

  return {};
}
