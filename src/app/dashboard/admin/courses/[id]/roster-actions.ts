"use server";

import { revalidatePath } from "next/cache";
import { logManagementAction } from "@/lib/activity-log";
import { syncAssessorMeetingEvent } from "@/lib/assessor-day";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCapability, requireCapabilityOrTrainer } from "@/lib/auth/require-capability";
import { isMctOnCourse } from "@/lib/course-mct";
import { isMctOfCourse } from "@/lib/course-tutor-role";
import { joinLinkSender } from "@/lib/resend/client";
import { sendApplicantEmail } from "@/lib/admissions-email";
import { esc } from "@/lib/email-layout";
import type { DeliveryMode } from "@/lib/delivery-mode";

const VALID_DELIVERY_MODES: DeliveryMode[] = ["f2f", "online", "mixed"];

// Moved to /trainer/roster 2026-08-27, same MCT-gated pattern as
// close-out-actions.ts/updateChatRetentionDays -- a course-wide setting
// ("asked once, read everywhere -- the timetable, observation log and
// pre-course task all read this field"), same weight as chat retention.
export async function updateDeliveryMode(formData: FormData): Promise<void> {
  const staff = await requireCapabilityOrTrainer("courseAdmin.invite");

  const courseId = formData.get("course_id");
  const deliveryMode = formData.get("delivery_mode");
  if (
    typeof courseId !== "string" ||
    typeof deliveryMode !== "string" ||
    !VALID_DELIVERY_MODES.includes(deliveryMode as DeliveryMode)
  ) {
    return;
  }

  const supabase = await createClient();
  const { data: course } = await supabase.from("courses").select("id, center_id").eq("id", courseId).maybeSingle();
  if (!course || course.center_id !== staff.center_id) return;
  if (staff.role !== "admin" && staff.course_id && !(await isMctOnCourse(supabase, staff.course_id, staff.id))) return;

  await supabase.from("courses").update({ delivery_mode: deliveryMode as DeliveryMode }).eq("id", courseId);
  revalidatePath("/trainer/roster");
}

// connect-spec-corrections-for-claude-code.md item 6: the TP7/8 material
// pool is centre/course-optional, not universal -- some centres keep using
// the main coursebook for TP7/8 instead. Gates both the trainer resource
// hub's shelf and the candidate's claim section (see their page.tsx files).
// Moved to /trainer/resource-hub 2026-08-27, same MCT-gated pattern as
// close-out-actions.ts's requireMctCloseOutAccess -- a course-wide setting,
// same weight as chat retention, not a day-to-day teaching action like
// subgroups.
export async function updateTpMaterialPoolEnabled(formData: FormData): Promise<void> {
  const staff = await requireCapabilityOrTrainer("courseAdmin.invite");

  const courseId = formData.get("course_id");
  const enabled = formData.get("enabled");
  if (typeof courseId !== "string" || (enabled !== "true" && enabled !== "false")) return;

  const supabase = await createClient();
  const { data: course } = await supabase.from("courses").select("id, center_id").eq("id", courseId).maybeSingle();
  if (!course || course.center_id !== staff.center_id) return;
  if (staff.role !== "admin" && staff.course_id && !(await isMctOnCourse(supabase, staff.course_id, staff.id))) return;

  await supabase.from("courses").update({ tp_material_pool_enabled: enabled === "true" }).eq("id", courseId);
  revalidatePath("/trainer/resource-hub");
}

// "The intake dropdown shows real availability" -- a course must be
// explicitly opened for applications with a real cap before /apply will
// list it. Off/null by default (migration 0082) so nothing is exposed
// accidentally.
export async function updateApplicationSettings(formData: FormData): Promise<void> {
  const admin = await requireCapability("courseAdmin.invite");
  const courseId = formData.get("course_id");
  const accepting = formData.get("accepting_applications") === "on";
  const capRaw = formData.get("application_cap");
  const cap = typeof capRaw === "string" && capRaw.trim() ? Number(capRaw) : null;
  if (typeof courseId !== "string") return;

  const supabase = await createClient();
  const { data: course } = await supabase.from("courses").select("id, center_id").eq("id", courseId).maybeSingle();
  if (!course || course.center_id !== admin.center_id) return;

  await supabase.from("courses").update({ accepting_applications: accepting, application_cap: cap }).eq("id", courseId);
  revalidatePath(`/dashboard/admin/courses/${courseId}`);
  revalidatePath("/dashboard/admin");
}

