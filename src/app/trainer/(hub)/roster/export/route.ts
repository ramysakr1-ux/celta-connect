import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchRosterRows } from "@/lib/roster";
import { AT_RISK_LABELS } from "@/lib/at-risk";

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
    "Assessed hrs",
    "TPs passed",
    "Assignments left",
    "Criteria",
    "Attendance",
    "Standing",
    "At risk",
  ];
  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        csvCell(r.name),
        csvCell(r.assessedHrs.toFixed(2)),
        csvCell(`${r.tpsPassed} / 8`),
        csvCell(r.assignmentsLeft),
        csvCell(`${r.criteriaPct}%`),
        csvCell(`${r.attendancePct}%`),
        csvCell(r.trajectory),
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
