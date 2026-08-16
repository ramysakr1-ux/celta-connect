import "server-only";
import { createResendClient } from "@/lib/resend/client";

// "Every email is from the centre... sender is the centre's name, reply-to
// is a centre address. Connect never appears in anyone's inbox." The
// verified sending domain stays celtaconnect.com (Resend needs a verified
// domain), but the visible display name is the centre's own -- nowhere in
// the recipient's inbox does the word "Connect" appear. Reply-to is the
// centre's real admissions address when one's configured; falls back to
// the sending address (still no "Connect" branding visible) otherwise.
export type ApplicantEmailType =
  // Applying
  | "acknowledgement"
  | "task_waiting"
  | "interview_invitation"
  // The decision
  | "offer"
  | "rejection"
  | "rejection_after_interview"
  | "waiting_list"
  | "not_this_time"
  | "place_freed"
  // Before the course
  | "welcome"
  | "starts_monday"
  | "late_enrolment"
  // Staff and assessor
  | "tutor_added"
  | "centre_created"
  | "interview_booked"
  | "reading_flagged"
  | "assessor_pack"
  // Volunteers
  | "volunteer_signed_up"
  | "volunteer_class_starting";

/**
 * Who a reply reaches. All Emails.dc.html gives every email exactly one of
 * three, and the distinction is not cosmetic:
 *
 * - `noreply`  "Do not reply - sent automatically"
 * - `admissions`  "Replies go to admissions"
 * - `tutor`  "Replies go to the tutor who wrote it"
 *
 * The third exists for the two rejections. A rejection is "the centre's reason
 * in the tutor's own words, and what would change it" -- so a reply asking
 * "what did you mean?" has to reach the person who wrote that sentence, not a
 * shared inbox where it becomes nobody's job.
 */
export type EmailReplyTo = "noreply" | "admissions" | "tutor";

/** The rule per email, from the inventory. Not a caller's choice to make. */
export const EMAIL_REPLY_TO: Record<ApplicantEmailType, EmailReplyTo> = {
  acknowledgement: "noreply",
  task_waiting: "noreply",
  interview_invitation: "admissions",
  offer: "admissions",
  rejection: "tutor",
  rejection_after_interview: "tutor",
  waiting_list: "admissions",
  not_this_time: "admissions",
  place_freed: "admissions",
  welcome: "noreply",
  starts_monday: "tutor",
  late_enrolment: "tutor",
  tutor_added: "noreply",
  centre_created: "noreply",
  interview_booked: "noreply",
  reading_flagged: "noreply",
  assessor_pack: "admissions",
  volunteer_signed_up: "noreply",
  volunteer_class_starting: "admissions",
};

