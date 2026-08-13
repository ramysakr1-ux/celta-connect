"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/require-role";
import { createResendClient, JOIN_LINK_SENDER } from "@/lib/resend/client";
import type { DeliveryMode } from "@/lib/delivery-mode";

const VALID_DELIVERY_MODES: DeliveryMode[] = ["f2f", "online", "mixed"];

export async function updateDeliveryMode(formData: FormData): Promise<void> {
  const admin = await requireRole("admin");

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
  if (!course || course.center_id !== admin.center_id) return;

  await supabase.from("courses").update({ delivery_mode: deliveryMode as DeliveryMode }).eq("id", courseId);
  revalidatePath(`/dashboard/admin/courses/${courseId}`);
}

export async function updateAssessorVisitDate(formData: FormData): Promise<void> {
  const admin = await requireRole("admin");
  const courseId = formData.get("course_id");
  const assessorVisitDate = (formData.get("assessor_visit_date") as string | null) || null;
  if (typeof courseId !== "string") return;

  const supabase = await createClient();
  const { data: course } = await supabase.from("courses").select("id, center_id").eq("id", courseId).maybeSingle();
  if (!course || course.center_id !== admin.center_id) return;

  await supabase.from("courses").update({ assessor_visit_date: assessorVisitDate }).eq("id", courseId);
  revalidatePath(`/dashboard/admin/courses/${courseId}`);
}

// §4 "entry_form_sent_at -- why it matters": one date on the course clock
// that comes from Cambridge's calendar, not the timetable. Setting it here
// is what later decides whether a withdrawal is internal or reportable.
export async function updateEntryFormSentAt(formData: FormData): Promise<void> {
  const admin = await requireRole("admin");
  const courseId = formData.get("course_id");
  const entryFormSentAt = (formData.get("entry_form_sent_at") as string | null) || null;
  if (typeof courseId !== "string") return;

  const supabase = await createClient();
  const { data: course } = await supabase.from("courses").select("id, center_id").eq("id", courseId).maybeSingle();
  if (!course || course.center_id !== admin.center_id) return;

  await supabase
    .from("courses")
    .update({ entry_form_sent_at: entryFormSentAt ? new Date(entryFormSentAt).toISOString() : null })
    .eq("id", courseId);
  revalidatePath(`/dashboard/admin/courses/${courseId}`);
}

export async function regenerateJoinLink(formData: FormData): Promise<void> {
  const admin = await requireRole("admin");

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
  const admin = await requireRole("admin");

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
  const admin = await requireRole("admin");

  const courseId = formData.get("course_id");
  const role = formData.get("role");
  const toEmail = formData.get("to_email");

  if (
    typeof courseId !== "string" ||
    typeof toEmail !== "string" ||
    !toEmail ||
    (role !== "trainee" && role !== "trainer")
  ) {
    return { error: "Enter an email address.", sent: false };
  }

  const supabase = await createClient();
  const { data: course } = await supabase
    .from("courses")
    .select("id, center_id, name, start_date, end_date, trainee_join_token, trainer_join_token")
    .eq("id", courseId)
    .maybeSingle();

  if (!course || course.center_id !== admin.center_id) {
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
  const { data: center } = await supabase.from("centers").select("name").eq("id", admin.center_id).maybeSingle();
  const centerName = center?.name ?? "Your centre";

  try {
    const resend = createResendClient();
    const { error } = await resend.emails.send({
      from: JOIN_LINK_SENDER,
      to: toEmail,
      subject: `${centerName} · your CELTA workspace is ready`,
      html: buildJoinEmailHtml({
        centerName,
        courseName: course.name,
        startDate: course.start_date,
        endDate: course.end_date,
        role,
        joinUrl,
      }),
    });

    if (error) {
      return { error: "Could not send the email. Try copying the link instead.", sent: false };
    }
    return { error: null, sent: true };
  } catch {
    return { error: "Could not send the email. Try copying the link instead.", sent: false };
  }
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
    <h2>${centerName} has invited you to join ${courseName}</h2>
    <p>
      You've been invited to join <strong>${courseName}</strong>
      (${startDate} &rarr; ${endDate}) as a <strong>${role}</strong>.
    </p>
    <p><a href="${joinUrl}">Join the course &rarr;</a></p>
    <p style="color:#888;font-size:13px">If you weren't expecting this, you can safely ignore this email.</p>
  `;
}
