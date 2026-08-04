import "server-only";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export const ASSESSOR_COOKIE = "assessor_token";

// §11 -- an assessor never gets a real Supabase Auth session (same
// tokenized/course-scoped/auto-expiring link mechanism as volunteer
// students, see migration 0030's course_access_tokens). After the token is
// validated once at /assessor/[token], its value is carried forward in a
// plain httpOnly cookie so every portfolio/roster page can re-check it on
// each request without re-issuing a link. Read-only by construction: this
// only ever returns a course_id to scope SELECT queries against via the
// admin client (RLS has no auth.uid() to key off for this viewer at all) --
// it never grants access to any Server Action, which all still gate on
// requireRole() and simply fail closed for a sessionless caller.
export async function getAssessorCourseId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ASSESSOR_COOKIE)?.value;
  if (!token) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("course_access_tokens")
    .select("course_id, expires_at")
    .eq("token", token)
    .eq("role", "assessor")
    .maybeSingle();

  if (!data || new Date(data.expires_at) < new Date()) return null;
  return data.course_id;
}