export async function sendApplicantEmail(input: {
  centerName: string;
  centerAdmissionsEmail: string | null;
  to: string;
  subject: string;
  html: string;
  // Logging context. Optional only so an unrelated future caller can't be
  // blocked from sending -- but every caller in the app passes them, and
  // without them the send simply isn't recorded.
  centerId?: string;
  applicantId?: string | null;
  type?: ApplicantEmailType;
  sentBy?: string | null;
  /**
   * Needed only by the emails whose rule is "replies go to the tutor who wrote
   * it" -- the two rejections and the two course emails. If the rule wants a
   * tutor and none is passed, the send falls back to admissions rather than
   * dropping the reply on the floor.
   */
  tutorEmail?: string | null;
  /** For staff and volunteer emails, which have no applicant row to name. */
  recipientName?: string | null;
}): Promise<{ error: string | null }> {
  // "After **two consecutive bounces** to the same address, Connect stops
  // sending and requires a new address." Checked before sending rather than
  // after, because the point is to stop mail leaving for an address already
  // known to be dead. The bounce that matters most is a workspace invitation
  // to a paid-up candidate -- a person with no way into the course they've
  // paid for -- so this refuses loudly rather than silently dropping it.
  if (input.centerId) {
    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const { data: task } = await createAdminClient()
        .from("email_bounce_tasks")
        .select("consecutive_bounces, reason")
        .eq("center_id", input.centerId)
        .eq("email_address", input.to)
        .is("resolved_at", null)
        .maybeSingle();
      if (task && task.consecutive_bounces >= 2) {
        return {
          error: `Mail to ${input.to} has bounced twice (${task.reason ?? "no reason given"}). Connect won't send there again until the address is corrected.`,
        };
      }
    } catch {
      // A lookup failure must not block a send -- refusing to email because we
      // couldn't check is worse than sending one that may bounce.
    }
  }

  // "All the emails should lead with the centre name" (Ramy, 2026-08-16).
  // Applied here rather than at each call site for the same reason the
  // reply-to rule is: nineteen callers each remembering to prefix a string is
  // nineteen chances to forget, and the one that forgets is the one that lands
  // in a stranger's inbox with no clue who it is from.
  //
  // full-email-specs.md writes it as "Meridian English Centre · your CELTA
  // application". Some of its sample subjects lead with the course instead;
  // the instruction above settles those -- every email leads with the centre.
  //
  // Skipped when the subject already starts with the centre's name, so a
  // caller that spells it out in full doesn't produce "Centre · Centre · ...".
  const leadsWithCentre = input.subject.trim().toLowerCase().startsWith(input.centerName.trim().toLowerCase());
  const subject = leadsWithCentre ? input.subject : `${input.centerName} · ${input.subject}`;

  // Which of the three rules applies. Derived from the email's type rather
  // than passed in, so a caller cannot accidentally send a rejection that
  // replies to a shared inbox.
  const rule: EmailReplyTo = input.type ? EMAIL_REPLY_TO[input.type] : "admissions";
  const replyTo =
    rule === "noreply"
      ? undefined
      : rule === "tutor"
        ? (input.tutorEmail ?? input.centerAdmissionsEmail ?? undefined)
        : (input.centerAdmissionsEmail ?? undefined);

  let failure: string | null = null;
  let providerMessageId: string | null = null;
  try {
    const resend = createResendClient();
    const { data, error } = await resend.emails.send({
      from: `${input.centerName} <noreply@celtaconnect.com>`,
      to: input.to,
      replyTo,
      subject,
      html: input.html,
    });
    failure = error ? error.message : null;
    // Kept so the delivery webhook can find this row later.
    providerMessageId = data?.id ?? null;
  } catch (err) {
    failure = err instanceof Error ? err.message : "Could not send the email.";
  }

  // Logged here rather than at each call site so a new email type cannot
  // forget to record itself -- and failures are logged too, since a bounced
  // email is exactly the one a centre needs to see. Never throws: a logging
  // problem must not turn a sent email into a reported failure.
  if (input.centerId && input.type) {
    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      await createAdminClient().from("applicant_emails").insert({
        center_id: input.centerId,
        applicant_id: input.applicantId ?? null,
        type: input.type,
        to_email: input.to,
        recipient_name: input.recipientName ?? null,
        subject,
        // "sent" means the provider accepted it and nothing more -- delivered,
        // opened and bounced arrive later from the webhook.
        status: failure ? "failed" : "sent",
        error: failure,
        provider_message_id: providerMessageId,
        sent_by: input.sentBy ?? null,
      });
    } catch {
      // Deliberately swallowed -- see above.
    }
  }

  return { error: failure };
}

export function offerEmailHtml(input: {
  applicantName: string;
  courseName: string;
  feeAmount: number | null;
  feeCurrency: string | null;
  acceptBy: string;
  offerUrl: string;
}): string {
  return `
    <p>Dear ${input.applicantName},</p>
    <p>We're pleased to offer you a place on ${input.courseName}.</p>
    ${input.feeAmount ? `<p>The course fee is ${input.feeAmount} ${input.feeCurrency}.</p>` : ""}
    <p>To confirm your place, set up your account, and receive your pre-course task, follow this link by ${input.acceptBy}:</p>
    <p><a href="${input.offerUrl}">${input.offerUrl}</a></p>
    <p>If we don't hear from you by then, we'll assume the place is no longer needed and offer it to someone else.</p>
  `;
}

export function rejectionEmailHtml(input: { applicantName: string; courseName: string; reason: string }): string {
  return `
    <p>Dear ${input.applicantName},</p>
    <p>Thank you for applying to ${input.courseName}. We're not able to offer you a place at this time.</p>
    <p>${input.reason}</p>
    <p>This isn't final, and we'd welcome a future application if the above changes.</p>
  `;
}

// "Position, the course, and a date by which they will hear either way.
// Without that date it is just an unanswered application." Sent once, when
// added to the list -- not the "place has come free" email below.
export function waitingListEmailHtml(input: { applicantName: string; courseName: string; position: number; hearBy: string }): string {
  return `
    <p>Dear ${input.applicantName},</p>
    <p>${input.courseName} is full, but we're keeping your application on our waiting list -- you're currently number ${input.position}.</p>
    <p>You'll hear from us either way by ${input.hearBy}. Your application and any task or interview you've already completed stay on file, so you won't need to repeat them.</p>
    <p>If a place frees up before then, we'll be in touch straight away.</p>
  `;
}

