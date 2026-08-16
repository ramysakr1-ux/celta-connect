import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { ASSESSOR_COOKIE, getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { computeAssessorReadiness, buildCandidateCards } from "@/lib/assessor-pack";
import { CENTRE_DOCUMENTS, COHORT_DOCUMENTS } from "@/lib/assessor-pack-contents";
import { renderAssessorPackBuffer } from "@/lib/assessor-pack-pdf/document";

// The "Download whole pack" button, and the centre's end-of-course PDF.
//
// Authorised by the assessor cookie alone -- the same token that opened the
// screen, and nothing more. The assessor has no account by design
// ("read-only truly means read-only, enforced by giving the assessor no
// account at all"), so requiring a session here would lock out the only
// person the button exists for.
//
// Scope comes from the token, never from a query parameter: getAssessorCourseId
// resolves the cookie to exactly one course, so a pack for a different course
// cannot be requested by editing the URL.

export async function GET() {
  const cookieStore = await cookies();
  if (!cookieStore.get(ASSESSOR_COOKIE)?.value) {
    return NextResponse.json({ error: "This link is not valid." }, { status: 401 });
  }
  const courseId = await getAssessorCourseId();
  if (!courseId) {
    return NextResponse.json({ error: "This link has expired." }, { status: 401 });
  }

  const admin = createAdminClient();
  const [{ data: course }, readiness, candidates] = await Promise.all([
    admin.from("courses").select("name, start_date, end_date, center_id, assessor_visit_date").eq("id", courseId).maybeSingle(),
    computeAssessorReadiness(admin, courseId),
    buildCandidateCards(admin, courseId),
  ]);
  if (!course) return NextResponse.json({ error: "Course not found." }, { status: 404 });

  const [{ data: centre }, { data: uploadedDocs }] = await Promise.all([
    admin.from("centers").select("name, center_number").eq("id", course.center_id).maybeSingle(),
    admin.from("resources").select("title").eq("center_id", course.center_id).eq("category", "centre_documents"),
  ]);

  const uploadedTitles = new Set((uploadedDocs ?? []).map((d) => d.title.trim().toLowerCase()));

  const fmtLong = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const fmtShort = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  // Same two-day rule the screen uses -- the pack is due before the visit, not
  // on it.
  const sendBy = course.assessor_visit_date
    ? new Date(new Date(`${course.assessor_visit_date}T00:00:00`).getTime() - 2 * 86400000).toISOString().slice(0, 10)
    : null;

  const buffer = await renderAssessorPackBuffer({
    centreName: centre?.name ?? "Centre",
    centreNumber: centre?.center_number ?? "",
    courseName: course.name,
    courseDates:
      course.start_date && course.end_date ? `${fmtShort(course.start_date)} – ${fmtLong(course.end_date)}` : "",
    visitDate: course.assessor_visit_date ? fmtLong(course.assessor_visit_date) : null,
    sendByDate: sendBy ? fmtLong(sendBy) : null,
    portfoliosComplete: readiness.portfoliosCompleteCount,
    totalCandidates: readiness.totalCandidates,
    hoursAssessed: readiness.hoursAssessedTotal,
    // build-spec.md: "6 hours of assessed teaching per candidate".
    hoursRequired: readiness.totalCandidates * 6,
    gradesEntered: readiness.gradesEnteredCount,
    candidates,
    cohortDocuments: [...COHORT_DOCUMENTS],
    centreDocuments: CENTRE_DOCUMENTS.map((d) => ({
      ...d,
      present: uploadedTitles.has(d.name.toLowerCase()),
    })),
    generatedAt: new Date().toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" }),
  });

  const slug = course.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="assessor-pack-${slug}.pdf"`,
      // Readiness figures move as tutors work; a cached pack would show a
      // completeness that has since changed.
      "Cache-Control": "no-store",
    },
  });
}
