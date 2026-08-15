import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ASSESSOR_COOKIE } from "@/lib/auth/portfolio-access";

// §11 -- entry point for an assessor's link. Validates the token once here,
// then carries it forward as a plain httpOnly cookie (see
// getAssessorCourseId) so /trainer and every /portfolio/[traineeId]/* page
// can re-check it per request without a Supabase session existing at all.
// A route handler (not a page) because setting a cookie requires one.
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: accessToken } = await admin
    .from("course_access_tokens")
    .select("expires_at")
    .eq("token", token)
    .eq("role", "assessor")
    .maybeSingle();

  const origin = new URL(request.url).origin;

  if (!accessToken || new Date(accessToken.expires_at) < new Date()) {
    return NextResponse.redirect(`${origin}/login?error=assessor_link_invalid`);
  }

  const response = NextResponse.redirect(`${origin}/assessor`);
  response.cookies.set(ASSESSOR_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(accessToken.expires_at),
  });
  return response;
}
