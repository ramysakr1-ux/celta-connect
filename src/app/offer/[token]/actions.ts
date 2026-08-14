"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CELTA_CRITERIA_CODES } from "@/lib/celta-criteria";

export interface AcceptOfferState {
  error: string | null;
}

// "Accepting is what creates the account." Mirrors
// join/[token]/actions.ts's joinCourse trainee path almost exactly --
// same account-creation shape, same seed rows, same disclosures -- just
// keyed by offer_token instead of a course join token, and name/email
// come from the applicant record rather than being retyped ("the
// applicant's name... never retyped between there and the certificate").
export async function acceptOffer(_prevState: AcceptOfferState, formData: FormData): Promise<AcceptOfferState> {
  const token = formData.get("token");
  const password = formData.get("password");
  const confirmPassword = formData.get("confirm_password");

  if (
    typeof token !== "string" ||
    typeof password !== "string" ||
    typeof confirmPassword !== "string" ||
    !token ||
    !password ||
    !confirmPassword
  ) {
    return { error: "Choose a password to accept." };
  }
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirmPassword) return { error: "Passwords do not match." };
  if (!formData.get("agree_ip") || !formData.get("agree_data") || !formData.get("agree_ai_policy") || !formData.get("agree_fingerprint")) {
    return { error: "You need to agree to all the checkboxes to accept." };
  }

  const admin = createAdminClient();
  const { data: applicant } = await admin.from("applicants").select("*").eq("offer_token", token).maybeSingle();
  if (!applicant || applicant.stage !== "offer_sent") {
    return { error: "This offer link is invalid or has already been used." };
  }
  if (applicant.offer_accept_by && applicant.offer_accept_by < new Date().toISOString().slice(0, 10)) {
    return { error: "This offer has expired. Contact the centre." };
  }

  const uln = (formData.get("uln") as string | null)?.trim() || null;
  const specialConsideration = (formData.get("special_consideration") as string | null)?.trim() || null;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: applicant.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: applicant.full_name },
  });

  if (createError || !created.user) {
    if (createError?.code === "email_exists") {
      return { error: "That email is already registered -- try logging in instead." };
    }
    return { error: createError?.message ?? "Could not create your account. Try again." };
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    email: applicant.email,
    full_name: applicant.full_name,
    role: "trainee",
    center_id: applicant.center_id,
    course_id: applicant.intake_course_id,
    special_consideration: specialConsideration,
    uln,
    terms_accepted_at: new Date().toISOString(),
  });
  if (profileError) return { error: "Could not finish setting up your account. Try again." };

  const assignmentTypes = ["Focus on Learner", "LRT", "Skills", "LfC"] as const;
  await admin.from("assignments").insert(
    assignmentTypes.map((assignment_type) => ({
      course_id: applicant.intake_course_id,
      trainee_id: created.user.id,
      assignment_type,
    }))
  );
  await admin.from("celta5_matrix").insert(
    CELTA_CRITERIA_CODES.map((criteria_code) => ({
      course_id: applicant.intake_course_id,
      trainee_id: created.user.id,
      criteria_code,
    }))
  );
  await admin.from("celta5_records").insert({ course_id: applicant.intake_course_id, trainee_id: created.user.id });

  await admin
    .from("applicants")
    .update({ stage: "accepted", accepted_at: new Date().toISOString(), resulting_trainee_id: created.user.id })
    .eq("id", applicant.id);

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email: applicant.email, password });
  if (signInError) redirect("/login");
  redirect("/dashboard");
}
