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

  const { data: applicant } = await admin
    .from("applicants")
    .select("id")
    .eq("email", "demo-applicant-journey@celtaconnect.com")
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
