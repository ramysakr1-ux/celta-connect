import "server-only";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ASSESSOR_COOKIE, ASSESSOR_PREVIEW_COOKIE, ASSESSOR_TOUR_COOKIE } from "@/lib/auth/portfolio-access";

// Leaves the assessor view.
//
// Staff who open an assessor link to check what the assessor sees now stay in
// the assessor view for as long as the cookie lives, which is the point --
// but without this there was no way back out except clearing cookies by hand.
// A real assessor never needs it and never sees the control that points here.
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  // An MCT leaving their own preview goes back to the Assessor tab they
  // started from; anyone else lands on Today.
  const wasPreview = (await cookies()).get(ASSESSOR_PREVIEW_COOKIE)?.value === "1";
  const response = NextResponse.redirect(`${origin}${wasPreview ? "/trainer/assessor" : "/trainer"}`);
  for (const name of [ASSESSOR_COOKIE, ASSESSOR_TOUR_COOKIE, ASSESSOR_PREVIEW_COOKIE]) {
    response.cookies.set(name, "", { httpOnly: true, path: "/", maxAge: 0 });
  }
  return response;
}