// "A named day and hour, not a number of days... the button carries the
// countdown." Reuses the same /offer/[token] link and accept flow as a
// fresh offer -- accepting this literally is accepting the offer.
export function placeFreedEmailHtml(input: { applicantName: string; courseName: string; expiresAt: string; offerUrl: string }): string {
  return `
    <p>Dear ${input.applicantName},</p>
    <p>A place has come free on ${input.courseName}, and you're next on our waiting list.</p>
    <p>To confirm your place, set up your account, and receive your pre-course task, follow this link by <strong>${input.expiresAt}</strong>:</p>
    <p><a href="${input.offerUrl}">${input.offerUrl}</a></p>
    <p>If we don't hear from you by then, we'll offer the place to the next person on the list. Declining costs you nothing -- your application carries forward to the next intake, with your task and interview still on file.</p>
  `;
}

// "Sends automatically when the waiting-list deadline passes with no place
// freed... apologises, explains that the course filled, and carries them
// to the next intake unless they opt out." No human sentence -- nobody is
// being judged, so unlike the two rejection emails this is never gated on
// a written reason.
export function notThisTimeEmailHtml(input: { applicantName: string; courseName: string }): string {
  return `
    <p>Dear ${input.applicantName},</p>
    <p>We're sorry -- ${input.courseName} filled before a place came free for you from the waiting list.</p>
    <p>This isn't a reflection on your application. We'll carry your details forward and be in touch about our next intake, unless you'd rather we didn't -- just reply to let us know.</p>
  `;
}

// ---------------------------------------------------------------------------
// The rest of the nineteen, from All Emails.dc.html. Each carries what the
// inventory's "carries" column names -- those aren't decoration: an email whose
// job is to give a date and doesn't give one has failed, however polite it is.
// ---------------------------------------------------------------------------

// "A plain acknowledgement. Says nothing about the outcome and gives a date by
// which they will hear." The silence about outcome is the point -- this fires
// on form submission, before anyone has read anything.
export function acknowledgementEmailHtml(input: {
  applicantName: string;
  courseName: string;
  hearBy: string;
}): string {
  return `
    <p>Dear ${input.applicantName},</p>
    <p>Thank you for applying to ${input.courseName}. This is just to confirm your application reached us.</p>
    <p>We'll be in touch by <strong>${input.hearBy}</strong>. If you don't hear from us by then, please do chase us.</p>
    <p>This message is automatic -- there's nothing you need to do in reply.</p>
  `;
}

// NOT SENT ON ITS OWN. Ramy, 2026-08-16: "The task is sent with the acceptance
// email and the link -- so once they get the link, they also get the task."
//
// Kept as a function because the wording still has to appear somewhere: it
// becomes a section inside the workspace-invitation email rather than a
// nineteenth message of its own. Sending it separately would mean two emails
// arriving minutes apart, each telling the candidate to go and do something.
//
// This also closes the gap that made it unsendable anyway -- there was no
// moment in the app where a task "became ready", because the writing task is
// part of the application form.
export function taskWaitingEmailHtml(input: {
  applicantName: string;
  courseName: string;
  taskUrl: string;
}): string {
  return `
    <p>Dear ${input.applicantName},</p>
    <p>Your pre-interview task for ${input.courseName} is ready.</p>
    <p><a href="${input.taskUrl}">${input.taskUrl}</a></p>
    <p>It saves as you type, so you can stop and come back to it. There's no time limit once you start.</p>
  `;
}

// "Sent fifteen minutes after a clear reading, or by hand after a tutor
// decides. Carries times." The fifteen-minute hold is the AI-triage window --
// this email is what it releases.
export function interviewInvitationEmailHtml(input: {
  applicantName: string;
  courseName: string;
  bookingUrl: string;
  slots: string[];
}): string {
  return `
    <p>Dear ${input.applicantName},</p>
    <p>Thank you for completing your task for ${input.courseName}. We'd like to invite you to an interview.</p>
    ${
      input.slots.length
        ? `<p>These times are currently free:</p><ul>${input.slots.map((s) => `<li>${s}</li>`).join("")}</ul>`
        : ""
    }
    <p>Choose a time here:</p>
    <p><a href="${input.bookingUrl}">${input.bookingUrl}</a></p>
    <p>Your slot is held for 48 hours. If none of these work, reply and we'll find another.</p>
  `;
}

