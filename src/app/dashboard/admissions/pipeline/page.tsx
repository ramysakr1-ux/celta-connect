import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { requireAdmissionsHandler } from "@/lib/admissions-access";
import { createClient } from "@/lib/supabase/server";
import { computeApplicantPaymentState } from "@/lib/payments/applicant-payment-state";
import { computeFunnel, computeFunnelAlerts, type FunnelApplicant } from "@/lib/admissions-pipeline";
import { PipelineFunnel, type PipelinePerson } from "@/app/dashboard/admissions/pipeline/pipeline-funnel";
import { toLocalIso, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";
import { getCachedCenter } from "@/lib/supabase/cached-queries";

// Admissions Pipeline.dc.html: "A course fills in stages, and each stage
// leaks... this is the one screen that shows where the leak is while
// there is still time to do something about it." 1a is one course's
// funnel + who's in each stage + real alerts; 1b is every open course's
// numbers side by side.
export default async function AdmissionsPipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string }>;
}) {
  const staff = await requireAdmissionsHandler();
  const { course: selectedCourseId } = await searchParams;
  const supabase = await createClient();
  const timeZone = (await getCachedCenter(staff.center_id))?.time_zone ?? DEFAULT_TIMEZONE;
  const today = toLocalIso(new Date(), timeZone);

  const { data: courses } = await supabase
    .from("courses")
    .select("id, course_code, name, start_date, application_cap, cohort_size")
    .eq("center_id", staff.center_id)
    .eq("accepting_applications", true)
    .order("start_date");

  if (!courses || courses.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <div className="card p-6">
          <h1 className="font-serif text-xl text-ink">Admissions pipeline</h1>
          <p className="mt-2 text-sm text-muted">No course is currently accepting applications.</p>
        </div>
      </div>
    );
  }

  const courseIds = courses.map((c) => c.id);
  const [{ data: applicants }, { data: plans }] = await Promise.all([
    supabase
      .from("applicants")
      .select("id, full_name, stage, created_at, intake_course_id, offer_sent_at, offer_accept_by, deposit_amount, deposit_paid_at")
      .in("intake_course_id", courseIds),
    supabase.from("payment_plans").select("id, applicant_id, total_amount").in("course_id", courseIds),
  ]);

  const planIds = (plans ?? []).map((p) => p.id);
  const { data: paymentRows } = planIds.length
    ? await supabase.from("payments").select("payment_plan_id, amount, status, due_date").in("payment_plan_id", planIds)
    : { data: [] };

  const planByApplicantId = new Map((plans ?? []).map((p) => [p.applicant_id, p]));
  const paymentsByPlanId = new Map<string, { amount: number; status: string; due_date: string | null }[]>();
  for (const row of paymentRows ?? []) {
    const list = paymentsByPlanId.get(row.payment_plan_id) ?? [];
    list.push(row);
    paymentsByPlanId.set(row.payment_plan_id, list);
  }

  const funnelApplicantsByCourse = new Map<string, FunnelApplicant[]>();
  const nameById = new Map<string, string>();
  const overdueByCourse = new Map<string, string[]>();
  for (const a of applicants ?? []) {
    nameById.set(a.id, a.full_name);
    const plan = planByApplicantId.get(a.id);
    const instalments = plan ? (paymentsByPlanId.get(plan.id) ?? []) : [];
    const paymentState = computeApplicantPaymentState({
      depositPaidAt: a.deposit_paid_at,
      depositAmount: a.deposit_amount,
      instalments,
      planTotal: plan?.total_amount ?? null,
    }).state;

    const funnelApplicant: FunnelApplicant = {
      id: a.id,
      fullName: a.full_name,
      stage: a.stage,
      createdAt: a.created_at,
      offerSentAt: a.offer_sent_at,
      offerAcceptBy: a.offer_accept_by,
      paymentState,
      depositPaidAt: a.deposit_paid_at,
    };
    const list = funnelApplicantsByCourse.get(a.intake_course_id) ?? [];
    list.push(funnelApplicant);
    funnelApplicantsByCourse.set(a.intake_course_id, list);

    const overdue = instalments.some((i) => (i.status === "pending" || i.status === "missed") && i.due_date && i.due_date < today);
    if (overdue) {
      const names = overdueByCourse.get(a.intake_course_id) ?? [];
      names.push(a.full_name);
      overdueByCourse.set(a.intake_course_id, names);
    }
  }

  const activeCourseId = selectedCourseId && courseIds.includes(selectedCourseId) ? selectedCourseId : courses[0].id;
  const activeCourse = courses.find((c) => c.id === activeCourseId)!;
  const activeApplicants = funnelApplicantsByCourse.get(activeCourseId) ?? [];
  const activeFunnel = computeFunnel(activeApplicants);
  const activeAlerts = computeFunnelAlerts(activeApplicants, overdueByCourse.get(activeCourseId) ?? [], today);

  const places = activeCourse.application_cap ?? activeCourse.cohort_size ?? 0;
  const paidCount = activeFunnel.find((s) => s.key === "paid")?.count ?? 0;
  const atRiskCount =
    activeApplicants.filter((a) => a.stage === "offer_sent" || (a.stage === "accepted" && a.paymentState !== "paid_in_full")).length;
  const daysToStart = Math.ceil(
    (new Date(`${activeCourse.start_date}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000
  );

  const peopleByStage: Record<(typeof activeFunnel)[number]["key"], PipelinePerson[]> = { app: [], int: [], off: [], dep: [], paid: [] };
  for (const stage of activeFunnel) {
    peopleByStage[stage.key] = stage.applicantIds.map((id) => {
      const a = activeApplicants.find((x) => x.id === id)!;
      return { id, name: a.fullName, meta: `${STAGE_META_LABEL[a.stage]} · applied ${a.createdAt.slice(0, 10)}` };
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-serif text-xl text-ink">Admissions pipeline</h1>
            <p className="mt-1 text-sm text-muted">
              A course fills in stages, and each stage leaks. This is where the leak is, while there&apos;s still time to
              do something about it.
            </p>
          </div>
          <BackLink href="/dashboard/admissions" label={"Back to admissions"} />
        </div>
      </div>

      {/* Purely decorative teal/garnet alternation down this page's stack of
          plain cards -- same treatment as the Centre Management pilot
          (src/app/centre/page.tsx). None of these carry a status of their
          own. */}
      <div className="card card-garnet flex flex-col gap-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              {courses.map((c) => (
                <Link
                  key={c.id}
                  href={`/dashboard/admissions/pipeline?course=${c.id}`}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${c.id === activeCourseId ? "bg-primary text-primary-foreground" : "border border-border text-muted hover:border-primary admin-hover-fill"}`}
                >
                  {c.course_code || c.name}
                </Link>
              ))}
            </div>
            <p className="font-serif text-xl text-ink">
              {places > 0 ? `${paidCount} of ${places} places paid for` : `${paidCount} paid`}
              {daysToStart >= 0 ? ` · ${daysToStart} day${daysToStart === 1 ? "" : "s"} to go` : " · running"}
            </p>
          </div>
          <div className="flex items-center gap-6">
            <HeadStat label="Places" value={places || "—"} />
            <HeadStat label="Paid" value={paidCount} tone="text-primary" />
            <HeadStat label="At risk" value={atRiskCount} tone="text-destructive" />
          </div>
        </div>

        <PipelineFunnel stages={activeFunnel} peopleByStage={peopleByStage} alerts={activeAlerts} />
      </div>

      <div className="card overflow-hidden !p-0">
        <p className="border-b border-border bg-surface-muted/60 px-5 py-3 text-sm font-semibold text-ink">Across all open courses</p>
        <table className="table-plain w-full">
          <thead>
            <tr>
              <th className="text-sm text-muted">Course</th>
              <th className="text-right text-sm text-muted">Applied</th>
              <th className="text-right text-sm text-muted">Interv.</th>
              <th className="text-right text-sm text-muted">Offered</th>
              <th className="text-right text-sm text-muted">Deposit</th>
              <th className="text-right text-sm text-muted">Paid</th>
              <th className="text-sm text-muted">Where it stands</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((c) => {
              const funnel = computeFunnel(funnelApplicantsByCourse.get(c.id) ?? []);
              const cap = c.application_cap ?? c.cohort_size ?? 0;
              const paid = funnel.find((s) => s.key === "paid")?.count ?? 0;
              const waiting = (funnelApplicantsByCourse.get(c.id) ?? []).filter((a) => a.stage === "waiting_list").length;
              const shortfall = cap - paid;
              const verdict =
                cap === 0
                  ? "No place cap set"
                  : shortfall <= 0
                    ? "Full and paid"
                    : `${shortfall} short${waiting > 0 ? `, ${waiting} on the waiting list` : ""}`;
              return (
                <tr key={c.id} className="admin-hover">
                  <td>
                    <Link href={`/dashboard/admissions/pipeline?course=${c.id}`} className="font-medium text-ink hover:underline">
                      {c.course_code || c.name}
                    </Link>
                    <p className="text-xs text-muted">starts {c.start_date}</p>
                  </td>
                  {(["app", "int", "off", "dep", "paid"] as const).map((key) => (
                    <td key={key} className="text-right tabular-nums text-ink">
                      {funnel.find((s) => s.key === key)?.count ?? 0}
                    </td>
                  ))}
                  <td className="text-muted">{verdict}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const STAGE_META_LABEL: Record<string, string> = {
  submitted: "Applied",
  task_returned: "Task returned",
  interview_booked: "Interview booked",
  interview_completed: "Interviewed",
  offer_sent: "Offer sent",
  accepted: "Accepted",
  rejected_before_interview: "Rejected before interview",
  rejected_after_interview: "Rejected after interview",
  waiting_list: "Waiting list",
  not_this_time: "Not this time",
  withdrawn_application: "Withdrawn",
};

function HeadStat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className={`font-serif text-2xl leading-none ${tone ?? "text-ink"}`}>{value}</span>
      <span className="text-[10px] font-semibold tracking-[0.05em] text-muted uppercase">{label}</span>
    </div>
  );
}