// Ramy, 2026-08-18: "chat retention lives in Course Admin, configured by
// the MCT per course" -- moved from the old centre-wide setting
// (migration 0154). Null means the fixed 1-day/midnight-clear default.
// Moved to /trainer/roster 2026-08-27 -- "chat retention lives in Course
// Admin, configured by the MCT per course" (Ramy, 18 Aug) already said the
// MCT owns this; only the page it lived on has changed, now that Course
// Admin's own page no longer covers anything course-running-related. Same
// requireCapabilityOrTrainer("courseAdmin.invite") + isMctOnCourse() gate as every other
// MCT-only trainer-hub action (see close-out-actions.ts's
// requireMctCloseOutAccess for the precedent this copies).
export async function updateChatRetentionDays(formData: FormData): Promise<void> {
  const staff = await requireCapabilityOrTrainer("courseAdmin.invite");
  const courseId = formData.get("course_id");
  const modeRaw = formData.get("chat_retention_mode");
  const mode = modeRaw === "course" ? "course" : "days";
  const chatRetentionRaw = formData.get("chat_retention_days");
  const chatRetentionDays = typeof chatRetentionRaw === "string" && chatRetentionRaw ? Number(chatRetentionRaw) : 1;
  if (typeof courseId !== "string") return;
  if (!Number.isInteger(chatRetentionDays) || chatRetentionDays < 1) return;

  const supabase = await createClient();
  const { data: course } = await supabase.from("courses").select("id, center_id").eq("id", courseId).maybeSingle();
  if (!course || course.center_id !== staff.center_id) return;
  if (staff.role !== "admin" && staff.course_id && !(await isMctOnCourse(supabase, staff.course_id, staff.id))) return;

  await supabase
    .from("courses")
    .update({ chat_retention_days: chatRetentionDays, chat_retention_mode: mode })
    .eq("id", courseId);
  revalidatePath("/trainer/roster");
}

export async function updateAssessorVisitDate(formData: FormData): Promise<void> {
  const admin = await requireCapability("courseAdmin.invite");
  const courseId = formData.get("course_id");
  const assessorVisitDate = (formData.get("assessor_visit_date") as string | null) || null;
  if (typeof courseId !== "string") return;

  const supabase = await createClient();
  const { data: course } = await supabase.from("courses").select("id, center_id").eq("id", courseId).maybeSingle();
  if (!course || course.center_id !== admin.center_id) return;

  await supabase.from("courses").update({ assessor_visit_date: assessorVisitDate }).eq("id", courseId);
  // Same sync as the MCT's own assessor card (trainer/assessor-actions.ts) --
  // whoever sets the date first is what the other side sees, so both write
  // paths have to place the meeting or it depends on which screen was used.
  await syncAssessorMeetingEvent(supabase, courseId, assessorVisitDate);
  revalidatePath(`/dashboard/admin/courses/${courseId}`);
}

// §4 "entry_form_sent_at -- why it matters": one date on the course clock
// that comes from Cambridge's calendar, not the timetable. Setting it here
// is what later decides whether a withdrawal is internal or reportable.
export async function updateEntryFormSentAt(formData: FormData): Promise<void> {
  const admin = await requireCapability("courseAdmin.invite");
  const courseId = formData.get("course_id");
  const entryFormSentAt = (formData.get("entry_form_sent_at") as string | null) || null;
  if (typeof courseId !== "string") return;

  const supabase = await createClient();
  const { data: course } = await supabase
    .from("courses")
    .select("id, center_id, entry_form_sent_at")
    .eq("id", courseId)
    .maybeSingle();
  if (!course || course.center_id !== admin.center_id) return;

  const next = entryFormSentAt ? new Date(entryFormSentAt).toISOString() : null;
  await supabase.from("courses").update({ entry_form_sent_at: next }).eq("id", courseId);

  // Both the Course Administrator and the MCT can set this, and it is the
  // date that later decides whether a withdrawal is internal or reportable to
  // Cambridge. Two people who can write one field is exactly the shared
  // responsibility Ramy meant: the record should say which of them did it.
  const asDate = (v: string | null) => (v ? v.slice(0, 10) : null);
  if (asDate(course.entry_form_sent_at) !== asDate(next)) {
    await logManagementAction({
      centerId: admin.center_id,
      actorId: admin.id,
      courseId,
      action: next ? "entry_form.marked_sent" : "entry_form.cleared",
      targetTable: "courses",
      targetId: courseId,
      previousValue: asDate(course.entry_form_sent_at),
      newValue: asDate(next),
    });
  }
  revalidatePath(`/dashboard/admin/courses/${courseId}`);
}

