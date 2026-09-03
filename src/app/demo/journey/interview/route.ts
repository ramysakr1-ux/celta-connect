import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Part of the application-journey showcase (Ramy, 2026-08-25): unlike the
// five /demo/<role> entries, /interview/[token] is a PUBLIC, unauthenticated
// page that writes through the admin client -- migration 0079's demo-write
// trigger only blocks `auth.role() = 'authenticated'` sessions, so it does
// NOT protect this route. Booking a slot here would otherwise permanently
// consume it for the next visitor. This route resets the seeded journey
// applicant (demo-applicant-journey@celtaconnect.com) to a fresh,
// not-yet-booked state and makes sure an open slot exists before every
// redirect, so the link never goes stale no matter how many times it's used.
export async function GET() {
  const admin = createAdminClient();
  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
  const fallback = () => NextResponse.redirect(new URL("/", siteUrl));

  const { data: applicant } = await admin
    .from("applicants")
    .select("id, center_id, intake_course_id")
    .eq("email", "demo-applicant-journey@celtaconnect.com")
    .maybeSingle();
  if (!applicant) return fallback();

  const { data: mct } = await admin.from("profiles").select("id").eq("email", "demo-trainer@celtaconnect.com").maybeSingle();
  if (!mct) return fallback();

  // Un-book anything a previous visitor booked, then open a fresh slot two
  // days out so there's always something pickable.
  await admin.from("interview_slots").update({ booked_applicant_id: null }).eq("booked_applicant_id", applicant.id);
  const slotDate = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  await admin.from("interview_slots").insert({
    center_id: applicant.center_id,
    intake_course_id: applicant.intake_course_id,
    interviewer_id: mct.id,
    slot_date: slotDate,
    slot_time: "10:00",
    duration_minutes: 30,
    mode: "online",
    created_by: mct.id,
  });

  const token = crypto.randomUUID();
  const { error } = await admin
    .from("applicants")
    // interview_rescheduled_at cleared too: the demo applicant's one
    // reschedule was spent the day it was built (3 Sep 2026, testing it
    // live), and without this the journey showed "you have already moved
    // this interview once" on every visit afterwards. A reset is a reset.
    .update({ stage: "task_returned", interview_invite_token: token, interview_rescheduled_at: null })
    .eq("id", applicant.id);
  if (error) return fallback();

  return NextResponse.redirect(new URL(`/interview/${token}`, siteUrl));
}
