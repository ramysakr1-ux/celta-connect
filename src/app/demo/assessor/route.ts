import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pickDemoCourse } from "@/lib/demo-course";
import { DEMO_DAY_COOKIE, parseDemoDay } from "@/lib/demo-clock";
import { demoTokenDestination } from "@/lib/demo/demo-destination";
import { demoWouldReplaceRealSession } from "@/lib/demo/demo-session-guard";

// Sixth demo entry point (the original five -- centre-admin, course-admin,
// volunteer, trainer, trainee -- didn't include this one). Assessors never
// get a real Supabase Auth account either (course_access_tokens + a cookie,
// same as volunteer/student), so this mirrors demo/volunteer/route.ts:
// mint or reuse a permanently-valid token for the demo course and hand off
// to the same /assessor/[token] entry any real assessor uses. Skips the
// real flow's computeAssessorReadiness gate on purpose -- that's a genuine
// "portfolios must be complete" business rule for a live course, and
// shouldn't be able to make the demo link flaky depending on what the
// seed data happens to look like on a given day.
// `?day=N` pins the demo clock on the way through, the same as every other
// demo entry (for-claude-code-demo-clock.md). These two mint a token rather
// than a magic link, so they set the cookie on their own redirect.
function withDemoDay(response: NextResponse, request: Request): NextResponse {
  const day = parseDemoDay(new URL(request.url).searchParams.get("day"));
  if (day === null) response.cookies.delete(DEMO_DAY_COOKIE);
  else response.cookies.set(DEMO_DAY_COOKIE, String(day), { path: "/", sameSite: "lax", maxAge: 60 * 60 * 12 });
  return response;
}

export async function GET(request: Request) {
  // One screen first if a real session is about to be replaced
  // (demo-session-guard.ts).
  const swap = await demoWouldReplaceRealSession(request);
  if (swap) return swap;
  const admin = createAdminClient();
  // ?to= is a path UNDER this pack's token root, so a card can open the
  // lesson plans or the marking guidance and can never point at another
  // room (demo-destination.ts).
  const to = new URL(request.url).searchParams.get("to");
  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
  const fallback = () => NextResponse.redirect(new URL("/", siteUrl));

  // Oldest demo centre, not "the" demo centre. maybeSingle() throws the
  // moment a second one exists, and this file already carries a comment
  // about exactly that failure with volunteers -- the same shape bit again
  // when a second demo branch was added so a centre owner could hold two.
  // Ordering by created_at keeps this pointed at the original, richly
  // seeded branch rather than whichever row came back first.
  const { data: demoCenter } = await admin
    .from("centers")
    .select("id")
    .eq("is_demo", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!demoCenter) return fallback();

  // The course running today, not the newest row -- see pickDemoCourse.
  const course = await pickDemoCourse<{ id: string; end_date: string; start_date: string }>(admin, demoCenter.id, "id, end_date, start_date");
  if (!course) return fallback();

  const { data: existing } = await admin
    .from("course_access_tokens")
    .select("token, terms_accepted_at")
    .eq("course_id", course.id)
    .eq("role", "assessor")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (existing) {
    // A token minted before the fix above may still have no acceptance on
    // it, which would strand this visitor at the gate too.
    if (!existing.terms_accepted_at) {
      await admin
        .from("course_access_tokens")
        .update({ terms_accepted_at: new Date().toISOString() })
        .eq("token", existing.token);
    }
    return withDemoDay(NextResponse.redirect(new URL(demoTokenDestination(to, `/assessor/${existing.token}`), siteUrl)), request);
  }

  // Demo courses can have an end_date in the past (the "Closed" spring
  // course) -- don't let that make the token expire before anyone uses it.
  // A year out is plenty for a demo link that's meant to always work.
  const farFuture = new Date();
  farFuture.setFullYear(farFuture.getFullYear() + 1);
  const { data: created } = await admin
    .from("course_access_tokens")
    // Terms are pre-accepted on the DEMO link specifically. A real
    // assessor accepts them at /assessor/gate, which writes to this row --
    // but demo centres are read-only at the database layer (migration
    // 0079's trigger), so that write can never succeed here and the demo
    // assessor was stuck at the gate forever after any reseed. Ramy hit it
    // as "there's no way to go back". The real flow is untouched.
    .insert({
      course_id: course.id,
      role: "assessor",
      expires_at: farFuture.toISOString(),
      terms_accepted_at: new Date().toISOString(),
    })
    .select("token")
    .single();
  if (!created) return fallback();

  return withDemoDay(NextResponse.redirect(new URL(demoTokenDestination(to, `/assessor/${created.token}`), siteUrl)), request);
}
