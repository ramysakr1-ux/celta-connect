import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Volunteer students never get a real Supabase Auth account (migration
// 0030) -- so unlike the other four demo entries, this one doesn't mint a
// magic link. It looks up the permanently reusable token
// scripts/seed-demo.mjs already created and redirects straight into the
// same tokenized /student/[token] view any real volunteer uses.
export async function GET() {
  const admin = createAdminClient();
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

  const { data: course } = await admin
    .from("courses")
    .select("id")
    .eq("center_id", demoCenter.id)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();
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

  return NextResponse.redirect(new URL(`/student/${accessToken.token}`, siteUrl));
}
