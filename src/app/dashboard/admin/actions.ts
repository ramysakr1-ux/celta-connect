"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/require-role";
import type { UserRole } from "@/lib/supabase/types";
import { CELTA_CRITERIA_CODES } from "@/lib/celta-criteria";

export interface FormState {
  error: string | null;
}

export async function createCourse(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const admin = await requireRole("admin");

  const name = formData.get("name");
  const startDate = formData.get("start_date");
  const endDate = formData.get("end_date");

  if (
    typeof name !== "string" ||
    typeof startDate !== "string" ||
    typeof endDate !== "string" ||
    !name ||
    !startDate ||
    !endDate
  ) {
    return { error: "Fill in a name, start date, and end date." };
  }

  if (endDate < startDate) {
    return { error: "End date must be on or after the start date." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("courses").insert({
    center_id: admin.center_id,
    name,
    start_date: startDate,
    end_date: endDate,
  });

  if (error) {
    return { error: "Could not create the course. Try again." };
  }

  revalidatePath("/dashboard/admin");
  return { error: null };
}

export async function inviteMember(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const admin = await requireRole("admin");

  const courseId = formData.get("course_id");
  const email = formData.get("email");
  const fullName = formData.get("full_name");
  const role = formData.get("role");

  if (
    typeof courseId !== "string" ||
    typeof email !== "string" ||
    typeof fullName !== "string" ||
    typeof role !== "string" ||
    !courseId ||
    !email ||
    !fullName ||
    (role !== "trainer" && role !== "trainee")
  ) {
    return { error: "Fill in a name, email, and role." };
  }

  const supabase = await createClient();

  const { data: course } = await supabase
    .from("courses")
    .select("id, center_id")
    .eq("id", courseId)
    .maybeSingle();

  if (!course || course.center_id !== admin.center_id) {
    return { error: "Course not found." };
  }

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch {
    return {
      error:
        "Invites aren't set up yet -- the service_role key is missing from .env.local.",
    };
  }

  const { data: invited, error: inviteError } =
    await adminClient.auth.admin.inviteUserByEmail(email);

  if (inviteError || !invited.user) {
    if (inviteError?.code === "email_exists") {
      return { error: "That email is already registered to an account." };
    }
    if (inviteError?.code === "email_address_invalid") {
      return { error: "That email address looks invalid. Double-check it." };
    }
    return { error: inviteError?.message ?? "Could not send the invite. Try again." };
  }

  const { error: profileError } = await supabase.from("profiles").insert({
    id: invited.user.id,
    email,
    full_name: fullName,
    role: role as UserRole,
    center_id: admin.center_id,
    course_id: courseId,
  });

  if (profileError) {
    return { error: "Invite sent, but the profile could not be created." };
  }

  if (role === "trainee") {
    const assignmentTypes = ["Focus on Learner", "LRT", "Skills", "LfC"] as const;
    await supabase.from("assignments").insert(
      assignmentTypes.map((assignment_type) => ({
        course_id: courseId,
        trainee_id: invited.user!.id,
        assignment_type,
      }))
    );

    await supabase.from("celta5_matrix").insert(
      CELTA_CRITERIA_CODES.map((criteria_code) => ({
        course_id: courseId,
        trainee_id: invited.user!.id,
        criteria_code,
      }))
    );

    await supabase.from("celta5_records").insert({
      course_id: courseId,
      trainee_id: invited.user!.id,
    });
  }

  revalidatePath(`/dashboard/admin/courses/${courseId}`);
  return { error: null };
}
