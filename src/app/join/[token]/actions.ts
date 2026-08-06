"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CELTA_CRITERIA_CODES } from "@/lib/celta-criteria";
import { TUTOR_ROLES } from "@/lib/tutor-roles";
import type { UserRole } from "@/lib/supabase/types";

export interface JoinCourseState {
  error: string | null;
}

async function resolveCourseAndRole(token: string) {
  const admin = createAdminClient();
  const { data: course } = await admin
    .from("courses")
    .select("id, center_id, trainee_join_token, trainer_join_token")
    .or(`trainee_join_token.eq.${token},trainer_join_token.eq.${token}`)
    .maybeSingle();

  if (!course) return null;

  const role: UserRole = course.trainee_join_token === token ? "trainee" : "trainer";
  return { course, role };
}

export async function joinCourse(
  _prevState: JoinCourseState,
  formData: FormData
): Promise<JoinCourseState> {
  const token = formData.get("token");
  const fullName = formData.get("full_name");
  const email = formData.get("email");
  const password = formData.get("password");
  const confirmPassword = formData.get("confirm_password");

  if (
    typeof token !== "string" ||
    typeof fullName !== "string" ||
    typeof email !== "string" ||
    typeof password !== "string" ||
    typeof confirmPassword !== "string" ||
    !token ||
    !fullName ||
    !email ||
    !password ||
    !confirmPassword
  ) {
    return { error: "Fill in your name, email, and password." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }
  if (!formData.get("agree_ip") || !formData.get("agree_data")) {
    return { error: "You need to agree to both checkboxes to join." };
  }

  const resolved = await resolveCourseAndRole(token);
  if (!resolved) {
    return { error: "This join link is invalid or has expired." };
  }
  const { course, role } = resolved;

  const tutorRoleInput = formData.get("tutor_role");
  const tutorRole =
    role === "trainer" && typeof tutorRoleInput === "string" && TUTOR_ROLES.includes(tutorRoleInput as (typeof TUTOR_ROLES)[number])
      ? tutorRoleInput
      : null;

  const adminClient = createAdminClient();
  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (createError || !created.user) {
    if (createError?.code === "email_exists") {
      return { error: "That email is already registered -- try logging in instead." };
    }
    if (createError?.code === "email_address_invalid") {
      return { error: "That email address looks invalid. Double-check it." };
    }
    return { error: createError?.message ?? "Could not create your account. Try again." };
  }

  const { error: profileError } = await adminClient.from("profiles").insert({
    id: created.user.id,
    email,
    full_name: fullName,
    role,
    center_id: course.center_id,
    course_id: course.id,
    tutor_role: tutorRole,
    terms_accepted_at: new Date().toISOString(),
  });

  if (profileError) {
    return { error: "Could not finish setting up your account. Try again." };
  }

  if (role === "trainee") {
    const assignmentTypes = ["Focus on Learner", "LRT", "Skills", "LfC"] as const;
    await adminClient.from("assignments").insert(
      assignmentTypes.map((assignment_type) => ({
        course_id: course.id,
        trainee_id: created.user.id,
        assignment_type,
      }))
    );

    await adminClient.from("celta5_matrix").insert(
      CELTA_CRITERIA_CODES.map((criteria_code) => ({
        course_id: course.id,
        trainee_id: created.user.id,
        criteria_code,
      }))
    );

    await adminClient.from("celta5_records").insert({
      course_id: course.id,
      trainee_id: created.user.id,
    });
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    redirect("/login");
  }

  redirect("/dashboard");
}
