import "server-only";
import { createResendClient } from "@/lib/resend/client";
import { emailShell, rawP, p, list, inlineButton, signature, esc, EMAIL_TONE } from "@/lib/email-layout";

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

// The workspace invitation. Copy is verbatim from
// for-claude-code-email-copy.md item 11 -- heading, body, the three Facts
// rows, CTA and footnote -- not a paraphrase of it.
//
// Sent when the centre gives its green light (migration 0118), which is
// usually cleared funds but may be a deposit or a promise to pay. Ramy,
// 2026-08-16: "before they receive the Connect link, there should be a green
// light from the centre."
//
// Carries the pre-COURSE task and the reading list, both from the Resource
// hub -- build-spec.md: "the pre-course task and reading list from the
// Resource hub". Not the pre-interview task, which the applicant already did
// while applying.
export function welcomeEmailHtml(input: {
  candidateName: string;
  courseName: string;
  centreName: string;
  tutorNames: string[];
  courseFact: string;
  startsFact: string;
  preCourseTaskFact: string;
  setupUrl: string;
  readingListUrl: string | null;
}): string {
  const tutors =
    input.tutorNames.length === 0
      ? ""
      : input.tutorNames.length === 1
        ? `Your tutor is ${esc(input.tutorNames[0])}. `
        : `Your tutors are ${esc(input.tutorNames.slice(0, -1).join(", "))} and ${esc(input.tutorNames[input.tutorNames.length - 1])}. `;

  const body =
    rawP(
      `${esc(input.candidateName)} &mdash; you are enrolled on ${esc(input.courseName)} at ${esc(input.centreName)}. ` +
        tutors +
        "Everything for the course lives behind the link below: your timetable, teaching practice, assignments and feedback."
    ) +
    (input.readingListUrl
      ? rawP(
          `Your pre-course task and reading list are waiting there too. ` +
            `<a href="${input.readingListUrl}" style="color:${EMAIL_TONE.teal};">The reading list</a> is worth a look before you start.`
        )
      : "");

  return emailShell({
    heading: "Your CELTA workspace is ready",
    tone: "teal",
    body,
    facts: [
      { label: "Course", value: input.courseFact },
      { label: "Starts", value: input.startsFact },
      { label: "Before day one", value: input.preCourseTaskFact },
    ],
    cta: { label: "Set up your account", url: input.setupUrl },
    footnote:
      "The link is yours alone and expires when the course ends. You will be asked to agree to the candidate terms as you set up -- it takes a minute.",
  });
}

// NEVER SENT. There is no pre-interview task email at all.
//
// Ramy, 2026-08-16, settling this directly: "the pre-interview task is
// something they do when they sign up to Connect -- they click a link on the
// website, the link takes them to Connect, and then they do the pre-interview
// task. So there's no email with the pre-interview task. It's already built
// in."
//
// So the applicant is already in Connect doing the task; announcing by email
// that a task is waiting would arrive while they are sitting in front of it.
// The current build is right: the writing task is part of the application
// flow. Item 2 in the inventory is a description of that step, not a message.
//
// Kept as a function only so the wording survives if it is ever needed on the
// page itself. Do not wire it to a send.
//
// The two tasks are NOT interchangeable, and this comment has been wrong in
// both directions already: the pre-INTERVIEW task is part of applying, and the
// pre-COURSE task rides with the workspace invitation (item 11, "Before day
// one - Pre-course task, about 4 hours"). Merging them would mean asking a
// candidate to sit the selection task after they had been accepted.
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

// ---------------------------------------------------------------------------
// The seven from Applications.dc.html, verbatim.
//
// Copy, headings, CTAs and footnotes are the design file's own words, with
// only the specifics (name, course, dates, fee) substituted. Nothing here is
// paraphrased -- the earlier versions of these were written from subject lines
// alone and were not close.
//
// The accents are the file's too, and the silences are deliberate: teal for
// the interview invitation and the offer, gold for the two waiting-list
// emails, and NO accent at all on the rejections and on "the course filled" --
// a coloured bar shouting at someone you have just turned down would be
// gratuitous.
// ---------------------------------------------------------------------------

