import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  const { data: volunteer } = await admin.from("volunteer_students").select("id").eq("name", "Grace Adeyemi").maybeSingle();
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
