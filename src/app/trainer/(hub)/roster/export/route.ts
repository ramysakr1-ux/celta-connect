import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchRosterRows } from "@/lib/roster";
import { AT_RISK_LABELS } from "@/lib/at-risk";
import { COURSE_STATUS_LABEL } from "@/lib/course-status";

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Same three-way viewer resolution as the roster page itself -- trainer/
// admin/assessor can all see the roster, so all three can export it.
export async function GET() {
  const session = await getCurrentProfile();
  const trainer = session?.profile?.role === "trainer" || session?.profile?.role === "admin" ? session.profile : null;
  const assessorCourseId = !trainer ? await getAssessorCourseId() : null;
  if (!trainer && !assessorCourseId) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const supabase = assessorCourseId ? createAdminClient() : await createClient();
  const courseId = trainer?.course_id ?? assessorCourseId;
  if (!courseId) {
    return NextResponse.json({ error: "No course assigned." }, { status: 404 });
  }

  const rows = await fetchRosterRows(supabase, courseId);

  const header = [
    "Candidate",
    "Status",
    "Assessed hrs",
    "TPs passed",
    "Assignments passed",
    "Assignments total",
    "Resubmission used",
    "Criteria",
    "Attendance",
    "TP stages on track",
    "TP stages taught",
    "Supervised review",
    "Observation hrs",
    "Stage 1 report",
    "Stage 2 booking",
    "Stage 3",
    "CELTA 5 sign-off",
    "FOL logged",
    "Standing",
    "Provisional grade",
    "At risk",
  ];
  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        csvCell(r.name),
        csvCell(COURSE_STATUS_LABEL[r.courseStatus]),
        csvCell(r.assessedHrs.toFixed(2)),
        csvCell(`${r.tpsPassed} / 8`),
        csvCell(r.assignmentsPassed),
        csvCell(r.assignmentsTotal),
        csvCell(r.assignmentsResubmitted ? "Yes" : "No"),
        csvCell(`${r.criteriaPct}%`),
        csvCell(`${r.attendancePct}%`),
        csvCell(r.tpStagesTaught - r.tpStagesBehind),
        csvCell(r.tpStagesTaught),
        csvCell(r.supervisedTotal > 0 ? `${r.supervisedDone} / ${r.supervisedTotal}` : "--"),
        csvCell(r.observationHoursCounted.toFixed(1)),
        csvCell(r.stage1Filed ? "Filed" : "Not filed"),
        csvCell(r.stage2BookedPosition ? `Position ${r.stage2BookedPosition}` : "Not booked"),
        csvCell(r.stage3Required ? (r.stage3Done ? "Done" : "Pending") : "N/A"),
        csvCell(
          r.celta5SignoffStatus === "both_signed" ? "Both signed" : r.celta5SignoffStatus === "candidate_signed" ? "Candidate signed" : "Not started"
        ),
        csvCell(r.folEntriesLogged),
        csvCell(r.trajectory),
        csvCell(r.provisionalLabel ?? "Not set"),
        csvCell(r.atRiskReasons.map((reason) => AT_RISK_LABELS[reason]).join("; ")),
      ].join(",")
    ),
  ];

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="roster.csv"`,
    },
  });
}
