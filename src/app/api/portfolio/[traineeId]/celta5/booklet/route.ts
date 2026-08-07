import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ASSIGNMENT_INFO } from "@/lib/assignment-info";
import { ASSIGNMENT_STATUS_LABEL } from "@/lib/assignment-info";
import { computeAssessedTpStats } from "@/lib/course-progress";
import { computeSignatureLedger, isBookletExportReady } from "@/lib/celta5-signatures";
import { renderCelta5BookletBuffer } from "@/lib/celta5-booklet-pdf/document";
import type { CriteriaRating } from "@/lib/supabase/types";

// Same three-way viewer resolution as every other /portfolio/[traineeId]/*
// export route this session. Staff/assessor only -- a candidate downloads
// their own copy through the (not yet built) close-out flow, same boundary
// as the final report's "trainee gets a separate, later release" pattern.
export async function GET(_request: Request, { params }: { params: Promise<{ traineeId: string }> }) {
  const { traineeId } = await params;
  const session = await getCurrentProfile();
  const viewer = session?.profile ?? null;
  const isStaff = viewer?.role === "trainer" || viewer?.role === "admin";
  const assessorCourseId = !viewer ? await getAssessorCourseId() : null;

  if (!viewer && !assessorCourseId) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  if (viewer && !isStaff) {
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

  const [{ data: course }, { data: center }, { data: matrix }, { data: record }, { data: observations }, { data: assignments }, { data: tutors }, { data: planAssignments }] =
    await Promise.all([
      supabase.from("courses").select("name, start_date, end_date, total_hours").eq("id", trainee.course_id).maybeSingle(),
      supabase.from("centers").select("name, logo_url").eq("id", trainee.center_id).maybeSingle(),
      admin.from("celta5_matrix").select("*").eq("trainee_id", traineeId),
      admin.from("celta5_records").select("*").eq("trainee_id", traineeId).maybeSingle(),
      admin.from("observations").select("length_minutes, filmed").eq("trainee_id", traineeId),
      admin.from("assignments").select("*").eq("trainee_id", traineeId),
      admin.from("profiles").select("full_name").eq("course_id", trainee.course_id).eq("role", "trainer").order("full_name"),
      admin.from("plan_assignments").select("tp_point_id, taught_at").eq("trainee_id", traineeId),
    ]);

  if (!record) {
    return NextResponse.json({ error: "No CELTA 5 record found." }, { status: 404 });
  }
  if (!course) {
    return NextResponse.json({ error: "Course not found." }, { status: 404 });
  }

  const ledger = computeSignatureLedger(record, assignments ?? []);
  if (!isBookletExportReady(ledger)) {
    return NextResponse.json({ error: "This booklet can't be exported yet -- some signatures are still outstanding." }, { status: 409 });
  }

  const taughtAssignments = (planAssignments ?? []).filter((p) => p.taught_at);
  const tpPointIds = [...new Set(taughtAssignments.map((p) => p.tp_point_id).filter((id): id is string => !!id))];
  const { data: tpPoints } = tpPointIds.length > 0 ? await admin.from("tp_points").select("id, tp_coursebook_id").in("id", tpPointIds) : { data: [] };
  const coursebookIds = [...new Set((tpPoints ?? []).map((p) => p.tp_coursebook_id))];
  const { data: coursebooks } = coursebookIds.length > 0 ? await admin.from("tp_coursebooks").select("id, level").in("id", coursebookIds) : { data: [] };
  const assessedTp = computeAssessedTpStats({
    taughtAssignments,
    tpPointCoursebookById: new Map((tpPoints ?? []).map((p) => [p.id, p.tp_coursebook_id])),
    coursebookLevelById: new Map((coursebooks ?? []).map((c) => [c.id, c.level])),
  });

  const liveMinutes = (observations ?? []).filter((o) => !o.filmed).reduce((sum, o) => sum + (o.length_minutes ?? 0), 0);
  const filmedMinutes = (observations ?? []).filter((o) => o.filmed).reduce((sum, o) => sum + (o.length_minutes ?? 0), 0);

  const matrixByCode: Record<
    string,
    { candidateStatus: CriteriaRating | null; tutorStatusStage2: CriteriaRating | null; tutorStatusStage3: CriteriaRating | null }
  > = {};
  for (const m of matrix ?? []) {
    matrixByCode[m.criteria_code] = {
      candidateStatus: m.candidate_status,
      tutorStatusStage2: m.tutor_status_stage2,
      tutorStatusStage3: m.tutor_status_stage3,
    };
  }

  const buffer = await renderCelta5BookletBuffer({
    traineeName: trainee.full_name,
    courseName: course.name,
    centerName: center?.name ?? "",
    centerLogoUrl: center?.logo_url ?? null,
    courseStartDate: course.start_date,
    courseEndDate: course.end_date,
    tutorNames: (tutors ?? []).map((t) => t.full_name),
    matrixByCode,
    record,
    attendance: { hoursAttended: record.hours_attended ?? 0, totalHours: course.total_hours },
    observations: { liveHours: liveMinutes / 60, filmedHours: filmedMinutes / 60 },
    assessedTp,
    assignments: (assignments ?? []).map((a) => {
      const isResubmissionRound = a.first_status === "resubmission_required" || a.resubmission_status !== "not_submitted";
      const status = isResubmissionRound ? a.resubmission_status : a.first_status;
      return {
        title: ASSIGNMENT_INFO[a.assignment_type]?.title ?? a.assignment_type,
        status: ASSIGNMENT_STATUS_LABEL[status],
        grade: a.final_grade,
      };
    }),
    ledger,
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="CELTA5-${trainee.full_name.replace(/\s+/g, "-")}.pdf"`,
    },
  });
}
