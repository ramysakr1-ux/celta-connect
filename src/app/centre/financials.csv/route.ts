import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { can } from "@/lib/auth/centre-permissions";
import { createAdminClient } from "@/lib/supabase/admin";

// "Export financials" -- the outlined button top-right of Centre Admin's
// Overview (Centre Admin.dc.html).
//
// A row per instalment rather than a copy of the four summary figures: the
// person exporting is taking this to a spreadsheet or an accountant, and a
// total they cannot break down is no use to either. The summary is on the
// screen they clicked from.
//
// Reads through the admin client, scoped explicitly to the centres this
// person holds a role at -- centres RLS is `id = current_center_id()`, so a
// session-scoped read cannot see a second branch even when the viewer
// legitimately holds both.

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  // Quote anything that could break a column, and double any inner quote.
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: Request) {
  const session = await getCurrentProfile();
  if (!session?.profile) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const ctx = await getCentreRoleContext(session.profile);
  if (!can(ctx.roles, "payments.view", ctx.overrides)) {
    return NextResponse.json({ error: "You can't export financials." }, { status: 403 });
  }

  const branch = new URL(request.url).searchParams.get("branch");
  // Honour the branch filter if one is applied, but never let it widen scope
  // past the centres this person actually holds.
  const scope = branch && ctx.availableCenterIds.includes(branch) ? [branch] : ctx.availableCenterIds;
  if (!scope.length) {
    return NextResponse.json({ error: "No centre." }, { status: 403 });
  }

  const admin = createAdminClient();

  const [{ data: centres }, { data: courses }] = await Promise.all([
    admin.from("centers").select("id, name").in("id", scope),
    admin.from("courses").select("id, name, center_id, start_date, end_date").in("center_id", scope),
  ]);

  const centreName = new Map((centres ?? []).map((c) => [c.id, c.name]));
  const courseById = new Map((courses ?? []).map((c) => [c.id, c]));
  const courseIds = (courses ?? []).map((c) => c.id);

  const rows: string[][] = [
    ["Centre", "Course", "Course dates", "Candidate", "Type", "Due", "Paid", "Amount", "Currency", "Status"],
  ];

  if (courseIds.length) {
    const { data: plans } = await admin
      .from("payment_plans")
      .select("id, course_id, applicant_id")
      .in("course_id", courseIds);

    const planIds = (plans ?? []).map((p) => p.id);
    const planById = new Map((plans ?? []).map((p) => [p.id, p]));

    const [{ data: instalments }, { data: people }] = await Promise.all([
      planIds.length
        ? admin
            .from("payments")
            .select("payment_plan_id, amount, currency, status, due_date, paid_at")
            .in("payment_plan_id", planIds)
        : Promise.resolve({ data: [] as { payment_plan_id: string; amount: number; currency: string; status: string; due_date: string | null; paid_at: string | null }[] }),
      admin
        .from("applicants")
        .select("id, full_name")
        .in("id", [...new Set((plans ?? []).map((p) => p.applicant_id).filter(Boolean))] as string[]),
    ]);

    // A plan is keyed to the APPLICANT, not a profile -- it exists before the
    // candidate has an account at all.
    const personName = new Map((people ?? []).map((p) => [p.id, p.full_name]));

    for (const inst of instalments ?? []) {
      const plan = planById.get(inst.payment_plan_id);
      const course = plan ? courseById.get(plan.course_id) : undefined;
      rows.push([
        course ? (centreName.get(course.center_id) ?? "") : "",
        course?.name ?? "",
        course ? `${course.start_date ?? ""} to ${course.end_date ?? ""}` : "",
        plan?.applicant_id ? (personName.get(plan.applicant_id) ?? "") : "",
        "Instalment",
        inst.due_date ?? "",
        inst.paid_at ? String(inst.paid_at).slice(0, 10) : "",
        String(inst.amount ?? ""),
        inst.currency ?? "",
        inst.status ?? "",
      ]);
    }
  }

  // Deposits sit on the applicant, not on a payment plan -- a deposit is paid
  // before anyone has an account -- so they are a second pass, not a join.
  const { data: applicants } = await admin
    .from("applicants")
    .select("full_name, center_id, intake_course_id, deposit_amount, deposit_currency, deposit_paid_at")
    .in("center_id", scope)
    .not("deposit_paid_at", "is", null);

  for (const a of applicants ?? []) {
    const course = a.intake_course_id ? courseById.get(a.intake_course_id) : undefined;
    rows.push([
      centreName.get(a.center_id) ?? "",
      course?.name ?? "",
      course ? `${course.start_date ?? ""} to ${course.end_date ?? ""}` : "",
      a.full_name ?? "",
      "Deposit",
      "",
      String(a.deposit_paid_at).slice(0, 10),
      String(a.deposit_amount ?? ""),
      a.deposit_currency ?? "",
      "paid",
    ]);
  }

  const csv = rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="connect-financials-${stamp}.csv"`,
      // Money figures change as payments land; a cached copy would be wrong
      // in a way nobody would notice.
      "Cache-Control": "no-store",
    },
  });
}
