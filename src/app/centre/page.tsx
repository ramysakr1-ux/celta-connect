import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { can, canView } from "@/lib/auth/centre-permissions";

// Centre Admin's Overview tab. Layout per the 2026-08-16 visual spec: metric
// cards side by side (each a label, a large serif figure, and a line saying
// what it's made of), then All courses carrying who administers each one and
// where its money stands, then the pipeline and anything needing attention.
export default async function CentreOverviewPage() {
  const session = await getCurrentProfile();
  if (!session?.profile) redirect("/login");
  const profile = session.profile;

  const ctx = await getCentreRoleContext(profile);
  if (ctx.roles.length === 0) redirect("/dashboard");

  const centerId = ctx.activeCenterId ?? profile.center_id;
  const supabase = await createClient();

  const [{ data: center }, { data: courses }, { data: applicants }, { data: payments }] = await Promise.all([
    supabase.from("centers").select("name, center_number").eq("id", centerId).maybeSingle(),
    supabase
      .from("courses")
      .select("id, name, start_date, end_date, delivery_mode")
      .eq("center_id", centerId)
      .order("start_date", { ascending: false }),
    canView(ctx.roles, "admissions.view")
      ? supabase.from("applicants").select("stage, intake_course_id, deposit_amount, deposit_paid_at").eq("center_id", centerId)
      : Promise.resolve({ data: [] }),
    canView(ctx.roles, "payments.view")
      ? supabase.from("payments").select("amount, currency, status, due_date, paid_at, payment_plan_id").eq("center_id", centerId)
      : Promise.resolve({ data: [] }),
  ]);

  // "There should be an indication there" (Ramy) -- unread admissions
  // notifications, and what the centre has actually emailed, both belong on
  // this page rather than only inside an applicant.
  const [{ data: notifications }, { data: recentEmails }] = await Promise.all([
    canView(ctx.roles, "admissions.view")
      ? supabase
          .from("admissions_notifications")
          .select("id, type, message, created_at, applicant_id")
          .eq("center_id", centerId)
          .is("read_at", null)
          .order("created_at", { ascending: false })
          .limit(6)
      : Promise.resolve({ data: [] }),
    canView(ctx.roles, "admissions.view")
      ? supabase
          .from("applicant_emails")
          .select("id, type, to_email, status, created_at")
          .eq("center_id", centerId)
          .order("created_at", { ascending: false })
          .limit(6)
      : Promise.resolve({ data: [] }),
  ]);

  const courseIds = (courses ?? []).map((c) => c.id);
  // volunteer_students is scoped by course, not centre -- it carries a
  // course_id and no center_id.
  const { data: volunteers } =
    canView(ctx.roles, "volunteers.view") && courseIds.length > 0
      ? await supabase.from("volunteer_students").select("id, course_id").in("course_id", courseIds)
      : { data: [] };

  // Per-course outstanding, so a course row can say where its money stands.
  const { data: plans } =
    canView(ctx.roles, "payments.view") && courseIds.length > 0
      ? await supabase.from("payment_plans").select("id, course_id").in("course_id", courseIds)
      : { data: [] };
  const courseOfPlan = new Map((plans ?? []).map((p) => [p.id, p.course_id]));
  const owedByCourse = new Map<string, number>();
  for (const p of payments ?? []) {
    if (p.status !== "pending" && p.status !== "missed") continue;
    const cid = courseOfPlan.get(p.payment_plan_id);
    if (cid) owedByCourse.set(cid, (owedByCourse.get(cid) ?? 0) + Number(p.amount));
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const paid = (payments ?? []).filter((p) => p.status === "paid");
  const collectedThisMonth = paid
    .filter((p) => p.paid_at && p.paid_at >= monthStart)
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const collectedCount = paid.filter((p) => p.paid_at && p.paid_at >= monthStart).length;
  const owing = (payments ?? []).filter((p) => p.status === "pending" || p.status === "missed");
  const outstanding = owing.reduce((sum, p) => sum + Number(p.amount), 0);
  const owingCourseCount = new Set(owing.map((p) => courseOfPlan.get(p.payment_plan_id)).filter(Boolean)).size;
  const withDeposit = (applicants ?? []).filter((a) => a.deposit_paid_at);
  const depositsHeld = withDeposit.reduce((sum, a) => sum + Number(a.deposit_amount ?? 0), 0);
  const missed = (payments ?? []).filter((p) => p.status === "missed");
  const currency = (payments ?? [])[0]?.currency ?? "";

  const stageCounts = new Map<string, number>();
  for (const a of applicants ?? []) stageCounts.set(a.stage, (stageCounts.get(a.stage) ?? 0) + 1);

  const money = (n: number) => `${currency}${n.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
  const dateRange = (a: string | null, b: string | null) => {
    const fmt = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    return a && b ? `${fmt(a)} – ${fmt(b)}` : "Dates not set";
  };
  const courseState = (start: string | null, end: string | null) => {
    const today = new Date().toISOString().slice(0, 10);
    if (start && today < start) return { label: "Upcoming", cls: "bg-surface-muted text-muted" };
    if (end && today > end) return { label: "Finished", cls: "bg-surface-muted text-muted" };
    return { label: "Running", cls: "bg-accent text-primary" };
  };

  const metrics = [
    { label: "Collected this month", value: money(collectedThisMonth), note: `${collectedCount} confirmed payment${collectedCount === 1 ? "" : "s"}`, alert: false },
    { label: "Outstanding balance", value: money(outstanding), note: owingCourseCount > 0 ? `across ${owingCourseCount} course${owingCourseCount === 1 ? "" : "s"}` : "nothing owed", alert: outstanding > 0 },
    { label: "Deposits held", value: money(depositsHeld), note: `${withDeposit.length} place${withDeposit.length === 1 ? "" : "s"}, not yet fully paid`, alert: false },
  ];

  return (
    <div className="flex flex-col gap-[26px]">
      <div>
        <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">
          {center?.name}
          {center?.center_number ? ` · Cambridge centre ${center.center_number}` : ""}
        </p>
        <h1 className="mt-1 font-serif text-[26px] text-ink">Centre overview</h1>
      </div>

      {canView(ctx.roles, "payments.view") ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {metrics.map((m) => (
            <div key={m.label} className="rounded-[10px] border border-border bg-card px-5 py-4">
              <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">{m.label}</p>
              <p className={`mt-1 font-serif text-[28px] ${m.alert ? "text-destructive" : "text-ink"}`}>{m.value}</p>
              <p className="mt-0.5 text-xs text-muted">{m.note}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="rounded-[10px] border border-border bg-card">
        <div className="flex items-baseline justify-between border-b border-border px-5 py-3.5">
          <h2 className="font-serif text-base text-ink">All courses</h2>
          <span className="text-xs text-muted">
            {(courses ?? []).length} across the centre
          </span>
        </div>
        {(courses ?? []).length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted">No courses in this centre yet.</p>
        ) : (
          (courses ?? []).map((c, i) => {
            const state = courseState(c.start_date, c.end_date);
            const owed = owedByCourse.get(c.id) ?? 0;
            return (
              <div
                key={c.id}
                className={`flex flex-wrap items-center gap-4 px-5 py-3.5 ${i > 0 ? "border-t border-border-faint" : ""}`}
              >
                <div className="min-w-[13rem] flex-1">
                  <p className="text-sm font-semibold text-ink">{c.name}</p>
                  <p className="text-xs text-muted">
                    {dateRange(c.start_date, c.end_date)}
                    {c.delivery_mode ? ` · ${c.delivery_mode}` : ""}
                  </p>
                </div>
                {canView(ctx.roles, "payments.view") ? (
                  <span className={`w-28 shrink-0 text-sm ${owed > 0 ? "text-destructive" : "text-muted"}`}>
                    {owed > 0 ? `${money(owed)} due` : "Fully paid"}
                  </span>
                ) : null}
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${state.cls}`}>
                  {state.label}
                </span>
              </div>
            );
          })
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {canView(ctx.roles, "admissions.view") ? (
          <div className="rounded-[10px] border border-border bg-card">
            <div className="flex items-baseline justify-between border-b border-border px-5 py-3.5">
              <h2 className="font-serif text-base text-ink">Admissions pipeline</h2>
              {/* The pipeline is the one place Admissions is reachable from now
                  that the nav is three tabs -- deliberately a link, not a dead
                  end. */}
              <Link href="/dashboard/admissions" className="text-xs font-medium text-primary hover:underline">
                Open &rarr;
              </Link>
            </div>
            {stageCounts.size === 0 ? (
              <p className="px-5 py-4 text-sm text-muted">Nobody in the pipeline yet.</p>
            ) : (
              [...stageCounts.entries()].map(([stage, count], i) => (
                <div key={stage} className={`flex items-center justify-between px-5 py-2.5 ${i > 0 ? "border-t border-border-faint" : ""}`}>
                  <span className="text-sm text-muted capitalize">{stage.replace(/_/g, " ")}</span>
                  <span className="text-sm text-ink tabular-nums">{count}</span>
                </div>
              ))
            )}
          </div>
        ) : null}

        <div className="flex flex-col gap-4">
          {canView(ctx.roles, "payments.view") ? (
            <div className="rounded-[10px] border border-border bg-card">
              <div className="border-b border-border px-5 py-3.5">
                <h2 className="font-serif text-base text-ink">Payments needing attention</h2>
              </div>
              {missed.length === 0 ? (
                <p className="px-5 py-4 text-sm text-muted">Nothing missed.</p>
              ) : (
                missed.map((p, i) => (
                  <div key={i} className={`flex items-center justify-between px-5 py-2.5 ${i > 0 ? "border-t border-border-faint" : ""}`}>
                    <span className="text-sm text-destructive">Missed instalment</span>
                    <span className="text-sm text-muted tabular-nums">
                      {money(Number(p.amount))} · due {p.due_date}
                    </span>
                  </div>
                ))
              )}
            </div>
          ) : null}

          {canView(ctx.roles, "volunteers.view") ? (
            <div className="rounded-[10px] border border-border bg-card">
              <div className="flex items-baseline justify-between border-b border-border px-5 py-3.5">
                <h2 className="font-serif text-base text-ink">Volunteer pool</h2>
                <span className="text-xs text-muted">{(volunteers ?? []).length} registered</span>
              </div>
              {/* The spec asks for hours "accumulated across every course and
                  level". volunteer_students carries a name and a course_id and
                  no cross-course identity, so totalling by name would silently
                  merge two different people. Stated rather than faked. */}
              <p className="px-5 py-3 text-xs text-muted">
                Hours toward certificates are tracked per course. A total across courses needs a way to recognise the
                same volunteer twice, which the records don&apos;t carry.
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {canView(ctx.roles, "admissions.view") ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-[10px] border border-border bg-card">
            <div className="flex items-baseline justify-between border-b border-border px-5 py-3.5">
              <h2 className="font-serif text-base text-ink">Needs a decision</h2>
              <span className="text-xs text-muted">{(notifications ?? []).length} unread</span>
            </div>
            {(notifications ?? []).length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted">Nothing waiting on the centre.</p>
            ) : (
              (notifications ?? []).map((n, i) => (
                <Link
                  key={n.id}
                  href={n.applicant_id ? `/dashboard/admissions/${n.applicant_id}` : "/dashboard/admissions"}
                  className={`flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-surface-muted/50 ${i > 0 ? "border-t border-border-faint" : ""}`}
                >
                  <span className="text-sm text-ink">{n.message}</span>
                  <span className="shrink-0 text-xs text-muted">
                    {new Date(n.created_at).toLocaleDateString("en-GB")}
                  </span>
                </Link>
              ))
            )}
          </div>

          <div className="rounded-[10px] border border-border bg-card">
            <div className="flex items-baseline justify-between border-b border-border px-5 py-3.5">
              <h2 className="font-serif text-base text-ink">Emails sent</h2>
              <span className="text-xs text-muted">most recent</span>
            </div>
            {(recentEmails ?? []).length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted">Nothing sent yet.</p>
            ) : (
              (recentEmails ?? []).map((e, i) => (
                <div key={e.id} className={`flex items-center justify-between gap-3 px-5 py-2.5 ${i > 0 ? "border-t border-border-faint" : ""}`}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink capitalize">{e.type.replace(/_/g, " ")}</span>
                    <span className="block truncate text-xs text-muted">{e.to_email}</span>
                  </span>
                  {/* "Sent" means the provider accepted it -- not that it was
                      delivered or read. Delivery webhooks aren't built, so the
                      label must not overclaim. */}
                  <span
                    className={`shrink-0 text-xs font-semibold ${e.status === "sent" ? "text-muted" : "text-destructive"}`}
                  >
                    {e.status === "sent" ? "Sent" : "Failed"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      {can(ctx.roles, "course.create") ? (
        <div>
          <Link
            href="/dashboard/admin"
            className="inline-block rounded-[6px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            New course
          </Link>
        </div>
      ) : null}
    </div>
  );
}
