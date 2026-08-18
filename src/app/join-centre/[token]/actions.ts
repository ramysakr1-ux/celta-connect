"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface JoinCentreState {
  error: string | null;
}

export async function joinCentre(_prevState: JoinCentreState, formData: FormData): Promise<JoinCentreState> {
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
  if (!formData.get("agree_data") || !formData.get("agree_ip") || !formData.get("agree_export")) {
    return { error: "You need to agree to all the checkboxes to continue." };
  }

  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("centre_admin_invites")
    .select("id, center_id, role, created_by, used_at, revoked_at")
    .eq("token", token)
    .maybeSingle();
  if (!invite || invite.used_at || invite.revoked_at) {
    return { error: "This invite link is invalid or has already been used." };
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
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

  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    email,
    full_name: fullName,
    role: "admin",
    center_id: invite.center_id,
    terms_accepted_at: new Date().toISOString(),
  });
  if (profileError) {
    return { error: "Could not finish setting up your account. Try again." };
  }

  const { error: roleError } = await admin.from("centre_roles").insert({
    profile_id: created.user.id,
    center_id: invite.center_id,
    role: invite.role,
    granted_by: invite.created_by,
  });
  if (roleError) {
    return { error: "Could not finish setting up your role. Try again." };
  }

  await admin
    .from("centre_admin_invites")
    .update({ used_at: new Date().toISOString(), used_by: created.user.id })
    .eq("id", invite.id);

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    redirect("/login");
  }

  redirect("/centre");
}
