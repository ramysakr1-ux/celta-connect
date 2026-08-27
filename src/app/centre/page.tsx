import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { can, canView } from "@/lib/auth/centre-permissions";
import { computeAssessorCentreHistory } from "@/lib/assessor-course-history";
import { AdmissionsChangeIndicator } from "@/app/centre/admissions-change-indicator";
import { DuplicateCourseForm } from "@/app/dashboard/admin/courses/[id]/duplicate-course-form";

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
  const canSeeAdmissions = canView(ctx.roles, "admissions.view", ctx.overrides);
  const [{ data: centres }, { data: courses }, { data: applicants }, { data: payments }, { count: unreadAdmissionsCount }] = await Promise.all([
    admin.from("centers").select("id, name, center_number").in("id", mine),
    admin
      .from("courses")
      .select("id, name, center_id, start_date, end_date, delivery_mode, course_code")
      .in("center_id", scope)
      .order("start_date", { ascending: false }),
    canSeeAdmissions
      ? admin.from("applicants").select("stage, center_id, deposit_amount, deposit_paid_at").in("center_id", scope)
      : Promise.resolve({ data: [] }),
    canView(ctx.roles, "payments.view", ctx.overrides)
      ? admin.from("payments").select("amount, currency, status, due_date, paid_at, payment_plan_id, center_id").in("center_id", scope)
      : Promise.resolve({ data: [] }),
    canSeeAdmissions
      ? admin.from("admissions_notifications").select("id", { count: "exact", head: true }).in("center_id", scope).is("read_at", null)
      : Promise.resolve({ count: 0 }),
  ]);

  const branches = (centres ?? []).map((c) => ({ id: c.id, name: c.name, centerNumber: c.center_number }));
  const branchName = new Map(branches.map((b) => [b.id, b.name]));
  const multiBranch = branches.length > 1;

  const courseIds = (courses ?? []).map((c) => c.id);
  // None of these five depend on each other's results (only on courseIds/
  // scope/ctx.roles, already in hand) -- batched into one round trip
  // instead of five stacked sequential ones.
  const [{ data: volunteers }, { data: assessorLinkRows }, { data: bounces }, { data: plans }, { data: pendingRefundRows }] = await Promise.all([
    canView(ctx.roles, "volunteers.view", ctx.overrides) && courseIds.length > 0
      ? admin.from("volunteer_students").select("id, volunteer_person_id").in("course_id", courseIds)
      : Promise.resolve({ data: [] }),
    // for-claude-code-concurrent-course-checks.md: "keep the assessor
    // history per centre so it can be seen." course_tutors is the real
    // per-course assessor link (assignExistingTutor's insert path), reused
    // here purely for visibility, nothing here blocks anything.
    canView(ctx.roles, "courseAdmin.view", ctx.overrides) && courseIds.length > 0
      ? admin.from("course_tutors").select("course_id, profile_id").eq("tutor_role", "external_assessor").in("course_id", courseIds)
      : Promise.resolve({ data: [] }),
    // "Only 'bounced' creates a task -- on the admissions screen, scoped to
    // the candidate." Surfaced here too because a bounced workspace
    // invitation to a paid-up candidate is the one nobody can afford to miss.
    canView(ctx.roles, "admissions.view", ctx.overrides)
      ? admin
          .from("email_bounce_tasks")
          .select("id, email_address, reason, consecutive_bounces, applicant_id")
          .in("center_id", scope)
          .is("resolved_at", null)
          .order("created_at", { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [] }),
    canView(ctx.roles, "payments.view", ctx.overrides) && courseIds.length > 0
      ? admin.from("payment_plans").select("id, course_id").in("course_id", courseIds)
      : Promise.resolve({ data: [] }),
    canView(ctx.roles, "payments.view", ctx.overrides)
      ? admin.from("refunds").select("id, amount").in("center_id", scope).eq("status", "pending")
      : Promise.resolve({ data: [] }),
  ]);
  const assessorProfileIds = [...new Set((assessorLinkRows ?? []).map((r) => r.profile_id))];
  const { data: assessorProfiles } =
    assessorProfileIds.length > 0 ? await admin.from("profiles").select("id, full_name").in("id", assessorProfileIds) : { data: [] };
  const assessorNameById = new Map((assessorProfiles ?? []).map((p) => [p.id, p.full_name]));
  const assessorHistory = computeAssessorCentreHistory(
    (courses ?? []).map((c) => ({ id: c.id, label: c.course_code ?? c.name, start_date: c.start_date, end_date: c.end_date })),
    (assessorLinkRows ?? []).map((r) => ({
      profileId: r.profile_id,
      name: assessorNameById.get(r.profile_id) ?? "Unknown",
      courseId: r.course_id,
    }))
  );

  // Overview only ever shows the count -- per-row detail (course, level,
  // hours, link/unlink) moved to its own screen, /centre/volunteers
  // (Volunteer Pool.dc.html, Desktop/Connect.zip handoff, 2026-08-20), so
  // this no longer needs the hours computation (course_timetable_events +
  // volunteer_attendance + computeSessionTicks) that page now owns alone.
  // Group by volunteer_person_id when linked; an unlinked volunteer is its
  // own group of one, keyed by its own row id so it still counts correctly.
  const volunteerPersonCount = new Set((volunteers ?? []).map((v) => v.volunteer_person_id ?? v.id)).size;

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

  const courseStateCounts = (courses ?? []).reduce(
    (acc, c) => {
      const label = courseState(c.start_date, c.end_date).label;
      if (label === "Upcoming") acc.upcoming += 1;
      else if (label === "Closed") acc.closed += 1;
      else acc.running += 1;
      return acc;
    },
    { running: 0, upcoming: 0, closed: 0 }
  );

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
          {can(ctx.roles, "payments.view", ctx.overrides) ? (
            <a
              href={`/centre/financials.csv${branch ? `?branch=${branch}` : ""}`}
              className="admin-hover-fill rounded-[6px] border border-border px-4 py-2 text-sm font-semibold text-ink hover:bg-surface-muted"
            >
              Export financials
            </a>
          ) : null}
          {can(ctx.roles, "roles.grant", ctx.overrides) ? (
            <Link
              href="/centre/roles"
              className="rounded-[6px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Invite people
            </Link>
          ) : null}
        </div>
      </div>

      {canView(ctx.roles, "payments.view", ctx.overrides) ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((m, i) => (
            <div
              key={m.label}
              className={`card px-5 py-4 ${m.alert ? "card-side-amber" : i % 2 === 0 ? "card-side-teal" : "card-side-garnet"}`}
            >
              <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">{m.label}</p>
              <p className={`mt-1 font-serif text-[28px] ${m.alert ? "text-destructive" : "text-ink"}`}>{m.value}</p>
              <p className="mt-0.5 text-xs text-muted">{m.note}</p>
            </div>
          ))}
        </div>
      ) : null}

      {/* Centre Admin.dc.html: a 1fr / 360px split. All courses fills the
          left; the right column stacks admissions, payments, volunteers and
          settings in that order. */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px] lg:items-start">
        <div className="flex flex-col gap-4">
      <div className="card !p-0">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-5 py-3.5">
          <h2 className="font-serif text-base text-ink">All courses</h2>
          <span className="text-xs text-muted">
            {/* for-claude-code-course-admin-final-scope.md: "how many, their
                status." A per-status breakdown, not just a flat total. */}
            {courseStateCounts.running} running · {courseStateCounts.upcoming} upcoming · {courseStateCounts.closed} closed
          </span>
        </div>
        {(courses ?? []).length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted">No courses yet.</p>
        ) : (
          (courses ?? []).map((c, i) => {
            const state = courseState(c.start_date, c.end_date);
            const owed = owedByCourse.get(c.id) ?? 0;
            return (
              <div key={c.id} className={`admin-hover flex flex-wrap items-center gap-4 px-5 py-3.5 ${i > 0 ? "border-t border-border-faint" : ""}`}>
                <Link href={`/centre/courses/${c.id}`} className="min-w-[13rem] flex-1 hover:text-primary">
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
                </Link>
                {canView(ctx.roles, "payments.view", ctx.overrides) ? (
                  <span className={`w-28 shrink-0 text-sm ${owed > 0 ? "text-destructive" : "text-muted"}`}>
                    {owed > 0 ? `${money(owed)} due` : "Fully paid"}
                  </span>
                ) : null}
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${state.cls}`}>{state.label}</span>
                {/* "Duplicate-course lives on this overview (the course
                    list), not inside an individual course's detail." */}
                {can(ctx.roles, "course.create", ctx.overrides) ? <DuplicateCourseForm courseId={c.id} suggestedName={`${c.name} (copy)`} /> : null}
              </div>
            );
          })
        )}
      </div>

      {/* "Only 'bounced' creates a task." Above the fold, because a bounced
          workspace invitation to a paid-up candidate is someone with no way
          into the course they've paid for. */}
      {(bounces ?? []).length > 0 ? (
        <div className="card card-red !p-0 border-destructive/25 bg-destructive/5">
          <div className="flex items-baseline justify-between border-b border-destructive/20 px-5 py-3.5">
            <h2 className="font-serif text-base text-ink">Email couldn&apos;t be delivered</h2>
            <span className="text-xs text-muted">{(bounces ?? []).length} to fix</span>
          </div>
          {(bounces ?? []).map((b, i) => (
            <div key={b.id} className={`admin-hover px-5 py-2.5 ${i > 0 ? "border-t border-destructive/15" : ""}`}>
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

        </div>

        <div className="flex flex-col gap-4">
        {canView(ctx.roles, "admissions.view", ctx.overrides) ? (
          <div className="card card-garnet !p-0">
            <div className="flex items-baseline justify-between border-b border-border px-5 py-3.5">
              <div className="flex items-center gap-2">
                <h2 className="font-serif text-base text-ink">Admissions pipeline</h2>
                <AdmissionsChangeIndicator centerIds={scope} initialUnread={(unreadAdmissionsCount ?? 0) > 0} />
              </div>
              <Link href="/dashboard/admissions" className="text-xs font-medium text-primary hover:underline">
                Open &rarr;
              </Link>
            </div>
            {stageCounts.size === 0 ? (
              <p className="px-5 py-4 text-sm text-muted">Nobody in the pipeline yet.</p>
            ) : (
              [...stageCounts.entries()].map(([stage, count], i) => (
                <div key={stage} className={`admin-hover px-5 py-2.5 ${i > 0 ? "border-t border-border-faint" : ""}`}>
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

          {canView(ctx.roles, "payments.view", ctx.overrides) ? (
            <div className={`card !p-0 ${missed.length > 0 ? "card-amber" : "card-gold"}`}>
              <div className="border-b border-border px-5 py-3.5">
                <h2 className="font-serif text-base text-ink">Payments needing attention</h2>
              </div>
              {missed.length === 0 ? (
                <p className="px-5 py-4 text-sm text-muted">Nothing missed.</p>
              ) : (
                missed.map((p, i) => (
                  <div key={i} className={`admin-hover flex items-center justify-between px-5 py-2.5 ${i > 0 ? "border-t border-border-faint" : ""}`}>
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

          {canView(ctx.roles, "volunteers.view", ctx.overrides) ? (
            <Link
              href="/centre/volunteers"
              className="admin-hover-fill card flex items-center justify-between gap-3 px-5 py-3.5 transition-colors duration-150 hover:border-primary hover:bg-[color-mix(in_oklab,var(--color-primary)_30%,var(--color-card))]"
            >
              <div className="flex flex-col gap-0.5">
                <h2 className="font-serif text-base text-ink">Volunteer pool</h2>
                <span className="text-xs text-muted">
                  {volunteerPersonCount} {volunteerPersonCount === 1 ? "person" : "people"} &middot;{" "}
                  {(volunteers ?? []).length} registrations
                </span>
              </div>
              <span className="text-xs font-semibold text-primary">See all →</span>
            </Link>
          ) : null}

          {canView(ctx.roles, "courseAdmin.view", ctx.overrides) && assessorHistory.length > 0 ? (
            <Link
              href="/centre/assessor-history"
              className="admin-hover-fill card card-gold flex items-center justify-between gap-3 px-5 py-3.5 transition-colors duration-150 hover:border-primary hover:bg-[color-mix(in_oklab,var(--color-primary)_30%,var(--color-card))]"
            >
              <div className="flex flex-col gap-0.5">
                <h2 className="font-serif text-base text-ink">Assessor history</h2>
                <span className="text-xs text-muted">
                  {assessorHistory.length} {assessorHistory.length === 1 ? "assessor" : "assessors"}
                  {assessorHistory.some((a) => a.flag)
                    ? ` · ${assessorHistory.filter((a) => a.flag).length} at or over a Handbook 12.3 limit`
                    : ""}
                </span>
              </div>
              <span className="text-xs font-semibold text-primary">See all →</span>
            </Link>
          ) : null}
        </div>
      </div>

      {can(ctx.roles, "course.create", ctx.overrides) ? (
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
