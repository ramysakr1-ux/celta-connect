import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { createZip, safeZipName } from "@/lib/zip";
import { buildCandidatePortfolio, safeName } from "@/lib/course-close-out/candidate-portfolio";

// The candidate's own copy of their portfolio.
//
// Handbook 12.1.2: "Before final submission, candidates should ensure they
// have their own saved copy of the portfolio." 12.1.3: portfolios "should
// remain accessible to candidates for six months after the issue of
// results". Connect's own CELTA 5 booklet repeats Cambridge's line to them:
// "You may keep copies of any of the content you wish to retain."
//
// Until now nothing delivered that. A candidate could download their CELTA
// 5, a replica of it, an assignment cover sheet and a calendar file; their
// lesson plans, assignments, tutor feedback and teaching materials had no
// export at all -- and close-out deletes the working copy seven days after
// the centre signs for it. Ramy, 15 Sep 2026: the six months live at the
// centre, in Drive, and "Connect does not keep the candidate's information
// after that because it is confidential". Which is exactly why the
// candidate has to be able to take theirs before it goes.
//
// Deliberately the SAME bundle the centre's archive gets --
// buildCandidatePortfolio is shared with exportCourseToDrive, so what a
// candidate keeps and what their centre files cannot drift apart.
export async function GET(_request: Request, { params }: { params: Promise<{ traineeId: string }> }) {
  const { traineeId } = await params;
  const session = await getCurrentProfile();
  const viewer = session?.profile ?? null;
  if (!viewer) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const admin = createAdminClient();
  const { data: trainee } = await admin
    .from("profiles")
    .select("id, full_name, course_id, center_id, role, course_status")
    .eq("id", traineeId)
    .maybeSingle();
  if (!trainee || trainee.role !== "trainee" || !trainee.course_id) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  // Themselves, or staff on their course. No assessor path: the assessor
  // reads portfolios in place, through the pack, and has no reason to hold
  // a copy (12.1 -- "Cambridge English does not retain copies").
  const isSelf = viewer.role === "trainee" && viewer.id === traineeId;
  const isStaff =
    (viewer.role === "trainer" && viewer.course_id === trainee.course_id) ||
    (viewer.role === "admin" && viewer.center_id === trainee.center_id) ||
    viewer.role === "platform_owner";
  if (!isSelf && !isStaff) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

  const [{ data: course }, { data: center }, { data: record }, { data: assignments }, { data: tutors }] = await Promise.all([
    admin
      .from("courses")
      .select("id, name, start_date, end_date, total_hours, delivery_mode, center_id")
      .eq("id", trainee.course_id)
      .maybeSingle(),
    admin.from("centers").select("name, logo_url, time_zone").eq("id", trainee.center_id).maybeSingle(),
    admin.from("celta5_records").select("*").eq("trainee_id", traineeId).maybeSingle(),
    admin.from("assignments").select("*").eq("trainee_id", traineeId),
    admin.from("course_tutors").select("profile_id").eq("course_id", trainee.course_id).is("left_at", null),
  ]);
  if (!course) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const tutorIds = (tutors ?? []).map((t) => t.profile_id);
  const { data: tutorProfiles } = tutorIds.length
    ? await admin.from("profiles").select("full_name").in("id", tutorIds)
    : { data: [] as { full_name: string }[] };

  const files = await buildCandidatePortfolio(admin, {
    courseId: course.id,
    course,
    center: center ?? null,
    centerId: course.center_id,
    tutorNames: (tutorProfiles ?? []).map((t) => t.full_name),
    trainee: { id: trainee.id, full_name: trainee.full_name, courseStatus: trainee.course_status },
    record: record ?? null,
    assignments: assignments ?? [],
  });

  if (files.length === 0) {
    return NextResponse.json(
      { error: "There is nothing in your portfolio to download yet -- it fills up as your work is submitted and marked." },
      { status: 404 }
    );
  }

  const folder = `${safeName(trainee.full_name)} - ${safeName(course.name)}`;
  const zip = createZip(
    files.map((f) => ({ name: `${folder}/${safeZipName(f.name, "file")}`, data: new Uint8Array(f.bytes) })),
    new Date()
  );

  return new NextResponse(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${safeZipName(`${folder}.zip`, "portfolio.zip")}"`,
      // A portfolio changes as work is marked; a cached copy would quietly
      // be last week's.
      "Cache-Control": "no-store",
    },
  });
}
