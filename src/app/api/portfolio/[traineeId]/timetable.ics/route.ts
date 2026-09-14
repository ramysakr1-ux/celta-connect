import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { courseTimetableIcs, icsFilename } from "@/lib/timetable-ics";

// for-claude-code-trainee-interface.md's Timetable tab "Add to my
// calendar" action. Trainee-self, staff, or assessor can all fetch this --
// it's a read-only export of the same course-wide timetable those roles
// already see on-screen, not private data.
//
// The calendar itself is built in lib/timetable-ics.ts, shared with the
// tutor's own link at /api/courses/[courseId]/timetable.ics.
export async function GET(_request: Request, { params }: { params: Promise<{ traineeId: string }> }) {
  const { traineeId } = await params;
  const session = await getCurrentProfile();
  const viewer = session?.profile ?? null;
  const isStaff = viewer?.role === "trainer" || viewer?.role === "admin";
  const isSelf = viewer?.role === "trainee" && viewer.id === traineeId;
  const assessorCourseId = !viewer ? await getAssessorCourseId() : null;

  if (!isStaff && !isSelf && !assessorCourseId) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const supabase = assessorCourseId ? createAdminClient() : await createClient();
  const { data: trainee } = await supabase.from("profiles").select("course_id, full_name").eq("id", traineeId).maybeSingle();
  if (!trainee?.course_id) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (assessorCourseId && trainee.course_id !== assessorCourseId) return NextResponse.json({ error: "Not found." }, { status: 404 });

  return new NextResponse(await courseTimetableIcs(supabase, trainee.course_id), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": icsFilename(trainee.full_name),
    },
  });
}
