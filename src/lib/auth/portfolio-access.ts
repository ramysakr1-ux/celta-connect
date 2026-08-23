import "server-only";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export const ASSESSOR_COOKIE = "assessor_token";

// for-claude-code-assessor-tour-mode.md: a second, deliberately separate
// cookie rather than a query param -- a query param would need threading
// through every link the tour opens (trainer dashboard, portfolio,
// timetable, resource hub, and everything each of those link to in turn),
// while a cookie just rides along automatically the same way
// ASSESSOR_COOKIE already does. Plain "on/off", no expiry of its own: it's
// meaningless without a valid, still-live assessor token backing it (every
// caller checks isAssessorTourMode() alongside getAssessorCourseId(), never
// instead of it), so it can't outlive or substitute for the real session.
export const ASSESSOR_TOUR_COOKIE = "assessor_tour_mode";

export async function isAssessorTourMode(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get(ASSESSOR_TOUR_COOKIE)?.value === "1";
}

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

// Separate from getAssessorCourseId() on purpose: that function is used
// everywhere as a blunt "is this a live assessor session" check, and
// folding the terms-gate into it would make an assessor who just hasn't
// clicked accept yet indistinguishable from an invalid/expired link --
// they'd land on "this link is not valid" instead of the gate they still
// need to finish. Only the couple of entry points that need to send
// someone to /assessor/gate specifically call this instead.
export async function getAssessorTermsStatus(): Promise<{ courseId: string; accepted: boolean } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ASSESSOR_COOKIE)?.value;
  if (!token) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("course_access_tokens")
    .select("course_id, expires_at, terms_accepted_at")
    .eq("token", token)
    .eq("role", "assessor")
    .maybeSingle();

  if (!data || new Date(data.expires_at) < new Date()) return null;
  return { courseId: data.course_id, accepted: Boolean(data.terms_accepted_at) };
}
