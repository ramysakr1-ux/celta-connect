"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/require-role";
import { createResendClient, JOIN_LINK_SENDER } from "@/lib/resend/client";

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

  try {
    const resend = createResendClient();
    const { error } = await resend.emails.send({
      from: JOIN_LINK_SENDER,
      to: toEmail,
      subject: "You've been invited to Celta Connect",
      html: buildJoinEmailHtml({
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
  courseName,
  startDate,
  endDate,
  role,
  joinUrl,
}: {
  courseName: string;
  startDate: string;
  endDate: string;
  role: "trainee" | "trainer";
  joinUrl: string;
}): string {
  return `
    <h2>You're invited to Celta Connect</h2>
    <p>
      You've been invited to join <strong>${courseName}</strong>
      (${startDate} &rarr; ${endDate}) as a <strong>${role}</strong>.
    </p>
    <p><a href="${joinUrl}">Join the course &rarr;</a></p>
    <p style="color:#888;font-size:13px">If you weren't expecting this, you can safely ignore this email.</p>
  `;
}
