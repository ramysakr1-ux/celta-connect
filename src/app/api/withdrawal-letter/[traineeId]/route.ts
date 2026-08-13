import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { renderWithdrawalLetterBuffer } from "@/lib/withdrawal-letter-pdf/document";

// Trainer/admin only -- unlike the final report, a withdrawn candidate's
// own portal access isn't a designed flow anywhere else in this app, so
// there's no trainee-self branch to support here.
export async function GET(_request: Request, { params }: { params: Promise<{ traineeId: string }> }) {
  const { traineeId } = await params;
  const session = await getCurrentProfile();
  const viewer = session?.profile ?? null;
  if (!viewer || (viewer.role !== "trainer" && viewer.role !== "admin")) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: trainee } = await supabase
    .from("profiles")
    .select("full_name, course_id, center_id, course_status, course_status_set_at, course_status_note, withdrawal_reportable, course_status_set_by")
    .eq("id", traineeId)
    .maybeSingle();

  if (!trainee || !trainee.course_id || trainee.course_id !== viewer.course_id) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (trainee.course_status !== "withdrawn") {
    return NextResponse.json({ error: "This candidate has not been withdrawn." }, { status: 409 });
  }

  const [{ data: course }, { data: center }, { data: issuer }] = await Promise.all([
    supabase.from("courses").select("name, start_date, end_date").eq("id", trainee.course_id).maybeSingle(),
    supabase.from("centers").select("name, logo_url").eq("id", trainee.center_id).maybeSingle(),
    trainee.course_status_set_by
      ? supabase.from("profiles").select("full_name, role").eq("id", trainee.course_status_set_by).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (!course) {
    return NextResponse.json({ error: "Course not found." }, { status: 404 });
  }

  const buffer = await renderWithdrawalLetterBuffer({
    traineeName: trainee.full_name,
    courseName: course.name,
    centerName: center?.name ?? "",
    centerLogoUrl: center?.logo_url ?? null,
    courseStartDate: course.start_date,
    courseEndDate: course.end_date,
    withdrawnAt: trainee.course_status_set_at ?? new Date().toISOString(),
    reportable: Boolean(trainee.withdrawal_reportable),
    note: trainee.course_status_note,
    issuedBy: issuer ? { name: issuer.full_name, role: issuer.role === "admin" ? "Centre Administrator" : "CELTA Course Tutor" } : null,
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Withdrawal-Letter-${trainee.full_name.replace(/\s+/g, "-")}.pdf"`,
    },
  });
}
