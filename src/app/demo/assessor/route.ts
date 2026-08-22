import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
export async function GET() {
  const admin = createAdminClient();
  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
  const fallback = () => NextResponse.redirect(new URL("/", siteUrl));

  const { data: demoCenter } = await admin.from("centers").select("id").eq("is_demo", true).maybeSingle();
  if (!demoCenter) return fallback();

  const { data: course } = await admin
    .from("courses")
    .select("id, end_date")
    .eq("center_id", demoCenter.id)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!course) return fallback();

  const { data: existing } = await admin
    .from("course_access_tokens")
    .select("token")
    .eq("course_id", course.id)
    .eq("role", "assessor")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (existing) return NextResponse.redirect(new URL(`/assessor/${existing.token}`, siteUrl));

  // Demo courses can have an end_date in the past (the "Closed" spring
  // course) -- don't let that make the token expire before anyone uses it.
  // A year out is plenty for a demo link that's meant to always work.
  const farFuture = new Date();
  farFuture.setFullYear(farFuture.getFullYear() + 1);
  const { data: created } = await admin
    .from("course_access_tokens")
    .insert({ course_id: course.id, role: "assessor", expires_at: farFuture.toISOString() })
    .select("token")
    .single();
  if (!created) return fallback();

  return NextResponse.redirect(new URL(`/assessor/${created.token}`, siteUrl));
}
