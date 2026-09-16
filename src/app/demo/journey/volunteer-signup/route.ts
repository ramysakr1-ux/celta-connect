import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pickDemoCourse } from "@/lib/demo-course";

// Part of the application-journey showcase (Ramy, 2026-08-25). Pairs with
// /demo/volunteer (which shows the ALREADY-signed-up ongoing dashboard,
// Emeka Nwosu) -- this one shows the very first step instead: the seeded
// journey volunteer (Grace Adeyemi) reset to not-yet-signed-up on every
// visit, so /student/[token] always lands on the real signup form rather
// than "already completed" after the first person tries it.
export async function GET() {
  const admin = createAdminClient();
  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
  const fallback = () => NextResponse.redirect(new URL("/", siteUrl));

  // Scoped to the demo course, and never `maybeSingle()` on a NAME.
  //
  // 16 Sep 2026: this link had been sending people to the sign-in page. The
  // walkthrough course (cloned from the demo) carries its own Grace Adeyemi,
  // so the name matched two rows, maybeSingle returned null, and the route
  // fell back to "/" -- which redirects to /login. A name is not a key. Same
  // demo-centre / demo-course resolution the assessor entry uses.
  const { data: demoCenter } = await admin
    .from("centers")
    .select("id")
    .eq("is_demo", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!demoCenter) return fallback();
  const course = await pickDemoCourse<{ id: string; end_date: string; start_date: string }>(
    admin,
    demoCenter.id,
    "id, end_date, start_date"
  );
  if (!course) return fallback();

  const { data: volunteers } = await admin
    .from("volunteer_students")
    .select("id")
    .eq("name", "Grace Adeyemi")
    .eq("course_id", course.id)
    .order("created_at", { ascending: true })
    .limit(1);
  const volunteer = volunteers?.[0];
  if (!volunteer) return fallback();

  // Ramy, 25 Aug 2026: "I can't stop. It doesn't stop" turned out to be a
  // real submission failure, not a UI bug -- volunteer_signup_profiles has
  // (correctly) a one-row-per-volunteer unique constraint, but this reset
  // only ever cleared signup_completed_at back to null, never the actual
  // profile row a completed run had already written. The very first
  // person to ever finish this demo permanently broke every future
  // attempt with "Could not save your answers." Clear the stray row (and
  // its uploaded audio) on every reset, not just the completed-at flag.
  const { data: staleProfile } = await admin
    .from("volunteer_signup_profiles")
    .select("id, audio_url")
    .eq("volunteer_student_id", volunteer.id)
    .maybeSingle();
  if (staleProfile) {
    await admin.from("volunteer_signup_profiles").delete().eq("id", staleProfile.id);
    if (staleProfile.audio_url) {
      await admin.storage.from("volunteer-signup-audio").remove([staleProfile.audio_url]);
    }
  }

  await admin.from("volunteer_students").update({ signup_completed_at: null }).eq("id", volunteer.id);

  const { data: accessToken } = await admin
    .from("course_access_tokens")
    .select("token")
    .eq("volunteer_student_id", volunteer.id)
    .maybeSingle();
  if (!accessToken) return fallback();

  return NextResponse.redirect(new URL(`/student/${accessToken.token}`, siteUrl));
}
