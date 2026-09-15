import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { courseTimetableIcs, icsFilename, tpGroupIdForTrainee, tpGroupIdsForTutor } from "@/lib/timetable-ics";

// The tutor's own calendar link. The candidate had one from day one
// (/api/portfolio/[traineeId]/timetable.ics) and the tutor had none, because
// that route is keyed to a candidate and a tutor is not one -- Ramy,
// 14 Sep 2026: "give the tutor the calendar link and a print view."
//
// Read-only, and the same course-wide timetable every one of these roles
// already sees on screen: their own course for staff, the course a candidate
// is on for that candidate, the visit's course for an assessor's token.
export async function GET(_request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const session = await getCurrentProfile();
  const viewer = session?.profile ?? null;
  const assessorCourseId = !viewer ? await getAssessorCourseId() : null;

  const allowed = viewer
    ? (viewer.role === "trainer" || viewer.role === "admin" || viewer.role === "trainee") && viewer.course_id === courseId
    : assessorCourseId === courseId;
  if (!allowed) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

  const supabase = assessorCourseId ? createAdminClient() : await createClient();
  const { data: course } = await supabase.from("courses").select("name").eq("id", courseId).maybeSingle();
  if (!course) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // The reader's own group's lessons, one entry per slot: a tutor's groups,
  // a candidate's own, and for an assessor or an admin whichever comes first.
  const viewerGroupIds =
    viewer?.role === "trainee"
      ? await tpGroupIdForTrainee(supabase, viewer.id).then((id) => (id ? new Set([id]) : null))
      : viewer
        ? await tpGroupIdsForTutor(supabase, courseId, viewer.id).then((s) => (s.size > 0 ? s : null))
        : null;
  return new NextResponse(await courseTimetableIcs(supabase, courseId, viewerGroupIds), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": icsFilename(course.name),
    },
  });
}
