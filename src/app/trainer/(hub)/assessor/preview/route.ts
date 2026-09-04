import "server-only";
import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { ASSESSOR_COOKIE, ASSESSOR_PREVIEW_COOKIE } from "@/lib/auth/portfolio-access";
import { getOrCreateAssessorToken } from "@/app/trainer/assessor-actions";

// "Preview as the assessor" -- the missing feature the v4 handoff named.
//
// Uses the real token, through the same readiness gate as the share link
// and the email: if a portfolio is not complete the preview refuses too, so
// what the MCT sees is exactly what the assessor's link would show and
// nothing the link would refuse. The only difference is the preview cookie,
// which skips the terms gate (that acceptance is the assessor's to give, not
// the MCT's) and turns /assessor/exit into a way back to this tab.
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const session = await getCurrentProfile();
  const profile = session?.profile;
  if (!profile || !["trainer", "admin", "platform_owner"].includes(profile.role) || !profile.course_id) {
    return NextResponse.redirect(`${origin}/login`);
  }

  let isMct = profile.role === "admin";
  if (!isMct) {
    const { data: link } = await createAdminClient()
      .from("course_tutors")
      .select("tutor_role")
      .eq("course_id", profile.course_id)
      .eq("profile_id", profile.id)
      .is("left_at", null)
      .maybeSingle();
    isMct = link?.tutor_role === "main_course_tutor";
  }
  if (!isMct) return NextResponse.redirect(`${origin}/trainer`);

  const { token } = await getOrCreateAssessorToken();
  if (!token) return NextResponse.redirect(`${origin}/trainer/assessor?preview=not-ready`);

  const { data: row } = await createAdminClient().from("course_access_tokens").select("expires_at").eq("token", token).maybeSingle();
  const expires = row ? new Date(row.expires_at) : undefined;
  const response = NextResponse.redirect(`${origin}/assessor`);
  const opts = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", expires };
  response.cookies.set(ASSESSOR_COOKIE, token, opts);
  response.cookies.set(ASSESSOR_PREVIEW_COOKIE, "1", opts);
  return response;
}
