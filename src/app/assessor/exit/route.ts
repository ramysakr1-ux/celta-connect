import "server-only";
import { NextResponse } from "next/server";
import { ASSESSOR_COOKIE, ASSESSOR_TOUR_COOKIE } from "@/lib/auth/portfolio-access";

// Leaves the assessor view.
//
// Staff who open an assessor link to check what the assessor sees now stay in
// the assessor view for as long as the cookie lives, which is the point --
// but without this there was no way back out except clearing cookies by hand.
// A real assessor never needs it and never sees the control that points here.
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const response = NextResponse.redirect(`${origin}/trainer`);
  for (const name of [ASSESSOR_COOKIE, ASSESSOR_TOUR_COOKIE]) {
    response.cookies.set(name, "", { httpOnly: true, path: "/", maxAge: 0 });
  }
  return response;
}
