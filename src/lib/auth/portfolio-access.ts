import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-profile";

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

// The MCT's own preview of the pack (Assessor tab, "Preview as the
// assessor"). Set by /trainer/assessor/preview alongside ASSESSOR_COOKIE
// (the real, readiness-gated token -- the preview shows exactly what the
// assessor's link shows, nothing more). Its one effect: the "Before you
// open the pack" terms gate is skipped, so the MCT's look never stamps
// terms_accepted_at on the assessor's behalf. Cleared by /assessor/exit.
export const ASSESSOR_PREVIEW_COOKIE = "assessor_preview";

export async function isAssessorPreview(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get(ASSESSOR_PREVIEW_COOKIE)?.value === "1";
}

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
// cache()'d -- confirmed 10 nested pages under /portfolio/[traineeId]
// independently re-running this same lookup on top of the identical call
// portfolio/[traineeId]/layout.tsx already made for the same request.
export const getAssessorCourseId = cache(async (): Promise<string | null> => {
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
});

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

// cache()'d -- the portfolio layout and its celta5 page both independently
// re-fetched the same trainee row for the same request (confirmed
// 2026-08-26 perf audit). Recomputes viewer/assessorCourseId internally
// rather than taking a supabase client as a parameter: both call sites
// build their own client instance via the identical
// `assessorCourseId ? createAdminClient() : await createClient()` pattern,
// and cache() dedupes on argument identity -- two different client
// instances would defeat the memoization, so this only takes traineeId.
export const getPortfolioTrainee = cache(async (traineeId: string) => {
  const session = await getCurrentProfile();
  const viewer = session?.profile ?? null;
  const assessorCourseId = !viewer ? await getAssessorCourseId() : null;
  const supabase = assessorCourseId ? createAdminClient() : await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, course_id, center_id, course_status, special_consideration, role, uln")
    .eq("id", traineeId)
    .eq("role", "trainee")
    .maybeSingle();
  return data;
});
