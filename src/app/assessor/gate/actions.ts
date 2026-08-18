"use server";

import "server-only";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { ASSESSOR_COOKIE } from "@/lib/auth/portfolio-access";

export async function acceptAssessorTerms(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ASSESSOR_COOKIE)?.value;
  if (!token) redirect("/login?error=assessor_link_invalid");

  const admin = createAdminClient();
  const { data } = await admin
    .from("course_access_tokens")
    .update({ terms_accepted_at: new Date().toISOString() })
    .eq("token", token)
    .eq("role", "assessor")
    .select("token")
    .maybeSingle();

  if (!data) redirect("/login?error=assessor_link_invalid");
  redirect("/assessor");
}
