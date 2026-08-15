import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// "A missed instalment is not an automatic consequence (no auto-suspension,
// no auto-email) -- it becomes a payments task that sits until a human acts
// on it. Automation stops at 'tell someone', never escalates to 'do
// something about it' on its own." So this only ever flips status and
// writes a task row -- no email, no stage change on the applicant, no
// escalation of any kind.
export async function runMissedInstalmentsCron(): Promise<{ missed: number }> {
  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: overdue } = await admin
    .from("payments")
    .select("id, center_id, amount, currency, instalment_index, payment_plan_id")
    .eq("status", "pending")
    .not("due_date", "is", null)
    .lt("due_date", today);

  if (!overdue || overdue.length === 0) return { missed: 0 };

  const planIds = Array.from(new Set(overdue.map((p) => p.payment_plan_id)));
  const { data: plans } = await admin.from("payment_plans").select("id, applicant_id").in("id", planIds);
  const applicantIdByPlanId = new Map((plans ?? []).map((p) => [p.id, p.applicant_id]));
  const applicantIds = Array.from(new Set((plans ?? []).map((p) => p.applicant_id)));
  const { data: applicants } = await admin.from("applicants").select("id, full_name").in("id", applicantIds);
  const nameByApplicantId = new Map((applicants ?? []).map((a) => [a.id, a.full_name]));

  let missed = 0;
  for (const payment of overdue) {
    const { error } = await admin.from("payments").update({ status: "missed" }).eq("id", payment.id).eq("status", "pending");
    if (error) continue;

    const applicantId = applicantIdByPlanId.get(payment.payment_plan_id);
    const applicantName = applicantId ? (nameByApplicantId.get(applicantId) ?? "An applicant") : "An applicant";
    await admin.from("payment_notifications").insert({
      center_id: payment.center_id,
      payment_id: payment.id,
      type: "instalment_missed",
      message: `${applicantName} -- instalment ${payment.instalment_index} (${payment.amount} ${payment.currency}) is overdue.`,
    });
    missed++;
  }

  return { missed };
}
