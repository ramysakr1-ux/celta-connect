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

  const { data: demoCenter } = await admin.from("centers").select("id").eq("is_demo", true).maybeSingle();
  if (!demoCenter) return fallback();

  const { data: course } = await admin
    .from("courses")
    .select("id")
    .eq("center_id", demoCenter.id)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!course) return fallback();

  const { data: accessToken } = await admin
    .from("course_access_tokens")
    .select("token")
    .eq("course_id", course.id)
    .eq("role", "volunteer_student")
    .maybeSingle();
  if (!accessToken) return fallback();

  return NextResponse.redirect(new URL(`/student/${accessToken.token}`, siteUrl));
}
