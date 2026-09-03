import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mintDemoMagicLink } from "@/lib/demo/mint-magic-link";

// The interview record -- the step the journey described but never opened.
//
// Ramy, 3 Sep 2026: "the actual precourse task, the interview. The whole
// process should be in the journey." The journey listed the centre's question
// bank and said both parties sign the record afterward, but there was nowhere
// to go and look at one. The applicant side of an interview is only the
// booking page; the interview itself is a meeting, and what Connect holds is
// the record of it, on the admissions side.
//
// So this lands a demo staff session straight on the demo applicant's own
// page, where the interview record form lives -- the questions drawn for them,
// the scoring, and the two signatures.
export async function GET() {
  const admin = createAdminClient();
  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";

  const { data: applicant } = await admin
    .from("applicants")
    .select("id")
    .eq("email", "demo-applicant-journey@celtaconnect.com")
    .maybeSingle();

  // No demo applicant means the demo has not been seeded; the admissions
  // pipeline itself is still a truthful place to land.
  if (!applicant) return mintDemoMagicLink("demo-course-admin@celtaconnect.com", "/dashboard/admissions");

  return mintDemoMagicLink("demo-course-admin@celtaconnect.com", `/dashboard/admissions/${applicant.id}`);
}
