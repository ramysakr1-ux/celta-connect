"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { linkVolunteerByEmail } from "@/lib/volunteer-identity";

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
      .select("center_id, start_date")
      .eq("id", accessToken.course_id)
      .maybeSingle();
    if (course) {
      await linkVolunteerByEmail(admin, { volunteerStudentId: volunteer.id, centerId: course.center_id, email });

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

      // Ramy, 25 Aug 2026: "if someone signs up less than a week..." led to
      // finding the real gap -- runVolunteerClassStartingCron only ever
      // looks at courses starting within the next 7 days, so someone
      // registering mid-course (start_date already in the past) would
      // never be picked up by it. The confirmation email above deliberately
      // carries no join link ("nothing further you need to do" -- it's
      // sent long before the link is usable for an early sign-up). For a
      // course already running, that link is usable right now, so send it
      // immediately instead of leaving them with no way to ever get one.
      const today = new Date().toISOString().slice(0, 10);
      if (course.start_date <= today) {
        const { sendVolunteerClassStartingEmail } = await import("@/lib/volunteer-class-starting");
        await sendVolunteerClassStartingEmail(
          admin,
          { id: volunteer.id, name, email, level, course_id: accessToken.course_id },
          { skipIfAlreadySent: true }
        );
      }
    }
  }

  revalidatePath(`/register/${token}`);
  return { error: null };
}
