import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { can, canView } from "@/lib/auth/centre-permissions";

// Centre Admin's Overview.
//
// build-spec.md §13: the landing "aggregates across every centre the person
// holds a role at. Courses are listed with their branch; the pipeline is
// totalled with a per-branch split beneath." A filter narrows it; it never
// switches context.
//
// Reads go through the admin client because RLS resolves "my centre" to
// exactly one centre (current_center_id()), which cannot express "every branch
// I hold a role at". The authority is unchanged and explicit: every query is
// scoped to ctx.availableCenterIds, which is derived from live centre_roles
// grants, and the optional ?branch filter can only narrow that list -- a
// branch id the person holds nothing at resolves to nothing.
export default async function CentreOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string }>;
}) {
  const session = await getCurrentProfile();
  if (!session?.profile) redirect("/login");
  const profile = session.profile;

  const ctx = await getCentreRoleContext(profile);
  if (ctx.roles.length === 0) redirect("/dashboard");

  const { branch } = await searchParams;
  const mine = ctx.availableCenterIds;
  // A filter narrows what you already hold; it can never widen it.
  const scope = branch && mine.includes(branch) ? [branch] : mine;

  const admin = createAdminClient();
  const [{ data: centres }, { data: courses }, { data: applicants }, { data: payments }] = await Promise.all([
    admin.from("centers").select("id, name, center_number").in("id", mine),
    admin
      .from("courses")
      .select("id, name, center_id, start_date, end_date, delivery_mode")
      .in("center_id", scope)
      .order("start_date", { ascending: false }),
    canView(ctx.roles, "admissions.view")
      ? admin.from("applicants").select("stage, center_id, deposit_amount, deposit_paid_at").in("center_id", scope)
      : Promise.resolve({ data: [] }),
    canView(ctx.roles, "payments.view")
      ? admin.from("payments").select("amount, currency, status, due_date, paid_at, payment_plan_id, center_id").in("center_id", scope)
      : Promise.resolve({ data: [] }),
  ]);

  const branches = (centres ?? []).map((c) => ({ id: c.id, name: c.name, centerNumber: c.center_number }));
  const branchName = new Map(branches.map((b) => [b.id, b.name]));
  const multiBranch = branches.length > 1;

  const courseIds = (courses ?? []).map((c) => c.id);
  const { data: volunteers } =
    canView(ctx.roles, "volunteers.view") && courseIds.length > 0
      ? await admin.from("volunteer_students").select("id, course_id").in("course_id", courseIds)
      : { data: [] };

  // "Only 'bounced' creates a task -- on the admissions screen, scoped to the
  // candidate." Surfaced here too because a bounced workspace invitation to a
  // paid-up candidate is the one nobody can afford to miss.
  const { data: bounces } = canView(ctx.roles, "admissions.view")
    ? await admin
        .from("email_bounce_tasks")
        .select("id, email_address, reason, consecutive_bounces, applicant_id")
        .in("center_id", scope)
        .is("resolved_at", null)
        .order("created_at", { ascending: false })
        .limit(5)
    : { data: [] };

  const { data: plans } =
    canView(ctx.roles, "payments.view") && courseIds.length > 0
      ? await admin.from("payment_plans").select("id, course_id").in("course_id", courseIds)
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
  const paid = (payments ?? []).filter((p) => p.status === "paid" && p.paid_at && p.paid_at >= monthStart);
  const collectedThisMonth = paid.reduce((sum, p) => sum + Number(p.amount), 0);
  const owing = (payments ?? []).filter((p) => p.status === "pending" || p.status === "missed");
  const outstanding = owing.reduce((sum, p) => sum + Number(p.amount), 0);
  const owingCourseCount = new Set(owing.map((p) => courseOfPlan.get(p.payment_plan_id)).filter(Boolean)).size;
  const { data: pendingRefundRows } = canView(ctx.roles, "payments.view")
    ? await admin.from("refunds").select("id, amount").in("center_id", scope).eq("status", "pending")
    : { data: [] };
  const pendingRefunds = pendingRefundRows ?? [];
  const refundsPending = pendingRefunds.reduce((sum, r) => sum + Number(r.amount), 0);

  const withDeposit = (applicants ?? []).filter((a) => a.deposit_paid_at);
  const depositsHeld = withDeposit.reduce((sum, a) => sum + Number(a.deposit_amount ?? 0), 0);
  const missed = (payments ?? []).filter((p) => p.status === "missed");
  const currency = (payments ?? [])[0]?.currency ?? "";

  const stageCounts = new Map<string, number>();
  // "the pipeline is totalled with a per-branch split beneath"
  const stageByBranch = new Map<string, Map<string, number>>();
  for (const a of applicants ?? []) {
    stageCounts.set(a.stage, (stageCounts.get(a.stage) ?? 0) + 1);
    const per = stageByBranch.get(a.stage) ?? new Map<string, number>();
    per.set(a.center_id, (per.get(a.center_id) ?? 0) + 1);
    stageByBranch.set(a.stage, per);
  }

  const money = (n: number) => `${currency}${n.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
  const dateRange = (a: string | null, b: string | null) => {
    const fmt = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    return a && b ? `${fmt(a)} – ${fmt(b)}` : "Dates not set";
  };
  // Centre Admin.dc.html gives each state its own tint, and they aren't
  // interchangeable: Upcoming is gold (something is coming that needs
  // preparing), Running is teal, Closed is grey and deliberately inert.
  // "Running" previously used bg-accent -- the pale green wash Ramy retired
  // on 16 Aug 2026 -- and "Upcoming" was the same grey as a finished course,
  // which lost the distinction the design draws.
  const courseState = (start: string | null, end: string | null) => {
    const today = new Date().toISOString().slice(0, 10);
    if (start && today < start) {
      return { label: "Upcoming", cls: "bg-[color-mix(in_oklab,oklch(60%_0.11_70)_14%,transparent)] text-[oklch(60%_0.11_70)]" };
    }
    if (end && today > end) return { label: "Closed", cls: "bg-surface-muted text-muted" };
    return { label: "Running", cls: "bg-[color-mix(in_oklab,oklch(38%_0.072_195)_12%,transparent)] text-primary" };
  };

  const metrics = [
    { label: "Collected this month", value: money(collectedThisMonth), note: `${paid.length} confirmed payment${paid.length === 1 ? "" : "s"}`, alert: false },
    { label: "Outstanding balance", value: money(outstanding), note: owingCourseCount > 0 ? `across ${owingCourseCount} course${owingCourseCount === 1 ? "" : "s"}` : "nothing owed", alert: outstanding > 0 },
    { label: "Deposits held", value: money(depositsHeld), note: `${withDeposit.length} place${withDeposit.length === 1 ? "" : "s"}, not yet fully paid`, alert: false },
    // "Refunds pending" -- agreed but not yet returned. Alerts on any amount
    // at all, unlike the others: a refund somebody was promised and never
    // received is a different kind of problem from money merely outstanding.
    {
      label: "Refunds pending",
      value: money(refundsPending),
      note: pendingRefunds.length
        ? `${pendingRefunds.length} awaiting payout`
        : "Nothing awaiting action",
      alert: refundsPending > 0,
    },
  ];

  const heading = multiBranch && !branch ? "Across your branches" : "Centre overview";
  const shown = branch ? branches.find((b) => b.id === branch) : null;

  return (
    <div className="flex flex-col gap-[26px]">
      {/* Centre Admin.dc.html puts two actions at the top right of the title
          row: "Export financials" (outlined) and "Invite people" (filled).
          Each is gated on the capability it actually needs, so a Centre
          manager -- read-only by design, "the absence of an edit button
          everywhere is the whole design" -- sees neither. */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">
            {shown
              ? `${shown.name}${shown.centerNumber ? ` · Cambridge centre ${shown.centerNumber}` : ""}`
              : multiBranch
                ? `${branches.length} branches`
                : `${branches[0]?.name ?? ""}${branches[0]?.centerNumber ? ` · Cambridge centre ${branches[0].centerNumber}` : ""}`}
          </p>
          <h1 className="mt-1 font-serif text-[26px] text-ink">{heading}</h1>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {can(ctx.roles, "payments.view") ? (
            <a
              href={`/centre/financials.csv${branch ? `?branch=${branch}` : ""}`}
              className="rounded-[6px] border border-border px-4 py-2 text-sm font-semibold text-ink hover:bg-surface-muted"
            >
              Export financials
            </a>
          ) : null}
          {can(ctx.roles, "roles.grant") ? (
            <Link
              href="/centre/roles"
              className="rounded-[6px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Invite people
            </Link>
          ) : null}
        </div>
      </div>

      {canView(ctx.roles, "payments.view") ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            {(courses ?? []).length} {multiBranch && !branch ? "across your branches" : "across the centre"}
          </span>
        </div>
        {(courses ?? []).length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted">No courses yet.</p>
        ) : (
          (courses ?? []).map((c, i) => {
            const state = courseState(c.start_date, c.end_date);
            const owed = owedByCourse.get(c.id) ?? 0;
            return (
              <div key={c.id} className={`flex flex-wrap items-center gap-4 px-5 py-3.5 ${i > 0 ? "border-t border-border-faint" : ""}`}>
                <div className="min-w-[13rem] flex-1">
                  <p className="text-sm font-semibold text-ink">
                    {c.name}
                    {/* "The branch always travels with the course code" -- a code
                        is ambiguous across two cities, so it never appears alone. */}
                    {multiBranch ? (
                      <span className="ml-2 rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-medium text-muted">
                        {branchName.get(c.center_id)}
                      </span>
                    ) : null}
                  </p>
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
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${state.cls}`}>{state.label}</span>
              </div>
            );
          })
        )}
      </div>

      {/* "Only 'bounced' creates a task." Above the fold, because a bounced
          workspace invitation to a paid-up candidate is someone with no way
          into the course they've paid for. */}
      {(bounces ?? []).length > 0 ? (
        <div className="rounded-[10px] border border-destructive/25 bg-destructive/5">
          <div className="flex items-baseline justify-between border-b border-destructive/20 px-5 py-3.5">
            <h2 className="font-serif text-base text-ink">Email couldn&apos;t be delivered</h2>
            <span className="text-xs text-muted">{(bounces ?? []).length} to fix</span>
          </div>
          {(bounces ?? []).map((b, i) => (
            <div key={b.id} className={`px-5 py-2.5 ${i > 0 ? "border-t border-destructive/15" : ""}`}>
              <div className="flex items-center justify-between gap-3">
                {b.applicant_id ? (
                  <Link href={`/dashboard/admissions/${b.applicant_id}`} className="text-sm text-ink hover:underline">
                    {b.email_address}
                  </Link>
                ) : (
                  <span className="text-sm text-ink">{b.email_address}</span>
                )}
                <span className="shrink-0 text-xs font-semibold text-destructive">
                  {b.consecutive_bounces >= 2 ? "Sending stopped" : "Bounced"}
                </span>
              </div>
              {/* The provider's own words, never a status code. */}
              <p className="text-xs text-muted">{b.reason}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {canView(ctx.roles, "admissions.view") ? (
          <div className="rounded-[10px] border border-border bg-card">
            <div className="flex items-baseline justify-between border-b border-border px-5 py-3.5">
              <h2 className="font-serif text-base text-ink">Admissions pipeline</h2>
              <Link href="/dashboard/admissions" className="text-xs font-medium text-primary hover:underline">
                Open &rarr;
              </Link>
            </div>
            {stageCounts.size === 0 ? (
              <p className="px-5 py-4 text-sm text-muted">Nobody in the pipeline yet.</p>
            ) : (
              [...stageCounts.entries()].map(([stage, count], i) => (
                <div key={stage} className={`px-5 py-2.5 ${i > 0 ? "border-t border-border-faint" : ""}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted capitalize">{stage.replace(/_/g, " ")}</span>
                    <span className="text-sm text-ink tabular-nums">{count}</span>
                  </div>
                  {/* The per-branch split sits beneath the total, per §13. */}
                  {multiBranch && !branch ? (
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-muted">
                      {[...(stageByBranch.get(stage) ?? new Map()).entries()].map(([cid, n]) => (
                        <span key={cid}>
                          {branchName.get(cid)} {n}
                        </span>
                      ))}
                    </div>
                  ) : null}
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
                    <span className="text-sm text-destructive">
                      Missed instalment{multiBranch ? ` · ${branchName.get(p.center_id)}` : ""}
                    </span>
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
              <p className="px-5 py-3 text-xs text-muted">
                Hours toward certificates are tracked per course. A total across courses needs a way to recognise the
                same volunteer twice, which the records don&apos;t carry.
              </p>
            </div>
          ) : null}
        </div>
      </div>

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
