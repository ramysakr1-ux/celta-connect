import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { can, canView } from "@/lib/auth/centre-permissions";
import { computeAssessorCentreHistory } from "@/lib/assessor-course-history";
import { AdmissionsChangeIndicator } from "@/app/centre/admissions-change-indicator";
import { DuplicateCourseForm } from "@/app/dashboard/admin/courses/[id]/duplicate-course-form";
import { formatCalendarDate } from "@/lib/format-date";
import { CourseStatePill, computeCourseState } from "@/components/course-state-pill";
import { toLocalIso, zonedTimeToUtc, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";
import { sumByCurrency, formatTotals, formatCurrency, isMixed } from "@/lib/money-by-currency";
import { RoomHead, ROOM_BUTTON, ROOM_PRIMARY } from "@/components/room-head";
import { BranchChip } from "@/components/branch-chip";

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
    admin.from("centers").select("id, name, center_number, currency, time_zone").in("id", mine),
    admin
      .from("courses")
      .select("id, name, center_id, start_date, end_date, delivery_mode, course_code")
      .in("center_id", scope)
      .order("start_date", { ascending: false }),
    canSeeAdmissions
      ? admin.from("applicants").select("id, stage, center_id, deposit_amount, deposit_currency, deposit_paid_at").in("center_id", scope)
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
      ? admin.from("payment_plans").select("id, course_id, applicant_id").in("course_id", courseIds)
      : Promise.resolve({ data: [] }),
    canView(ctx.roles, "payments.view", ctx.overrides)
      ? admin.from("refunds").select("id, amount, currency").in("center_id", scope).eq("status", "pending")
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
  const owedRowsByCourse = new Map<string, { amount: number; currency: string | null }[]>();
  const owedByCourse = new Map<string, number>();
  // A2: one vocabulary for money -- red is a promise broken (an instalment
  // whose date has passed unpaid), amber is owed but not yet late, and money
  // fully paid says nothing at all. A course's row needs to know which.
  const missedByCourse = new Set<string>();
  for (const p of payments ?? []) {
    if (p.status !== "pending" && p.status !== "missed") continue;
    const cid = courseOfPlan.get(p.payment_plan_id);
    if (!cid) continue;
    if (p.status === "missed") missedByCourse.add(cid);
    owedByCourse.set(cid, (owedByCourse.get(cid) ?? 0) + Number(p.amount));
    owedRowsByCourse.set(cid, [...(owedRowsByCourse.get(cid) ?? []), { amount: Number(p.amount), currency: p.currency }]);
  }

  const now = new Date();
  // "This month" on the centre's own calendar, not the server's. Built from
  // the server's local zone (UTC on Vercel), the first of the month landed
  // hours out for every centre off UTC, so a payment taken late on the last
  // day of a month could count toward the wrong one.
  const overviewZone = (centres ?? []).find((c) => c.id === (ctx.activeCenterId ?? profile.center_id))?.time_zone ?? DEFAULT_TIMEZONE;
  const localToday = toLocalIso(now, overviewZone);
  const monthStart = zonedTimeToUtc(`${localToday.slice(0, 7)}-01`, "00:00", overviewZone).toISOString();
  const paid = (payments ?? []).filter((p) => p.status === "paid" && p.paid_at && p.paid_at >= monthStart);
  const collectedThisMonth = paid.reduce((sum, p) => sum + Number(p.amount), 0);
  const owing = (payments ?? []).filter((p) => p.status === "pending" || p.status === "missed");
  const outstanding = owing.reduce((sum, p) => sum + Number(p.amount), 0);
  const owingCourseCount = new Set(owing.map((p) => courseOfPlan.get(p.payment_plan_id)).filter(Boolean)).size;
  const pendingRefunds = pendingRefundRows ?? [];
  const refundsPending = pendingRefunds.reduce((sum, r) => sum + Number(r.amount), 0);

  // "Deposits held -- N places, not yet fully paid" was every applicant who
  // had ever paid a deposit: people who later withdrew or were turned down,
  // and people who have since paid in full. Neither is a place the centre is
  // holding money against, and the caption asserted something nothing
  // checked (walked 15 Sep 2026).
  const GONE: string[] = ["rejected_before_interview", "rejected_after_interview", "not_this_time", "withdrawn_application"];
  const owingByApplicant = new Set(
    owing.map((p) => (plans ?? []).find((pl) => pl.id === p.payment_plan_id)?.applicant_id).filter(Boolean) as string[]
  );
  const settledApplicantIds = new Set(
    (plans ?? []).map((pl) => pl.applicant_id).filter((id): id is string => Boolean(id) && !owingByApplicant.has(id as string))
  );
  const withDeposit = (applicants ?? []).filter(
    (a) => a.deposit_paid_at && !GONE.includes(a.stage) && !settledApplicantIds.has(a.id)
  );
  const depositsHeld = withDeposit.reduce((sum, a) => sum + Number(a.deposit_amount ?? 0), 0);
  const missed = (payments ?? []).filter((p) => p.status === "missed");
  // The centre's own currency, with the first payment row behind it for a
  // centre that has not set one, and GBP behind that. It is only the
  // FALLBACK now: every figure below totals per currency.
  //
  // An older note here said these totals summing without regard to each
  // row's currency was "correct while a centre bills in one currency (all
  // three do)". The demo centre alone holds $4,200 and £2,000 outstanding,
  // so it never was: it printed "$6,200", which is not an amount of
  // anything (walked 15 Sep 2026).
  const currencyCode =
    (centres ?? []).map((c) => (c as { currency?: string | null }).currency).find((c) => c && /^[A-Z]{3}$/.test(c)) ??
    (payments ?? [])[0]?.currency ??
    "GBP";

  const stageCounts = new Map<string, number>();
  // "the pipeline is totalled with a per-branch split beneath"
  const stageByBranch = new Map<string, Map<string, number>>();
  for (const a of applicants ?? []) {
    stageCounts.set(a.stage, (stageCounts.get(a.stage) ?? 0) + 1);
    const per = stageByBranch.get(a.stage) ?? new Map<string, number>();
    per.set(a.center_id, (per.get(a.center_id) ?? 0) + 1);
    stageByBranch.set(a.stage, per);
  }

  const dateRange = (a: string | null, b: string | null) => {
    const fmt = (iso: string) => formatCalendarDate(iso, { day: "numeric", month: "short" });
    return a && b ? `${fmt(a)} – ${fmt(b)}` : "Dates not set";
  };
  // A3: the tints live in CourseStatePill now, and the state comes from the
  // shared computeCourseState. The old inline copy read the date off
  // `new Date().toISOString()` -- the SERVER's UTC day, on a page that
  // already knows the centre's own (localToday) -- so a course could read
  // Upcoming for hours after it had started.
  const stateOf = (start: string | null, end: string | null) =>
    computeCourseState(start ?? localToday, end ?? localToday, localToday);

  const courseStateCounts = (courses ?? []).reduce(
    (acc, c) => {
      acc[stateOf(c.start_date, c.end_date)] += 1;
      return acc;
    },
    { running: 0, upcoming: 0, closed: 0 }
  );

  const collectedTotals = sumByCurrency(paid, currencyCode);
  const outstandingTotals = sumByCurrency(owing, currencyCode);
  const depositTotals = sumByCurrency(
    withDeposit.map((a) => ({ amount: a.deposit_amount, currency: a.deposit_currency })),
    currencyCode
  );
  const refundTotals = sumByCurrency(pendingRefunds, currencyCode);

  const metrics = [
    {
      label: "Collected this month",
      value: formatTotals(collectedTotals, currencyCode),
      note: `${paid.length} confirmed payment${paid.length === 1 ? "" : "s"}${isMixed(collectedTotals) ? ", two currencies" : ""}`,
      tone: "none" as const,
    },
    {
      label: "Outstanding balance",
      value: formatTotals(outstandingTotals, currencyCode),
      note:
        owingCourseCount > 0
          ? `across ${owingCourseCount} course${owingCourseCount === 1 ? "" : "s"}${isMixed(outstandingTotals) ? ", two currencies" : ""}`
          : "nothing owed",
      // Owed, not late: the panel below is where a MISSED instalment shows.
      tone: outstanding > 0 ? ("owed" as const) : ("none" as const),
    },
    {
      label: "Deposits held",
      value: formatTotals(depositTotals, currencyCode),
      note: `${withDeposit.length} place${withDeposit.length === 1 ? "" : "s"}, not yet fully paid`,
      tone: "none" as const,
    },
    // "Refunds pending" -- agreed but not yet returned. Alerts on any amount
    // at all, unlike the others: a refund somebody was promised and never
    // received is a different kind of problem from money merely outstanding.
    {
      label: "Refunds pending",
      value: formatTotals(refundTotals, currencyCode),
      note: pendingRefunds.length
        ? `${pendingRefunds.length} awaiting payout`
        : "Nothing awaiting action",
      // The centre owes this one out; still owed rather than overdue.
      tone: refundsPending > 0 ? ("owed" as const) : ("none" as const),
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
      <RoomHead
        eyebrow={
          shown
            ? `${shown.name}${shown.centerNumber ? ` · Cambridge centre ${shown.centerNumber}` : ""}`
            : multiBranch
              ? `${branches.length} branches`
              : `${branches[0]?.name ?? ""}${branches[0]?.centerNumber ? ` · Cambridge centre ${branches[0].centerNumber}` : ""}`
        }
        title={heading}
      >
        {can(ctx.roles, "payments.view", ctx.overrides) ? (
          <a href={`/centre/financials.csv${branch ? `?branch=${branch}` : ""}`} className={ROOM_BUTTON}>
            Export financials
          </a>
        ) : null}
        {can(ctx.roles, "roles.grant", ctx.overrides) ? (
          <Link href="/centre/roles" className={ROOM_PRIMARY}>
            Invite people
          </Link>
        ) : null}
      </RoomHead>

      {canView(ctx.roles, "payments.view", ctx.overrides) ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((m, i) => (
            <div
              key={m.label}
              className={`card px-5 py-4 ${m.tone === "owed" ? "card-side-amber" : ""}`}
            >
              <p className="text-label font-semibold tracking-[0.08em] text-muted uppercase">{m.label}</p>
              <p className={`mt-1 font-serif text-h1 ${m.tone === "owed" ? "text-status-warning-text" : "text-ink"}`}>{m.value}</p>
              <p className="mt-0.5 text-label text-muted">{m.note}</p>
            </div>
          ))}
        </div>
      ) : null}

      {/* Centre Admin.dc.html: a 1fr / 360px split. All courses fills the
          left; the right column stacks admissions, payments, volunteers and
          settings in that order. */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px] lg:items-start">
        <div className="flex flex-col gap-4">
      {/* The room's own object carries the room's colour (centre side A1). */}
      <div className="card card-accent !p-0">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-5 py-4">
          <h2 className="font-serif text-h3 font-semibold text-ink">All courses</h2>
          <span className="text-label text-muted">
            {/* for-claude-code-course-admin-final-scope.md: "how many, their
                status." A per-status breakdown, not just a flat total. */}
            {courseStateCounts.running} running · {courseStateCounts.upcoming} upcoming · {courseStateCounts.closed} closed
          </span>
        </div>
        {(courses ?? []).length === 0 ? (
          <p className="px-5 py-4 text-body text-muted">No courses yet.</p>
        ) : (
          (courses ?? []).map((c, i) => {
            const state = stateOf(c.start_date, c.end_date);
            const owed = owedByCourse.get(c.id) ?? 0;
            return (
              <div key={c.id} className={`lift flex flex-wrap items-center gap-4 px-5 py-4 ${i > 0 ? "border-t border-border-faint" : ""}`}>
                <Link href={`/centre/courses/${c.id}`} className="min-w-[13rem] flex-1 hover:text-primary">
                  <p className="text-body font-semibold text-ink">
                    {c.name}
                    {/* "The branch always travels with the course code" -- a code
                        is ambiguous across two cities, so it never appears alone. */}
                    {multiBranch ? <BranchChip name={branchName.get(c.center_id)} className="ml-2" /> : null}
                  </p>
                  <p className="text-label text-muted">
                    {dateRange(c.start_date, c.end_date)}
                    {c.delivery_mode ? ` · ${c.delivery_mode}` : ""}
                  </p>
                </Link>
                {canView(ctx.roles, "payments.view", ctx.overrides) ? (
                  <span className={`w-28 shrink-0 text-body ${owed > 0 ? (missedByCourse.has(c.id) ? "text-destructive" : "text-status-warning-text") : "text-muted"}`}>
                    {owed > 0 ? `${formatTotals(sumByCurrency(owedRowsByCourse.get(c.id) ?? [], currencyCode), currencyCode)} due` : "Fully paid"}
                  </span>
                ) : null}
                <CourseStatePill state={state} />
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
      {/* C6: card-red already draws the edge; the inline border utility
          painted it a second time. The tint stays -- it is the panel, not
          the edge. */}
      {(bounces ?? []).length > 0 ? (
        <div className="card card-red !p-0 bg-destructive/5">
          <div className="flex items-baseline justify-between border-b border-destructive/20 px-5 py-4">
            <h2 className="font-serif text-h3 font-semibold text-ink">Email couldn&apos;t be delivered</h2>
            <span className="text-label text-muted">{(bounces ?? []).length} to fix</span>
          </div>
          {(bounces ?? []).map((b, i) => (
            <div key={b.id} className={`lift px-5 py-4 ${i > 0 ? "border-t border-destructive/15" : ""}`}>
              <div className="flex items-center justify-between gap-3">
                {b.applicant_id ? (
                  <Link href={`/dashboard/admissions/${b.applicant_id}`} className="text-body text-ink hover:underline">
                    {b.email_address}
                  </Link>
                ) : (
                  <span className="text-body text-ink">{b.email_address}</span>
                )}
                <span className="shrink-0 text-label font-semibold text-destructive">
                  {b.consecutive_bounces >= 2 ? "Sending stopped" : "Bounced"}
                </span>
              </div>
              {/* The provider's own words, never a status code. */}
              <p className="text-label text-muted">{b.reason}</p>
            </div>
          ))}
        </div>
      ) : null}

        </div>

        <div className="flex flex-col gap-4">
        {canView(ctx.roles, "admissions.view", ctx.overrides) ? (
          <div className="card !p-0">
            <div className="flex items-baseline justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <h2 className="font-serif text-h3 font-semibold text-ink">Admissions pipeline</h2>
                <AdmissionsChangeIndicator centerIds={scope} initialUnread={(unreadAdmissionsCount ?? 0) > 0} />
              </div>
              <Link href="/dashboard/admissions" className="text-label font-medium text-primary hover:underline">
                Open
              </Link>
            </div>
            {stageCounts.size === 0 ? (
              <p className="px-5 py-4 text-body text-muted">
                Nobody in the pipeline yet. That is the ordinary state before a course opens for applications &mdash;
                the pipeline fills from the application form.
              </p>
            ) : (
              [...stageCounts.entries()].map(([stage, count], i) => (
                <div key={stage} className={`hover-ring px-5 py-4 ${i > 0 ? "border-t border-border-faint" : ""}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-body text-muted capitalize">{stage.replace(/_/g, " ")}</span>
                    <span className="text-body text-ink tabular-nums">{count}</span>
                  </div>
                  {/* The per-branch split sits beneath the total, per §13. */}
                  {multiBranch && !branch ? (
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-label text-muted">
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

          {/* A2: a missed instalment is the one red thing here; nothing
              missed carries no edge at all. */}
          {canView(ctx.roles, "payments.view", ctx.overrides) ? (
            <div className={`card !p-0 ${missed.length > 0 ? "card-red" : ""}`}>
              <div className="border-b border-border px-5 py-4">
                <h2 className="font-serif text-h3 font-semibold text-ink">Payments needing attention</h2>
              </div>
              {missed.length === 0 ? (
                <p className="px-5 py-4 text-body text-muted">Nothing missed.</p>
              ) : (
                missed.map((p, i) => (
                  <div key={i} className={`hover-ring flex items-center justify-between px-5 py-4 ${i > 0 ? "border-t border-border-faint" : ""}`}>
                    <span className="flex items-center gap-2 text-body text-destructive">
                      Missed instalment
                      {multiBranch ? <BranchChip name={branchName.get(p.center_id)} /> : null}
                    </span>
                    <span className="text-body text-muted tabular-nums">
                      {/* Each row in its own currency, and a date written
                          the way a person says it -- this printed the page's
                          currency over whatever the instalment was actually
                          billed in, and a raw "2026-09-09". */}
                      {formatCurrency(Number(p.amount), p.currency ?? currencyCode)}
                      {p.due_date ? ` · due ${formatCalendarDate(p.due_date, { day: "numeric", month: "short", year: "numeric" })}` : ""}
                    </span>
                  </div>
                ))
              )}
            </div>
          ) : null}

          {canView(ctx.roles, "volunteers.view", ctx.overrides) ? (
            <Link
              href="/centre/volunteers"
              className="wash card flex items-center justify-between gap-3 px-5 py-4 transition-colors duration-150 hover:border-primary"
            >
              <div className="flex flex-col gap-0.5">
                <h2 className="font-serif text-h3 font-semibold text-ink">Volunteer pool</h2>
                <span className="text-label text-muted">
                  {volunteerPersonCount} {volunteerPersonCount === 1 ? "person" : "people"} &middot;{" "}
                  {(volunteers ?? []).length} registrations
                </span>
              </div>
              <span className="text-label font-semibold text-primary">See all</span>
            </Link>
          ) : null}

          {/* The criteria glossary. Shared with every tutor at the centre --
              they reach the same screen from their own hub settings. Ramy,
              13 Sep 2026. */}
          {can(ctx.roles, "centre.settings.edit", ctx.overrides) ? (
            <Link
              href="/criteria-glossary"
              className="wash card flex items-center justify-between gap-3 px-5 py-4 transition-colors duration-150 hover:border-primary"
            >
              <div className="flex flex-col gap-0.5">
                <h2 className="font-serif text-h3 font-semibold text-ink">Criteria glossary</h2>
                <span className="text-label text-muted">
                  The words that tag a CELTA 5 criterion as a tutor writes feedback
                </span>
              </div>
              <span className="text-label font-semibold text-primary">Open</span>
            </Link>
          ) : null}

          {canView(ctx.roles, "courseAdmin.view", ctx.overrides) && assessorHistory.length > 0 ? (
            <Link
              href="/centre/assessor-history"
              className="wash card card-gold flex items-center justify-between gap-3 px-5 py-4 transition-colors duration-150 hover:border-primary"
            >
              <div className="flex flex-col gap-0.5">
                <h2 className="font-serif text-h3 font-semibold text-ink">Assessor history</h2>
                <span className="text-label text-muted">
                  {assessorHistory.length} {assessorHistory.length === 1 ? "assessor" : "assessors"}
                  {assessorHistory.some((a) => a.flag)
                    ? ` · ${assessorHistory.filter((a) => a.flag).length} at or over a Handbook limit`
                    : ""}
                </span>
              </div>
              <span className="text-label font-semibold text-primary">See all</span>
            </Link>
          ) : null}
        </div>
      </div>

      {/* "New course" moved to the tab row, 2 Sep 2026 -- it was the only
          action on this page and it sat below the assessor history. */}


    </div>
  );
}
