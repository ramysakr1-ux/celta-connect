import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderFinalReportBuffer } from "@/lib/final-report-pdf/document";

// Same three-way viewer resolution as every /portfolio/[traineeId]/* page
// this session (trainee-self / real staff / assessor-via-cookie), reused
// here rather than invented fresh for this one route.
//
// Two distinct gates, not one (Ramy, 2026-08-05): trainer_signoff_final_at
// is the trainer's internal finalize step at course end -- staff/assessor
// can download from that moment. A trainee's OWN copy is a separate, later
// event (final_report_released_at, migration 0038) -- "maybe a week after
// the course... never during the course," once Cambridge has actually
// confirmed things. This is unrelated to the Grades Report (provisional/
// final grade), which stays trainer+assessor-only forever regardless.
export async function GET(_request: Request, { params }: { params: Promise<{ traineeId: string }> }) {
  const { traineeId } = await params;
  const session = await getCurrentProfile();
  const viewer = session?.profile ?? null;
  const isStaff = viewer?.role === "trainer" || viewer?.role === "admin";
  const assessorCourseId = !viewer ? await getAssessorCourseId() : null;

  if (!viewer && !assessorCourseId) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  if (viewer && !isStaff && viewer.id !== traineeId) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const supabase = assessorCourseId ? createAdminClient() : await createClient();
  // celta5_records has no trainee-self RLS SELECT (same restriction as the
  // portfolio celta5 page -- a trainee only ever reads it through
  // get_my_celta5_record(), which masks the grade fields entirely). This
  // route already independently re-authorizes the viewer above, so once
  // that's done it's safe to read the real row directly via the admin
  // client rather than going through that masking RPC.
  const admin = createAdminClient();

  const { data: trainee } = await supabase
    .from("profiles")
    .select("full_name, course_id, center_id")
    .eq("id", traineeId)
    .maybeSingle();
  if (!trainee || !trainee.course_id) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (assessorCourseId && trainee.course_id !== assessorCourseId) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const isTraineeSelf = !isStaff && !assessorCourseId;

  const [{ data: course }, { data: center }, { data: record }, { data: trainers }] = await Promise.all([
    supabase.from("courses").select("name, start_date, end_date, total_hours").eq("id", trainee.course_id).maybeSingle(),
    supabase.from("centers").select("name, logo_url").eq("id", trainee.center_id).maybeSingle(),
    admin.from("celta5_records").select("*").eq("trainee_id", traineeId).maybeSingle(),
    // Admin client regardless of viewer: profiles RLS only lets a trainee
    // read their own row (plus subgroup-mates), so the session-scoped
    // client silently returns zero trainers here for a trainee viewer.
    // Trainer name + role on the trainee's own finalized report isn't
    // sensitive -- this mirrors how course/center are already visible.
    admin.from("profiles").select("full_name").eq("course_id", trainee.course_id).eq("role", "trainer").order("full_name"),
  ]);

  if (
    !record ||
    !record.final_recommended_grade ||
    record.final_recommended_grade === "Withdrawn" ||
    record.final_recommended_grade === "Extension" ||
    record.final_recommended_grade === "Deferred"
  ) {
    return NextResponse.json({ error: "No final grade has been recommended yet." }, { status: 409 });
  }
  if (!record.trainer_signoff_final_at) {
    return NextResponse.json({ error: "This record hasn't been finalized yet." }, { status: 409 });
  }
  if (isTraineeSelf && !record.final_report_released_at) {
    return NextResponse.json({ error: "Your final report hasn't been released yet." }, { status: 409 });
  }
  if (!course) {
    return NextResponse.json({ error: "Course not found." }, { status: 404 });
  }

  const buffer = await renderFinalReportBuffer({
    traineeName: trainee.full_name,
    courseName: course.name,
    centerName: center?.name ?? "",
    centerLogoUrl: center?.logo_url ?? null,
    courseStartDate: course.start_date,
    courseEndDate: course.end_date,
    totalHours: course.total_hours,
    finalGrade: record.final_recommended_grade,
    teachingGrade: record.final_teaching_grade,
    assignmentsGrade: record.final_assignments_grade,
    overallComment: record.overall_notes,
    signatories: (trainers ?? []).map((t) => ({ name: t.full_name, role: "CELTA Course Tutor" })),
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Final-Report-${trainee.full_name.replace(/\s+/g, "-")}.pdf"`,
    },
  });
}