// "Same shape, written after meeting them, so it can be specific about the
// conversation." Distinct from the after-task rejection because this one can
// and should refer to what was actually said -- and because it replies to the
// tutor who wrote it.
export function rejectionAfterInterviewEmailHtml(input: {
  applicantName: string;
  courseName: string;
  reason: string;
  tutorName: string;
}): string {
  return `
    <p>Dear ${input.applicantName},</p>
    <p>Thank you for coming to interview for ${input.courseName}, and for the time you gave it. I'm sorry to say we're not able to offer you a place.</p>
    <p>${input.reason}</p>
    <p>You'd be welcome to apply again once that's in place -- a previous application is never held against you. If you'd like to talk any of this through, reply to this email and it comes straight to me.</p>
    <p>${input.tutorName}</p>
  `;
}

// "Group, level, the day-one activity, and the practical details. The only
// email in the fortnight before." That last clause is a constraint on everyone
// else, not a feature of this email.
export function startsMondayEmailHtml(input: {
  candidateName: string;
  courseName: string;
  startDate: string;
  groupName: string | null;
  level: string | null;
  firstActivity: string | null;
  practicalDetails: string | null;
  tutorName: string;
}): string {
  return `
    <p>Dear ${input.candidateName},</p>
    <p>${input.courseName} starts on <strong>${input.startDate}</strong>. Here's what you need for day one.</p>
    ${input.groupName ? `<p><strong>Your group:</strong> ${input.groupName}${input.level ? ` (teaching ${input.level})` : ""}</p>` : ""}
    ${input.firstActivity ? `<p><strong>First activity:</strong> ${input.firstActivity}</p>` : ""}
    ${input.practicalDetails ? `<p><strong>Practical details:</strong> ${input.practicalDetails}</p>` : ""}
    <p>Anything you're unsure about, reply to this and it reaches me directly.</p>
    <p>${input.tutorName}</p>
  `;
}

