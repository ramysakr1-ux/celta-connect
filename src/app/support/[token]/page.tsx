import { createAdminClient } from "@/lib/supabase/admin";
import { resolveActiveGrantByToken, logGrantActivity } from "@/lib/platform-support";
import { computeCriteriaPct } from "@/lib/celta-criteria";
import { CountdownBadge } from "@/app/support/[token]/countdown-badge";

// specs/for-claude-code-platform-support-access.md, "1b is support@'s
// scoped view once granted." Design not in the repo -- built deliberately
// minimal rather than guessed at in detail: exactly the categories the
// spec names ("grades, marking, that course's timetable" / "fees,
// deposits, course setup"), not a full mirror of the trainer/admin
// screens those categories live on elsewhere. No account, no login --
// the token itself, checked live against the grant's real expiry, is the
// only thing standing between this page and its data.
export default async function SupportScopedViewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();
  const grant = await resolveActiveGrantByToken(admin, token);

  if (!grant) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="sheet-entry max-w-sm p-8 text-center">
          <h1 className="font-serif text-xl text-ink">This link is not valid</h1>
          <p className="mt-2 text-sm text-muted">The grant has expired, been revoked, or never existed.</p>
        </div>
      </div>
    );
  }

  await logGrantActivity(admin, grant.id, grant.scope === "course" ? "/support/[token] (course view)" : "/support/[token] (billing view)");

  const { data: center } = await admin.from("centers").select("name").eq("id", grant.center_id).maybeSingle();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 p-6">
      <div className="sheet flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">
            {grant.scope === "course" ? "Course access" : "Billing access"} · {center?.name ?? "Centre"}
          </p>
          <p className="mt-1 text-sm text-ink">{grant.reason}</p>
          {grant.chat_included ? <p className="mt-1 text-xs text-gold">Course chat is included in this grant.</p> : null}
        </div>
        <CountdownBadge expiresAt={grant.expires_at} />
      </div>
      <p className="text-[11px] text-muted">
        Every page opened during this window is logged to the centre&apos;s own access log.
      </p>

      {grant.scope === "course" && grant.course_id ? (
        <CourseScopedView admin={admin} courseId={grant.course_id} />
      ) : (
        <BillingScopedView admin={admin} centerId={grant.center_id} />
      )}
    </div>
  );
}

