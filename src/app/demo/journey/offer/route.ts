import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Part of the application-journey showcase (Ramy, 2026-08-25) -- same
// reasoning as /demo/journey/interview/route.ts: /offer/[token] is public
// and writes through the admin client, unprotected by the demo-write
// trigger. Resets the seeded journey applicant to a fresh "offer_sent"
// state with a far-future accept-by date on every visit, so the link never
// shows "expired" or "already used" regardless of what a previous visitor
// did on the page.
//
// Ramy, 2026-08-25: accepting an offer creates a REAL Supabase auth account
// (password and all) -- that write genuinely isn't reversible from here, so
// this is deliberately "view only, freshly reset" rather than something the
// journey page encourages actually submitting. The page itself carries that
// caveat in its own copy, not this route.
export async function GET() {
  const admin = createAdminClient();
  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
  const fallback = () => NextResponse.redirect(new URL("/", siteUrl));
  // Not `maybeSingle()` on the email: a second row with the same address was
  // seeded on 13 Sep 2026, so this matched two applicants and returned null,
  // and the route fell back to "/" -- which redirects to /login. That is what
  // "the journey links don't work" was (16 Sep 2026). Oldest row wins, which
  // is the original fixture; the duplicate is data to clean separately.

  const { data: applicant } = await admin
    .from("applicants")
    .select("id")
    .eq("email", "demo-applicant-journey@celtaconnect.com")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!applicant) return fallback();

  const token = crypto.randomUUID();
  const { error } = await admin
    .from("applicants")
    .update({
      stage: "offer_sent",
      offer_token: token,
      offer_accept_by: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      place_offer_expires_at: null,
      workspace_released_at: new Date().toISOString(),
      deposit_amount: 500,
    })
    .eq("id", applicant.id);
  if (error) return fallback();

  return NextResponse.redirect(new URL(`/offer/${token}`, siteUrl));
}
