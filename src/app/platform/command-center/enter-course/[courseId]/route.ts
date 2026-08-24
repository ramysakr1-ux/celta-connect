import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { switchActiveCourse } from "@/app/trainer/(hub)/switch-course-actions";

// "Your courses" links here rather than straight to /trainer, because
// landing on the trainer app is only correct once profile.course_id
// actually points at the course being opened -- switchActiveCourse is the
// existing mechanism for that (course_tutors link, no override).
export async function GET(_req: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  await requireRole("platform_owner");

  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
  const { error } = await switchActiveCourse(courseId);
  if (error) return NextResponse.redirect(new URL("/platform/command-center", siteUrl));

  return NextResponse.redirect(new URL("/trainer", siteUrl));
}