export function interviewInvitationEmailHtml(input: {
  applicantName: string;
  bookingUrl: string;
  slotsNote: string;
}): string {
  return emailShell({
    heading: "We would like to meet you",
    tone: "teal",
    body:
      p(`Dear ${input.applicantName},`) +
      p("Thank you for the written tasks — we have read them and we would like to meet you.") +
      p(
        "The interview takes about 45 minutes. We will talk about your teaching, and work through some of the language from your task together. There is nothing to prepare."
      ) +
      p(
        "Choose whichever of the times below suits you. If none of them work, reply to this email and we will find another."
      ),
    cta: { label: "Choose a time", url: input.bookingUrl },
    footnote: input.slotsNote,
  });
}

export function offerEmailHtml(input: {
  applicantName: string;
  courseName: string;
  courseDates: string;
  interviewDate: string | null;
  taskFeedback: string | null;
  feeLine: string;
  officeContact: string;
  offerUrl: string;
  acceptWithinDays: number;
  holdUntil: string;
}): string {
  return emailShell({
    heading: "We would like to offer you a place",
    tone: "teal",
    body:
      p(`Dear ${input.applicantName},`) +
      p(
        `Following your written task${input.interviewDate ? ` and your interview on ${input.interviewDate}` : ""}, we are offering you a place on ${input.courseName}, running ${input.courseDates}.`
      ) +
      // The tutor's own paragraph about their task. Omitted rather than
      // faked when nobody has written one -- an invented sentence about a
      // candidate's work is the worst thing this email could contain.
      (input.taskFeedback ? p(input.taskFeedback) : "") +
      p(
        `${input.feeLine} Use the link below to accept your place — it sets up your workspace, where your pre-course task and reading list are waiting. For payment options, including instalments, contact the centre office on ${input.officeContact} or reply to this email.`
      ),
    cta: { label: "Accept your place", url: input.offerUrl },
    footnote: `Please accept within ${input.acceptWithinDays} days. We will hold your place until ${input.holdUntil}, after which it goes to the waiting list.`,
  });
}

export function rejectionEmailHtml(input: {
  applicantName: string;
  centreName: string;
  reason: string;
  callerName: string | null;
}): string {
  return emailShell({
    heading: "We are not taking your application further",
    tone: "plain",
    body:
      p(`Dear ${input.applicantName},`) +
      p(
        `Thank you for applying to CELTA at ${input.centreName}, and for the time you gave to the written task.`
      ) +
      p(input.reason) +
      p(
        "This is not a judgement about whether you can teach, and it is not final. Work through a grammar reference written for teachers — Parrott or Swan — and apply again for a later course. We would read a fresh application properly."
      ),
    footnote: input.callerName
      ? `If you would like to talk it through before reapplying, reply and ${input.callerName} will call you.`
      : "If you would like to talk it through before reapplying, just reply.",
  });
}

export function rejectionAfterInterviewEmailHtml(input: {
  applicantName: string;
  interviewDate: string | null;
  reason: string;
  callerName: string | null;
}): string {
  return emailShell({
    heading: "We are not able to offer you a place this time",
    tone: "plain",
    body:
      p(`Dear ${input.applicantName},`) +
      p(
        `Thank you for coming in${input.interviewDate ? ` on ${input.interviewDate}` : ""}. It was a good conversation and I am sorry this is not the answer.`
      ) +
      p(input.reason) +
      p(
        "What is missing is a specific, learnable thing. Spend some time with Parrott, apply again for a later course, and we will look at it fresh."
      ),
    footnote: input.callerName
      ? `${input.callerName} will call you this week if you would like to go through it.`
      : "Reply to this email if you would like to go through it.",
  });
}

export function waitingListEmailHtml(input: {
  applicantName: string;
  courseName: string;
  positionWord: string;
  hearBy: string;
  daysBeforeStart: string;
  nextCourseName: string | null;
}): string {
  return emailShell({
    heading: `You are ${input.positionWord} on the waiting list`,
    tone: "gold",
    body:
      p(`Dear ${input.applicantName},`) +
      p(
        `We would like to have you on ${input.courseName}, but the course is full. You are ${input.positionWord} on the waiting list.`
      ) +
      p(
        `Places do come free — candidates withdraw, defer, or do not take up an offer — and when one does, we work down the list in order. We will tell you either way by ${input.hearBy}${input.daysBeforeStart ? `, ${input.daysBeforeStart} before the course starts` : ""}.`
      ) +
      p(
        `If nothing opens, we will carry your application to the ${input.nextCourseName ?? "next"} course automatically, with nothing further for you to do. Tell us if you would rather not.`
      ),
    footnote: "Your written task and interview stay on file, so you would not repeat them.",
  });
}