async function CourseScopedView({ admin, courseId }: { admin: ReturnType<typeof createAdminClient>; courseId: string }) {
  const [{ data: course }, { data: trainees }, { data: timetable }] = await Promise.all([
    admin.from("courses").select("name, start_date, end_date, delivery_mode").eq("id", courseId).maybeSingle(),
    admin.from("profiles").select("id, full_name, course_status").eq("course_id", courseId).eq("role", "trainee"),
    admin
      .from("course_timetable_events")
      .select("event_date, event_time, type, title")
      .eq("course_id", courseId)
      .order("event_date")
      .limit(60),
  ]);

  const traineeIds = (trainees ?? []).map((t) => t.id);
  const [{ data: matrix }, { data: feedbackRows }] = await Promise.all([
    traineeIds.length ? admin.from("celta5_matrix").select("trainee_id, criteria_code, tutor_status_stage2").in("trainee_id", traineeIds) : Promise.resolve({ data: [] }),
    traineeIds.length ? admin.from("tp_feedback").select("trainee_id, submitted_at").in("trainee_id", traineeIds).not("submitted_at", "is", null) : Promise.resolve({ data: [] }),
  ]);
  const matrixByTrainee = new Map<string, Map<string, string | null>>();
  for (const row of matrix ?? []) {
    const m = matrixByTrainee.get(row.trainee_id) ?? new Map();
    m.set(row.criteria_code, row.tutor_status_stage2);
    matrixByTrainee.set(row.trainee_id, m);
  }
  const feedbackCountByTrainee = new Map<string, number>();
  for (const row of feedbackRows ?? []) {
    feedbackCountByTrainee.set(row.trainee_id, (feedbackCountByTrainee.get(row.trainee_id) ?? 0) + 1);
  }

  return (
    <>
      <div className="sheet">
        <h2 className="font-serif text-lg text-ink">{course?.name ?? "Course"}</h2>
        <p className="mt-1 text-sm text-muted">
          {course?.start_date} → {course?.end_date} · {course?.delivery_mode ?? "delivery mode not set"}
        </p>
      </div>

      <div>
        <h3 className="font-serif text-base text-ink">Grades and marking</h3>
        <div className="sheet mt-2 overflow-hidden !p-0">
          {(trainees ?? []).length === 0 ? (
            <p className="p-6 text-sm text-muted">No candidates on this course.</p>
          ) : (
            <table className="table-plain w-full">
              <thead>
                <tr>
                  <th className="text-sm text-muted">Candidate</th>
                  <th className="text-right text-sm text-muted">Criteria</th>
                  <th className="text-right text-sm text-muted">TP feedback filed</th>
                </tr>
              </thead>
              <tbody>
                {(trainees ?? []).map((t) => (
                  <tr key={t.id}>
                    <td className="text-sm text-ink">
                      {t.full_name}
                      {t.course_status && t.course_status !== "active" ? <span className="ml-2 text-xs text-muted">({t.course_status})</span> : null}
                    </td>
                    <td className="text-right text-sm tabular-nums text-ink">{computeCriteriaPct(matrixByTrainee.get(t.id) ?? new Map())}%</td>
                    <td className="text-right text-sm tabular-nums text-ink">{feedbackCountByTrainee.get(t.id) ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div>
        <h3 className="font-serif text-base text-ink">Timetable</h3>
        <div className="sheet mt-2 overflow-hidden !p-0">
          {(timetable ?? []).length === 0 ? (
            <p className="p-6 text-sm text-muted">No timetable events yet.</p>
          ) : (
            <ul>
              {(timetable ?? []).map((e, i) => (
                <li key={i} className="list-row flex items-center justify-between gap-4">
                  <span className="text-sm text-ink">{e.title ?? e.type}</span>
                  <span className="text-xs text-muted">
                    {e.event_date} {e.event_time ?? ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

async function BillingScopedView({ admin, centerId }: { admin: ReturnType<typeof createAdminClient>; centerId: string }) {
  const { data: payments } = await admin
    .from("payments")
    .select("id, amount, currency, status, due_date, paid_at, payment_plan_id")
    .eq("center_id", centerId)
    .order("due_date", { ascending: false, nullsFirst: false })
    .limit(100);

  const planIds = [...new Set((payments ?? []).map((p) => p.payment_plan_id))];
  const { data: plans } = planIds.length ? await admin.from("payment_plans").select("id, applicant_id, course_id").in("id", planIds) : { data: [] };
  const applicantIdByPlan = new Map((plans ?? []).map((p) => [p.id, p.applicant_id]));
  const applicantIds = [...new Set((plans ?? []).map((p) => p.applicant_id))];
  const { data: applicants } = applicantIds.length ? await admin.from("applicants").select("id, full_name").in("id", applicantIds) : { data: [] };
  const nameByApplicant = new Map((applicants ?? []).map((a) => [a.id, a.full_name]));

  const STATUS_PILL: Record<string, string> = { paid: "pill-success", pending: "pill-warning", missed: "pill-danger", refunded: "pill-neutral" };

  return (
    <div>
      <h3 className="font-serif text-base text-ink">Payments</h3>
      <div className="sheet mt-2 overflow-hidden !p-0">
        {(payments ?? []).length === 0 ? (
          <p className="p-6 text-sm text-muted">No payments recorded for this centre.</p>
        ) : (
          <table className="table-plain w-full">
            <thead>
              <tr>
                <th className="text-sm text-muted">Candidate</th>
                <th className="text-right text-sm text-muted">Amount</th>
                <th className="text-right text-sm text-muted">Due</th>
                <th className="text-right text-sm text-muted">Status</th>
              </tr>
            </thead>
            <tbody>
              {(payments ?? []).map((p) => {
                const applicantId = applicantIdByPlan.get(p.payment_plan_id);
                return (
                  <tr key={p.id}>
                    <td className="text-sm text-ink">{applicantId ? (nameByApplicant.get(applicantId) ?? "Unknown") : "Unknown"}</td>
                    <td className="text-right text-sm tabular-nums text-ink">
                      {p.amount} {p.currency}
                    </td>
                    <td className="text-right text-sm text-muted">{p.due_date ?? "--"}</td>
                    <td className="text-right">
                      <span className={`pill ${STATUS_PILL[p.status] ?? "pill-neutral"}`}>{p.status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
