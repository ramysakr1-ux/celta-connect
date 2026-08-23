import "server-only";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ASSESSOR_COOKIE, ASSESSOR_TOUR_COOKIE, getAssessorTermsStatus } from "@/lib/auth/portfolio-access";

// for-claude-code-assessor-tour-mode.md: "Take a tour" on the pack landing
// page. Requires a live, terms-accepted assessor session already -- tour
// mode only ever widens what an already-verified assessor can browse, it
// is never its own way in. Lands on /trainer (Today), the natural start of
// a browse through the wider platform.
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const cookieStore = await cookies();
  const token = cookieStore.get(ASSESSOR_COOKIE)?.value;
  const termsStatus = await getAssessorTermsStatus();

  if (!token || !termsStatus) return NextResponse.redirect(`${origin}/login?error=assessor_link_invalid`);
  if (!termsStatus.accepted) return NextResponse.redirect(`${origin}/assessor/gate`);

  const response = NextResponse.redirect(`${origin}/trainer`);
  // Same lifetime as the assessor token itself -- meaningless once that
  // expires, and there's no independent reason for this to outlive it.
  response.cookies.set(ASSESSOR_TOUR_COOKIE, "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  return response;
}