export function notThisTimeEmailHtml(input: {
  applicantName: string;
  courseName: string;
  positionWord: string | null;
  nextCourseName: string | null;
  nextCourseStart: string | null;
  callerName: string | null;
}): string {
  return emailShell({
    heading: "The course filled before a place came free",
    tone: "plain",
    body:
      p(`Dear ${input.applicantName},`) +
      p(
        `We said we would tell you either way by today, so: no place opened on ${input.courseName}. We are sorry${input.positionWord ? ` — you were ${input.positionWord} on the list and it was close` : ""}.`
      ) +
      p("This is nothing to do with your application, which was strong. The course simply filled.") +
      p(
        input.nextCourseName
          ? `We have carried you to the ${input.nextCourseName} course${input.nextCourseStart ? `, starting ${input.nextCourseStart}` : ""}, with nothing further for you to do. Your written task and interview stay on file, so you would not repeat either. Tell us if you would rather we did not.`
          : "We will carry your application to our next intake, with nothing further for you to do. Your written task and interview stay on file, so you would not repeat either. Tell us if you would rather we did not."
      ),
    footnote: input.callerName
      ? `Sent automatically on the date we promised. If you would like to talk it through, reply and ${input.callerName} will call you.`
      : "Sent automatically on the date we promised. If you would like to talk it through, just reply.",
  });
}

export function placeFreedEmailHtml(input: {
  applicantName: string;
  courseName: string;
  courseDates: string;
  startsInPhrase: string;
  feeLine: string;
  respondBy: string;
  offerUrl: string;
  hoursLeftLabel: string;
  nextCourseName: string | null;
}): string {
  return emailShell({
    heading: "A place has come free — it is yours if you want it",
    tone: "gold",
    body:
      p(`Dear ${input.applicantName},`) +
      p(
        `A candidate has withdrawn from ${input.courseName} and you were next on the list, so the place is yours. The course runs ${input.courseDates}.`
      ) +
      p(
        `We know this is short notice${input.startsInPhrase ? ` — it starts ${input.startsInPhrase}` : ""}. Your written task and interview are already on file, so there is nothing to repeat. ${input.feeLine} contact the office about payment, and the pre-course task takes about four hours.`
      ) +
      p(
        `Please tell us by ${input.respondBy}. There are others on the list behind you, and if we have not heard we will pass the place on.`
      ),
    cta: { label: input.hoursLeftLabel, url: input.offerUrl },
    footnote: `Declining costs you nothing: we carry you to the ${input.nextCourseName ?? "next"} course automatically, with your task and interview still on file.`,
  });
}

// ---------------------------------------------------------------------------
// The three from Course Emails.dc.html, verbatim.
//
// These interleave buttons with the copy rather than closing with one, and
// the order is the message: pay the deposit first, then "there are two more
// things to do, and neither is urgent". Flattening that into a single trailing
// CTA would change what the email says, so the shell grew inline buttons
// instead.
//
// Signed by the Course Director by name. All three are from a person, not
// from a system.
// ---------------------------------------------------------------------------

/**
 * Acceptance — the place is offered, the deposit secures it.
 *
 * "Sometimes sent months ahead, when no levels, groups or tutors exist yet",
 * which is why nothing here names a group or a tutor: those are the welcome
 * email's job, the Friday before.
 */
export function acceptancePlaceEmailHtml(input: {
  candidateName: string;
  courseName: string;
  courseDates: string;
  centreLocation: string;
  feeAmount: string;
  depositAmount: string;
  depositBy: string;
  balanceBy: string;
  payUrl: string;
  setupUrl: string;
  directorName: string;
  directorRole: string;
}): string {
  return emailShell({
    heading: `Your place on ${input.courseName}`,
    tone: "teal",
    body:
      p(`Dear ${input.candidateName},`) +
      p(
        `We are pleased to offer you a place on ${input.courseName}, running from ${input.courseDates} at ${input.centreLocation}.`
      ) +
      p(
        `The course fee is ${input.feeAmount}. To secure the place we need a deposit of ${input.depositAmount} by ${input.depositBy}. After that date the place is offered to the next applicant — we will not chase you for it, so please treat this part as the deadline it is.`
      ) +
      inlineButton({
        label: "Pay the deposit",
        url: input.payUrl,
        sub: `A receipt is sent automatically. The balance is due by ${input.balanceBy}.`,
      }) +
      p("Once the deposit clears, there are two more things to do, and neither is urgent.") +
      inlineButton({
        label: "Set up your Connect account",
        url: input.setupUrl,
        sub: "This is where the whole course lives — your timetable, your lesson plans, your assignments.",
      }) +
      p(
        "Second, the pre-course task. It takes most people eight to ten hours spread over a few weeks, and you hand it in on the first morning. It is not graded. Do not leave it until the week before."
      ) +
      p(
        "You will hear from us again the Friday before the course starts, with your group, your level, and what happens on day one. Nothing else is expected before then."
      ) +
      p("If anything changes for you between now and then, tell us early — we can almost always help.") +
      signature(input.directorName, input.directorRole),
  });
}

