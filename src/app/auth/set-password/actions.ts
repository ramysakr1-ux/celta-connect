"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface SetPasswordState {
  error: string | null;
}

export async function setPassword(
  _prevState: SetPasswordState,
  formData: FormData
): Promise<SetPasswordState> {
  const password = formData.get("password");
  const confirmPassword = formData.get("confirm_password");

  if (
    typeof password !== "string" ||
    typeof confirmPassword !== "string" ||
    !password ||
    !confirmPassword
  ) {
    return { error: "Enter and confirm your new password." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?error=session_expired");
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    // The message below is what the person reads; this is what we read.
    console.error("[auth/set-password:setPassword]", error);
    return { error: "Could not set your password. Try again." };
}

  redirect("/dashboard");
}
