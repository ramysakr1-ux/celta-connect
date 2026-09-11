import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { renderFormalLetterBuffer } from "@/lib/formal-letter-pdf/document";
import { buildWithdrawalLetterInput } from "@/lib/letters/withdrawal";

// Trainer/admin, or a Cambridge assessor holding this course's pack token.
// Handbook §14.2 has the assessor check the withdrawn candidate's letter, so
// it must be reachable from the read-only pack -- validated the same way every
// other assessor-reachable portfolio read is: the token resolves to a course
// (getAssessorCourseId) and the candidate must be on that course. The
// candidate's own portal access still isn't a flow here.
export async function GET(_request: Request, { params }: { params: Promise<{ traineeId: string }> }) {
  const { traineeId } = await params;
  const assessorCourseId = await getAssessorCourseId();
  const session = await getCurrentProfile();
  const viewer = session?.profile ?? null;
  const isStaff = Boolean(viewer && (viewer.role === "trainer" || viewer.role === "admin"));
  if (!isStaff && !assessorCourseId) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  // An assessor has no RLS session -- read through the admin client, exactly
  // as the assessor-facing portfolio pages do, then gate on the course.
  const supabase = assessorCourseId && !isStaff ? createAdminClient() : await createClient();
  const { data: trainee } = await supabase
    .from("profiles")
    .select("full_name, course_id, center_id, course_status, course_status_set_at, course_status_note, withdrawal_reportable, course_status_set_by")
    .eq("id", traineeId)
    .maybeSingle();

  const inScope = assessorCourseId && !isStaff ? trainee?.course_id === assessorCourseId : trainee?.course_id === viewer?.course_id;
  if (!trainee || !trainee.course_id || !inScope) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (trainee.course_status !== "withdrawn") {
    return NextResponse.json({ error: "This candidate has not been withdrawn." }, { status: 409 });
  }

  const [{ data: course }, { data: center }, { data: issuer }] = await Promise.all([
    supabase.from("courses").select("name, start_date, end_date, entry_form_sent_at").eq("id", trainee.course_id).maybeSingle(),
    supabase.from("centers").select("name, center_number").eq("id", trainee.center_id).maybeSingle(),
    trainee.course_status_set_by
      ? supabase.from("profiles").select("full_name, role").eq("id", trainee.course_status_set_by).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (!course) {
    return NextResponse.json({ error: "Course not found." }, { status: 404 });
  }

  const letterInput = await buildWithdrawalLetterInput(supabase, {
    traineeId,
    traineeName: trainee.full_name,
    courseId: trainee.course_id,
    courseName: course.name,
    courseStartDate: course.start_date,
    courseEndDate: course.end_date,
    centerName: center?.name ?? "Your centre",
    centerNumber: center?.center_number ?? null,
    withdrawnAt: trainee.course_status_set_at ?? new Date().toISOString(),
    reportable: Boolean(trainee.withdrawal_reportable),
    note: trainee.course_status_note,
    entryFormSentAt: course.entry_form_sent_at,
    issuedByName: issuer?.full_name ?? center?.name ?? "The centre",
  });

  const buffer = await renderFormalLetterBuffer(letterInput);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Withdrawal-Letter-${trainee.full_name.replace(/\s+/g, "-")}.pdf"`,
    },
  });
}