/**
 * Welcome — the Friday before.
 *
 * "The first moment levels and groups are settled", which is why this one
 * carries them and the acceptance email cannot.
 */
export function startsMondayEmailHtml(input: {
  candidateName: string;
  courseName: string;
  startTime: string;
  startDay: string;
  room: string;
  groupName: string;
  levelName: string;
  tutorNames: string;
  activitiesUrl: string;
  directorName: string;
  directorRole: string;
}): string {
  return emailShell({
    heading: `${input.courseName} starts ${input.startDay}`,
    tone: "gold",
    body:
      p(`Dear ${input.candidateName},`) +
      p(
        `We start at ${input.startTime} on ${input.startDay}, in ${input.room}. Bring the pre-course task and something to write with. Nothing else.`
      ) +
      p(
        `You are in ${input.groupName}, teaching the ${input.levelName} class. Your tutors are ${input.tutorNames}.`
      ) +
      p(
        "On Monday afternoon, after the demo lesson, each of you will spend twenty minutes with the class doing a getting-to-know-you activity. It is not assessed, nobody is watching, and it is meant to be enjoyable. We have put three to choose from in Connect — have a look this weekend and pick whichever appeals."
      ) +
      inlineButton({
        label: "See your three activities",
        url: input.activitiesUrl,
        sub: "Two minutes. Choose one, and that is genuinely all the preparation Monday needs.",
        tone: "gold",
      }) +
      p("Everything else on Monday is watching and listening. There is nothing else to prepare.") +
      p(
        "Your tutors will answer any questions on the first morning, so please do not worry about anything between now and then."
      ) +
      p("See you Monday.") +
      signature(input.directorName, input.directorRole),
  });
}

/**
 * Late enrolment — days rather than months.
 *
 * "Every expectation the standard welcome sets is quietly lowered, and the one
 * thing that genuinely matters is named." The reassurance near the end is
 * muted in the design rather than emphasised, which is the right instinct: it
 * is meant to settle someone, not to be the loudest thing on the page.
 */
export function lateEnrolmentEmailHtml(input: {
  candidateName: string;
  courseName: string;
  daysNotice: string;
  startTime: string;
  startDay: string;
  room: string;
  groupName: string;
  levelName: string;
  tutorNames: string;
  setupUrl: string;
  directorName: string;
  directorRole: string;
}): string {
  return emailShell({
    heading: `Welcome to ${input.courseName} — starting ${input.startDay}, and what to ignore`,
    tone: "red",
    body:
      p(`Dear ${input.candidateName},`) +
      p(
        `Welcome to ${input.courseName}. A place came free and we are glad you took it — but you have ${input.daysNotice} rather than four weeks, so this email is mostly about what you can safely ignore.`
      ) +
      p(
        `We start at ${input.startTime} on ${input.startDay}, ${input.room}. You are in ${input.groupName}, teaching the ${input.levelName} class, with ${input.tutorNames}.`
      ) +
      p(
        "The pre-course task normally takes eight to ten hours. Do what you can and bring whatever you have — nobody will comment on how much. You can finish it during the first week."
      ) +
      list([
        "Setting up Connect — a minute at most, and worth doing before Monday.",
        "The getting-to-know-you activity — twenty minutes on Monday afternoon, three to choose from, unassessed. Pick one if you have time. If not, your tutor will choose for you and that is completely fine.",
        "Everything else can wait until you are here.",
      ]) +
      inlineButton({
        label: "Set up Connect and see your activities",
        url: input.setupUrl,
        sub: "The only thing on this list worth doing before Monday.",
      }) +
      // Muted in the design, deliberately -- it is meant to settle someone,
      // not to shout.
      `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#6d655c;">Starting late is much more common than you would think, and it makes no difference at all to how the course goes or how you are assessed.</p>` +
      p(
        "If you would rather talk it through before Monday, call me on the centre number and ask for me directly."
      ) +
      signature(input.directorName, input.directorRole),
  });
}