// "For somebody accepted days before. Says plainly which of the pre-course work
// is now optional." Without this they arrive on Monday having tried to do four
// weeks of preparation in three days, or having done none and assuming they're
// already behind.
export function lateEnrolmentEmailHtml(input: {
  candidateName: string;
  courseName: string;
  startDate: string;
  skipItems: string[];
  tutorName: string;
}): string {
  return `
    <p>Dear ${input.candidateName},</p>
    <p>Welcome to ${input.courseName} -- you're joining us on <strong>${input.startDate}</strong>, which is soon, so let me be direct about what matters between now and then.</p>
    ${
      input.skipItems.length
        ? `<p><strong>You can safely skip:</strong></p><ul>${input.skipItems.map((s) => `<li>${s}</li>`).join("")}</ul><p>These are useful, not required. Nobody will ask you about them and you're not behind for having skipped them.</p>`
        : ""
    }
    <p>I'm your point of contact for the first week. Reply to this email with anything at all -- it comes to me, not a shared inbox.</p>
    <p>${input.tutorName}</p>
  `;
}

// "Names the course, the groups and the dates. Staff terms are accepted once
// per centre, not per course." The getting-started guide is linked here because
// the recipient has no account yet -- for-claude-code-getting-started-doc.md:
// "it must stand alone with no app around it."
export function tutorAddedEmailHtml(input: {
  tutorName: string;
  courseName: string;
  groups: string[];
  dates: string;
  inviteUrl: string;
  gettingStartedUrl: string;
  needsStaffTerms: boolean;
}): string {
  return `
    <p>Dear ${input.tutorName},</p>
    <p>You've been added as a tutor on ${input.courseName}, running ${input.dates}.</p>
    ${input.groups.length ? `<p><strong>Your groups:</strong> ${input.groups.join(", ")}</p>` : ""}
    <p>Set up your access here:</p>
    <p><a href="${input.inviteUrl}">${input.inviteUrl}</a></p>
    ${input.needsStaffTerms ? `<p>You'll be asked to accept the staff terms once. That's per centre, not per course -- you won't be asked again for your next course here.</p>` : ""}
    <p>If you'd like to read up before you log in, everything worth knowing is here: <a href="${input.gettingStartedUrl}">${input.gettingStartedUrl}</a></p>
  `;
}

// "The first login for a centre. What to do first: connect storage, import
// briefs." A centre with nothing connected can't export a closed course, so the
// order in this email is the order that avoids a problem later.
export function centreCreatedEmailHtml(input: {
  adminName: string;
  centreName: string;
  inviteUrl: string;
  gettingStartedUrl: string;
}): string {
  return `
    <p>Dear ${input.adminName},</p>
    <p>${input.centreName} is set up. This link creates your account:</p>
    <p><a href="${input.inviteUrl}">${input.inviteUrl}</a></p>
    <p>Two things worth doing first:</p>
    <ol>
      <li><strong>Connect your storage.</strong> Everything a closed course exports goes to your own Drive, so this needs to exist before your first course closes, not after.</li>
      <li><strong>Import your existing records.</strong> Any spreadsheet, any column order -- you'll see the whole import before anything is written, and nobody is emailed.</li>
    </ol>
    <p>You'll be asked to accept the centre agreement once, when you first sign in.</p>
    <p>Before you start, this covers the seven things that come up most: <a href="${input.gettingStartedUrl}">${input.gettingStartedUrl}</a></p>
  `;
}

// "To whoever holds admissions and to the named interviewer, with a link to the
// marked task." Both recipients, because the interviewer needs to prepare and
// admissions needs to know the slot went.
export function interviewBookedEmailHtml(input: {
  recipientName: string;
  applicantName: string;
  courseName: string;
  when: string;
  markedTaskUrl: string;
}): string {
  return `
    <p>Dear ${input.recipientName},</p>
    <p>An interview has been booked with <strong>${input.applicantName}</strong> for ${input.courseName}.</p>
    <p><strong>When:</strong> ${input.when}</p>
    <p>Their marked task is here: <a href="${input.markedTaskUrl}">${input.markedTaskUrl}</a></p>
    <p>This is an automatic notification -- the booking is already in Connect, so there's nothing to confirm.</p>
  `;
}

// "Sent when a reading finds clear problems. No email goes to the applicant."
// The second sentence is the important one and belongs in the email itself: the
// tutor must know the applicant is sitting in silence, waiting on them.
export function readingFlaggedEmailHtml(input: {
  tutorName: string;
  applicantName: string;
  courseName: string;
  flags: string[];
  reviewUrl: string;
}): string {
  return `
    <p>Dear ${input.tutorName},</p>
    <p>An application for ${input.courseName} needs a person to look at it -- <strong>${input.applicantName}</strong>.</p>
    ${input.flags.length ? `<p><strong>What was flagged:</strong></p><ul>${input.flags.map((f) => `<li>${f}</li>`).join("")}</ul>` : ""}
    <p><a href="${input.reviewUrl}">${input.reviewUrl}</a></p>
    <p><strong>Nothing has been sent to the applicant.</strong> They're waiting to hear, and no email goes to them until you decide -- a rejection is never written by the app.</p>
  `;
}

// "A tokenised read-only link. No account, and it expires when the course
// closes." The assessor never creates an account, so the link is the whole
// mechanism -- and the expiry has to be stated or it looks like a permanent one.
export function assessorPackEmailHtml(input: {
  assessorName: string;
  courseName: string;
  visitDate: string | null;
  packUrl: string;
  centreName: string;
}): string {
  return `
    <p>Dear ${input.assessorName},</p>
    <p>Your pack for ${input.courseName}${input.visitDate ? `, visit on ${input.visitDate}` : ""}.</p>
    <p><a href="${input.packUrl}">${input.packUrl}</a></p>
    <p>The link opens directly -- there's no account to create and no password. It's read-only, and it stops working when the course closes.</p>
    <p>Anything missing or unclear, reply to this and it reaches ${input.centreName} directly.</p>
  `;
}

// "Confirms it arrived and says honestly that classes run every few months."
// The honesty is deliberate: a volunteer who hears nothing for two months
// assumes they were ignored.
export function volunteerSignedUpEmailHtml(input: {
  volunteerName: string;
  centreName: string;
}): string {
  return `
    <p>Dear ${input.volunteerName},</p>
    <p>Thank you for signing up for free English classes with ${input.centreName}. We have your details.</p>
    <p>To be straight with you about timing: these classes run alongside our teacher-training courses, which means every few months rather than continuously. It may be a little while before we're in touch with dates -- that's normal, and it isn't us forgetting you.</p>
    <p>There's no account to set up and nothing further you need to do.</p>
  `;
}

// "Level, dates, address, and what the class is -- taught by teachers in
// training, watched by a tutor." Naming that plainly is a consent matter, not a
// caveat: nobody should arrive without knowing.
export function volunteerClassStartingEmailHtml(input: {
  volunteerName: string;
  level: string;
  dates: string;
  address: string;
  centreName: string;
}): string {
  return `
    <p>Dear ${input.volunteerName},</p>
    <p>Your free English classes with ${input.centreName} are starting.</p>
    <p><strong>Level:</strong> ${input.level}<br/>
       <strong>When:</strong> ${input.dates}<br/>
       <strong>Where:</strong> ${input.address}</p>
    <p>So you know exactly what you're coming to: these classes are taught by teachers in training, with an experienced tutor watching every lesson and responsible for it. The classes are free because the teachers are learning, and you're helping them do it.</p>
    <p>If you'd rather not take part, just reply and we'll take you off the list -- no explanation needed.</p>
  `;
}
