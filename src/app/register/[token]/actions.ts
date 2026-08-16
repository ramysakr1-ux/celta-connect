"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export interface FormState {
  error: string | null;
}

// Token-authenticated, not session-authenticated -- whoever holds a
// register_viewer link has no Supabase Auth session at all (center
// business/admissions staff, no app account, not allowed on the course
// itself), so this validates the token itself and reaches the tables
// through the admin client, exactly like /student/[token] does for reads.
export async function addVolunteerStudentViaRegister(_prevState: FormState, formData: FormData): Promise<FormState> {
  const token = formData.get("token");
  const name = (formData.get("name") as string | null)?.trim();
  const level = (formData.get("level") as string | null)?.trim() || null;
  if (typeof token !== "string" || !token) return { error: "Invalid link." };
  if (!name) return { error: "Name is required." };

  const admin = createAdminClient();
  const { data: accessToken } = await admin
    .from("course_access_tokens")
    .select("course_id, expires_at")
    .eq("token", token)
    .eq("role", "register_viewer")
    .maybeSingle();

  if (!accessToken || new Date(accessToken.expires_at) < new Date()) {
    return { error: "This link has expired or isn't valid." };
  }

  const email = (formData.get("email") as string | null)?.trim() || null;

  const { data: volunteer, error } = await admin
    .from("volunteer_students")
    .insert({ course_id: accessToken.course_id, name, level, email })
    .select("id")
    .single();
  if (error || !volunteer) return { error: "Could not add the student. Try again." };

  await admin.from("course_access_tokens").insert({
    course_id: accessToken.course_id,
    role: "volunteer_student",
    volunteer_student_id: volunteer.id,
    expires_at: accessToken.expires_at,
  });

  // "Signed up -> Confirms it arrived and says honestly that classes run every
  // few months." Skipped without an address -- see migration 0115: a volunteer
  // with no email is a valid volunteer, not a failed one, so this never turns
  // into an error the person at the register screen has to deal with.
  if (email) {
    const { data: course } = await admin
      .from("courses")
      .select("center_id")
      .eq("id", accessToken.course_id)
      .maybeSingle();
    if (course) {
      const { data: center } = await admin
        .from("centers")
        .select("name, admissions_email")
        .eq("id", course.center_id)
        .maybeSingle();
      if (center) {
        const { sendApplicantEmail, volunteerSignedUpEmailHtml } = await import("@/lib/admissions-email");
        await sendApplicantEmail({
          centerName: center.name,
          centerAdmissionsEmail: center.admissions_email,
          to: email,
          subject: "Thank you for volunteering",
          centerId: course.center_id,
          type: "volunteer_signed_up",
          recipientName: name,
          html: volunteerSignedUpEmailHtml({ volunteerName: name, centreName: center.name }),
        });
      }
    }
  }

  revalidatePath(`/register/${token}`);
  return { error: null };
}
