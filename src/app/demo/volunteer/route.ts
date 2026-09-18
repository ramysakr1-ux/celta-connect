import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pickDemoCourse } from "@/lib/demo-course";
import { DEMO_DAY_COOKIE, parseDemoDay } from "@/lib/demo-clock";
import { demoTokenDestination } from "@/lib/demo/demo-destination";
import { demoWouldReplaceRealSession } from "@/lib/demo/demo-session-guard";

// Volunteer students never get a real Supabase Auth account (migration
// 0030) -- so unlike the other four demo entries, this one doesn't mint a
// magic link. It looks up the permanently reusable token
// scripts/seed-demo.mjs already created and redirects straight into the
// same tokenized /student/[token] view any real volunteer uses.
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
  // ?to= is a path under this volunteer's own token root (demo-destination.ts).
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
  const course = await pickDemoCourse<{ id: string; start_date: string }>(admin, demoCenter.id, "id, start_date");
  if (!course) return fallback();

  // Ramy, 25 Aug 2026: this demo course now has more than one volunteer
  // student on it -- .maybeSingle() throws (not returns null) when a query
  // matches more than one row, and that error was silently swallowed here,
  // so a second volunteer being added broke this entry point entirely
  // (fell through to the "no token" fallback below, landing on /login).
  // .order + .limit(1) picks one deterministically instead of requiring
  // there only ever be one.
  const { data: accessToken } = await admin
    .from("course_access_tokens")
    .select("token")
    .eq("course_id", course.id)
    .eq("role", "volunteer_student")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!accessToken) return fallback();

  return withDemoDay(NextResponse.redirect(new URL(demoTokenDestination(to, `/student/${accessToken.token}`), siteUrl)), request);
}
