"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CELTA_CRITERIA_CODES } from "@/lib/celta-criteria";
import { TUTOR_ROLES, type TutorRole } from "@/lib/tutor-roles";
import { defaultMarkerIdsForCourse } from "@/lib/assignment-ownership";
import type { UserRole } from "@/lib/supabase/types";

export interface JoinCourseState {
  error: string | null;
}

async function resolveCourseAndRole(token: string) {
  // Was a single .or() query with `token` -- fully attacker-controlled,
  // straight from the URL/a form field -- interpolated directly into the
  // filter string. PostgREST's .or() syntax treats commas/periods as
  // structural delimiters, so a token containing them could inject an
  // additional clause (e.g. matching on `id.not.is.null` instead of the
  // real token) and make this resolve to an ARBITRARY course. Worse, the
  // role assignment below had no rejection path at all -- any non-matching
  // result silently became "trainer" rather than failing closed. Two plain
  // .eq() lookups instead: no string built from user input, so nothing to
  // inject, and each branch only assigns a role when that exact field
  // actually matched.
  const admin = createAdminClient();
  const columns = "id, center_id, trainee_join_token, trainer_join_token";

  const { data: asTrainee } = await admin.from("courses").select(columns).eq("trainee_join_token", token).maybeSingle();
  if (asTrainee) return { course: asTrainee, role: "trainee" as UserRole };

  const { data: asTrainer } = await admin.from("courses").select(columns).eq("trainer_join_token", token).maybeSingle();
  if (asTrainer) return { course: asTrainer, role: "trainer" as UserRole };

  return null;
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
  // agree_link_private is on both role branches of the form, so it's checked
  // here alongside agree_ip rather than in either role block below. A
  // `required` attribute alone is only a client-side courtesy.
  if (!formData.get("agree_ip") || !formData.get("agree_link_private")) {
    return { error: "You need to agree to all the checkboxes to join." };
  }

  const resolved = await resolveCourseAndRole(token);
  if (!resolved) {
    return { error: "This join link is invalid or has expired." };
  }
  const { course, role } = resolved;

  // Cross-course text fingerprinting -- trainee-only, same boundary as
  // tutor_role being trainer-only below. The AI disclaimer itself
  // (Enrolment Forms.dc.html 1a, Cambridge's own verbatim wording) is a
  // separate signed record now, not a checkbox here -- see
  // ai_disclaimer_ticked/ai_disclaimer_signed_name below.
  if (
    role === "trainee" &&
    (!formData.get("agree_data") ||
      !formData.get("agree_fingerprint") ||
      !formData.get("agree_policies") ||
      !formData.get("agree_own_work") ||
      !formData.get("agree_contact"))
  ) {
    return { error: "You need to agree to all the checkboxes to join." };
  }
  if (role === "trainer" && (!formData.get("agree_confidentiality") || !formData.get("agree_procedures"))) {
    return { error: "You need to agree to all the checkboxes to join." };
  }
  if (role === "trainee" && (!formData.get("ai_disclaimer_ticked") || !(formData.get("ai_disclaimer_signed_name") as string | null)?.trim())) {
    return { error: "Tick all three sections of the AI disclaimer and type your name to sign it." };
  }
  const aiDisclaimerSignedName = role === "trainee" ? ((formData.get("ai_disclaimer_signed_name") as string | null)?.trim() ?? null) : null;
  const specialConsideration =
    role === "trainee" ? (formData.get("special_consideration") as string | null)?.trim() || null : null;
  const specialConsiderationArrangements = role === "trainee" ? (formData.getAll("special_consideration_arrangements") as string[]) : [];
  const specialConsiderationEvidence = role === "trainee" ? formData.get("special_consideration_evidence") : null;
  const uln = role === "trainee" ? (formData.get("uln") as string | null)?.trim() || null : null;
  const phone = role === "trainee" ? (formData.get("phone") as string | null)?.trim() || null : null;

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

  let specialConsiderationEvidenceUrl: string | null = null;
  if (specialConsiderationEvidence instanceof File && specialConsiderationEvidence.size > 0) {
    const path = `${course.center_id}/${created.user.id}-${Date.now()}.${specialConsiderationEvidence.name.split(".").pop() ?? "pdf"}`;
    const { error: uploadError } = await adminClient.storage
      .from("special-consideration-evidence")
      .upload(path, specialConsiderationEvidence, { contentType: specialConsiderationEvidence.type || "application/octet-stream" });
    if (!uploadError) specialConsiderationEvidenceUrl = path;
  }

  const { error: profileError } = await adminClient.from("profiles").insert({
    id: created.user.id,
    email,
    full_name: fullName,
    phone,
    role,
    center_id: course.center_id,
    course_id: course.id,
    tutor_role: tutorRole,
    special_consideration: specialConsideration,
    special_consideration_arrangements: specialConsiderationArrangements,
    special_consideration_evidence_url: specialConsiderationEvidenceUrl,
    ai_disclaimer_signed_at: role === "trainee" ? new Date().toISOString() : null,
    ai_disclaimer_signed_name: aiDisclaimerSignedName,
    uln,
    terms_accepted_at: new Date().toISOString(),
  });

  if (profileError) {
    // The message below is what the person reads; this is what we read.
    console.error("[join/[token]:joinCourse]", profileError);
    return { error: "Could not finish setting up your account. Try again." };
}

  if (role === "trainer") {
    // migration 0051's own comment flagged this as the gap: the one-off
    // backfill covered every trainer who already existed, but nothing kept
    // filling course_tutors for trainers joining after it. Without this row
    // a trainer's very first course would be invisible to the concurrent-
    // course check and the course switcher (for-claude-code-course-switcher.md),
    // both of which read course_tutors, not profiles.course_id, as the list
    // of a trainer's course links.
    await adminClient.from("course_tutors").insert({
      course_id: course.id,
      profile_id: created.user.id,
      tutor_role: tutorRole as TutorRole | null,
    });
  }

  if (role === "trainee") {
    const assignmentTypes = ["Focus on Learner", "LRT", "Skills", "LfC"] as const;
    const defaultMarkers = await defaultMarkerIdsForCourse(adminClient, course.id);
    await adminClient.from("assignments").insert(
      assignmentTypes.map((assignment_type) => ({
        course_id: course.id,
        trainee_id: created.user.id,
        assignment_type,
        marker_id: defaultMarkers[assignment_type] ?? null,
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