// for-claude-code-course-admin-landing-and-admissions.md §4: "a single
// field on the course record, writable by both the Course Administrator...
// and the MCT... whichever side sets it first is what the other side
// sees." This is the Course-Admin-side write path; the MCT-side one
// (inside the course, once running) reuses the same two columns.
export async function updateAssessor(formData: FormData): Promise<void> {
  const admin = await requireCapability("courseAdmin.invite");
  const courseId = formData.get("course_id");
  const assessorName = (formData.get("assessor_name") as string | null)?.trim() || null;
  const assessorEmail = (formData.get("assessor_email") as string | null)?.trim().toLowerCase() || null;
  if (typeof courseId !== "string") return;

  const supabase = await createClient();
  const { data: course } = await supabase.from("courses").select("id, center_id").eq("id", courseId).maybeSingle();
  if (!course || course.center_id !== admin.center_id) return;

  await supabase.from("courses").update({ assessor_name: assessorName, assessor_email: assessorEmail }).eq("id", courseId);
  revalidatePath(`/dashboard/admin/courses/${courseId}`);
}

export async function regenerateJoinLink(formData: FormData): Promise<void> {
  const admin = await requireCapability("courseAdmin.invite");

  const courseId = formData.get("course_id");
  const role = formData.get("role");
  if (typeof courseId !== "string" || (role !== "trainee" && role !== "trainer")) return;

  const supabase = await createClient();

  const { data: course } = await supabase
    .from("courses")
    .select("id, center_id")
    .eq("id", courseId)
    .maybeSingle();
  if (!course || course.center_id !== admin.center_id) return;

  const update =
    role === "trainee"
      ? { trainee_join_token: crypto.randomUUID() }
      : { trainer_join_token: crypto.randomUUID() };
  await supabase.from("courses").update(update).eq("id", courseId);

  revalidatePath(`/dashboard/admin/courses/${courseId}`);
}

export async function removeRosterMember(formData: FormData): Promise<void> {
  const admin = await requireCapability("courseAdmin.invite");

  const memberId = formData.get("member_id");
  const courseId = formData.get("course_id");
  if (typeof memberId !== "string" || typeof courseId !== "string") return;

  const supabase = await createClient();
  const { data: member } = await supabase
    .from("profiles")
    .select("id, center_id, course_id")
    .eq("id", memberId)
    .maybeSingle();

  if (!member || member.center_id !== admin.center_id || member.course_id !== courseId) return;

  const adminClient = createAdminClient();
  await adminClient.auth.admin.deleteUser(memberId);

  revalidatePath(`/dashboard/admin/courses/${courseId}`);
}

export interface EmailLinkState {
  error: string | null;
  sent: boolean;
}

