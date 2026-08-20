import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeCohortRows } from "@/lib/grades-report";

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Grades Report.dc.html 1a's "Export report" action. Same three-way viewer
// resolution as the page itself and the roster export -- trainer/admin/
// assessor can all see the Grades Report, so all three can export it.
// courseId is always resolved from the authenticated session, never from a
// query param -- a client-supplied course id here would let one course's
// viewer export another's cohort.
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

  const { courseName, rows } = await computeCohortRows(supabase, courseId);

  const header = [
    "Candidate",
    "TP1",
    "TP2",
    "TP3",
    "TP4",
    "TP5",
    "TP6",
    "TP7",
    "TP8",
    "Provisional",
    "Recommended grade",
    "Stage 3",
    "TPs remaining",
    "Outstanding",
  ];
  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        csvCell(r.name),
        ...r.tpGlyphs.map((slot) => csvCell(slot.grade ?? "")),
        csvCell(r.provisionalLabel),
        csvCell(r.recommendedGrade ?? "Not set"),
        csvCell(r.stage3Status === "not_required" ? "Not required" : r.stage3Status === "given" ? "Given" : "Not yet given"),
        csvCell(r.tpsRemaining),
        csvCell(r.outstanding || "None"),
      ].join(",")
    ),
  ];

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${courseName.replace(/[^a-z0-9]+/gi, "-")}-grades-report.csv"`,
    },
  });
}
