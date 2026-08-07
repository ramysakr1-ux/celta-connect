import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ASSIGNMENT_CRITERIA } from "@/lib/assignment-criteria";
import { ASSIGNMENT_INFO } from "@/lib/assignment-info";
import { renderAssignmentCoverSheetBuffer } from "@/lib/assignment-cover-sheet-pdf/document";

// Same three-way viewer resolution as every /portfolio/[traineeId]/* route
// this session (trainee-self / real staff / assessor-via-cookie). Gated on
// at least one round having been returned (first_status not pending
// submission -- "submitted" or later) so the export button's disabled
// state (checkpoint 5's Area 2 gating precedent) matches what this route
// will actually generate.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ traineeId: string; assignmentId: string }> }
) {
  const { traineeId, assignmentId } = await params;
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

  const { data: assignment } = await supabase.from("assignments").select("*").eq("id", assignmentId).maybeSingle();
  if (!assignment || assignment.trainee_id !== traineeId) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (assignment.first_status !== "approved" && assignment.first_status !== "resubmission_required") {
    return NextResponse.json({ error: "Nothing to export until at least one round has been returned." }, { status: 409 });
  }

  const [{ data: course }, { data: center }, { data: template }, { data: responses }, { data: markers }] = await Promise.all([
    supabase.from("courses").select("name, start_date, end_date").eq("id", trainee.course_id).maybeSingle(),
    supabase.from("centers").select("name, logo_url").eq("id", trainee.center_id).maybeSingle(),
    supabase
      .from("assignment_templates")
      .select("sections")
      .eq("center_id", trainee.center_id)
      .eq("assignment_type", assignment.assignment_type)
      .not("published_at", "is", null)
      .maybeSingle(),
    supabase.from("assignment_section_responses").select("*").eq("assignment_id", assignmentId),
    admin
      .from("profiles")
      .select("id, full_name")
      .in("id", [assignment.marker_id, assignment.second_marker_id].filter((id): id is string => Boolean(id))),
  ]);

  if (!course) {
    return NextResponse.json({ error: "Course not found." }, { status: 404 });
  }

  const markerName = new Map((markers ?? []).map((m) => [m.id, m.full_name]));
  const hasResubmission = assignment.resubmission_status !== "not_submitted";

  const outcome: "pass" | "resubmission_required" | "pass_on_resubmission" | "fail_on_resubmission" =
    assignment.resubmission_status === "approved"
      ? assignment.resubmission_outcome === "fail"
        ? "fail_on_resubmission"
        : "pass_on_resubmission"
      : assignment.first_status === "resubmission_required"
        ? "resubmission_required"
        : "pass";

  const sections = template?.sections ?? [];
  const responseByKey = new Map((responses ?? []).map((r) => [r.section_key, r]));
  const criteria = ASSIGNMENT_CRITERIA[assignment.assignment_type];
  const firstMarks = assignment.first_criteria_marks as Record<string, boolean>;
  const resubMarks = assignment.resubmission_criteria_marks as Record<string, boolean>;

  const buffer = await renderAssignmentCoverSheetBuffer({
    candidateName: trainee.full_name,
    centerName: center?.name ?? "",
    centerLogoUrl: center?.logo_url ?? null,
    courseName: course.name,
    courseDates: `${course.start_date} – ${course.end_date}`,
    assignmentTitle: ASSIGNMENT_INFO[assignment.assignment_type].title,
    firstSubmittedAt: assignment.first_submitted_at,
    resubmittedAt: assignment.resubmission_submitted_at,
    firstMarkerName: (assignment.marker_id && markerName.get(assignment.marker_id)) || "—",
    secondMarkerName: assignment.second_marker_id ? (markerName.get(assignment.second_marker_id) ?? null) : null,
    secondMarkerDate: assignment.second_marker_recorded_at,
    criteria: criteria.map((c) => ({ criterion: c, first: firstMarks?.[c.key], second: hasResubmission ? resubMarks?.[c.key] : undefined })),
    outcome,
    hasResubmission,
    sectionComments: sections.map((s: { key: string; title: string }) => ({
      title: s.title,
      firstComment: responseByKey.get(s.key)?.first_comments ?? null,
      resubmissionComment: responseByKey.get(s.key)?.resubmission_comments ?? null,
    })),
    sections: sections.map((s: { key: string; title: string }) => ({
      title: s.title,
      firstResponse: responseByKey.get(s.key)?.first_response ?? null,
      resubmissionResponse: responseByKey.get(s.key)?.resubmission_response ?? null,
    })),
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Cover-Sheet-${assignment.assignment_type.replace(/\s+/g, "-")}-${trainee.full_name.replace(/\s+/g, "-")}.pdf"`,
    },
  });
}