export async function sendJoinLinkEmail(
  _prevState: EmailLinkState,
  formData: FormData
): Promise<EmailLinkState> {
  // Trainers can only send the *trainee* link, and only for their own
  // course -- for-claude-code-trainer-remaining-screens.md's Roster "Add
  // candidate" action. Regenerating/removing stays admin-only (those are
  // destructive to an already-shared link); sending a fresh invite email
  // isn't, so it's safe to widen just this one action.
  const staff = await requireCapabilityOrTrainer("courseAdmin.invite");

  const courseId = formData.get("course_id");
  const role = formData.get("role");
  const toEmail = formData.get("to_email");

  // Ramy, 5 Sep 2026: adding a candidate is the main course tutor's, not
  // any tutor's. Course Admin keeps its capability path; a trainer must be
  // the MCT of the course (the Roster hides the button for an ACT, and
  // this is what makes the hiding real).
  if (staff.role === "trainer" && typeof courseId === "string" && !(await isMctOfCourse(staff, courseId))) {
    return { error: "Only the main course tutor can add candidates.", sent: false };
  }

  if (
    typeof courseId !== "string" ||
    typeof toEmail !== "string" ||
    !toEmail ||
    (role !== "trainee" && role !== "trainer")
  ) {
    return { error: "Enter an email address.", sent: false };
  }
  if (staff.role === "trainer" && role !== "trainee") {
    return { error: "Not authorized.", sent: false };
  }

  const supabase = await createClient();
  const { data: course } = await supabase
    .from("courses")
    .select("id, center_id, name, start_date, end_date, trainee_join_token, trainer_join_token")
    .eq("id", courseId)
    .maybeSingle();

  const authorized =
    course && (staff.role === "admin" ? course.center_id === staff.center_id : courseId === staff.course_id);
  if (!course || !authorized) {
    return { error: "Course not found.", sent: false };
  }

  const siteUrl = process.env.SITE_URL;
  if (!siteUrl) {
    return { error: "SITE_URL is missing from .env.local.", sent: false };
  }

  const token = role === "trainee" ? course.trainee_join_token : course.trainer_join_token;
  const joinUrl = `${siteUrl}/join/${token}`;
  // Subject leads with the centre, not the platform -- the recipient
  // recognises their centre; Connect is the tool underneath
  // (specs/rename-to-connect.md, "Copy that changes meaning" #2).
  const { data: center } = await supabase.from("centers").select("name").eq("id", staff.center_id).maybeSingle();
  const centerName = center?.name ?? "Your centre";

  // for-claude-code-email-delivery-tracking.md -- was a raw resend.emails.
  // send() call, completely untracked despite being the spec's own
  // highest-stakes case ("a person with no way into the course they've paid
  // for"). Routed through sendApplicantEmail for the same tracking/
  // two-strike-bounce-gate every other email already has; applicantId is
  // null (a join invite often has no applicant row at all, trainer invites
  // never do) and the invites@ sending identity is preserved via `from`
  // rather than silently collapsing to sendApplicantEmail's noreply@ default.
  const { error } = await sendApplicantEmail({
    centerName,
    centerAdmissionsEmail: null,
    to: toEmail,
    subject: "your CELTA workspace is ready",
    html: buildJoinEmailHtml({
      centerName,
      courseName: course.name,
      startDate: course.start_date,
      endDate: course.end_date,
      role,
      joinUrl,
    }),
    centerId: course.center_id,
    applicantId: null,
    type: "workspace_invitation",
    sentBy: staff.id,
    from: joinLinkSender(centerName),
  });

  if (error) {
    // The message below is what the person reads; this is what we read.
    console.error("[dashboard/admin/courses/[id]/roster-actions.ts:sendJoinLinkEmail]", error);
    return { error: "Could not send the email. Try copying the link instead.", sent: false };
}
  return { error: null, sent: true };
}

function buildJoinEmailHtml({
  centerName,
  courseName,
  startDate,
  endDate,
  role,
  joinUrl,
}: {
  centerName: string;
  courseName: string;
  startDate: string;
  endDate: string;
  role: "trainee" | "trainer";
  joinUrl: string;
}): string {
  // Opens with the centre and course, not the platform -- Connect only
  // appears via the sender name, not in the body copy (rename-to-connect.md).
  return `
    <h2>${esc(centerName)} has invited you to join ${esc(courseName)}</h2>
    <p>
      You've been invited to join <strong>${esc(courseName)}</strong>
      (${startDate} &rarr; ${endDate}) as a <strong>${role}</strong>.
    </p>
    <p><a href="${joinUrl}">Join the course &rarr;</a></p>
    <p style="color:#888;font-size:13px">If you weren't expecting this, you can safely ignore this email.</p>
  `;
}
