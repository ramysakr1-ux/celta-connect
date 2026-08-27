import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";
import { SubscriptionForm, InvoiceForm, InvoiceRowActions } from "@/app/platform/accounts/accounts-forms";
import { tutorRoleLabel } from "@/lib/tutor-roles";

// specs/for-claude-code-command-center-belongs-in-connect.md: this is Connect's
// own revenue/accounts view for the platform owner, not a Connect Hub screen --
// see that spec (and specs/command-center-visual-reference.html, which turned
// out not to match the spec's own description of it -- built to the spec's
// "What to build" list instead, adapting to Connect's design system rather
// than copying either). Connect's own data (centres, subscriptions, invoices)
// is wired for real; Connect Hub and Affina have no reporting mechanism yet
// (that's a separate, later piece of work) so their cards stay illustrative.
//
// Moved from /platform/command-center to /platform/accounts, 2026-08-25
// (for-claude-code-command-center.md's routing note): the new design at
// /platform/command-center is a different page (operational overview, not
// revenue) -- this one keeps its exact content, just its own route and
// heading so the two don't share a name.
function money(amount: number, currency: string) {
  return `${currency}${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function groupByCurrency(rows: { amount: number; currency: string }[]) {
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(r.currency, (totals.get(r.currency) ?? 0) + r.amount);
  return [...totals.entries()].map(([currency, amount]) => ({ currency, amount }));
}

export default async function CommandCenterPage() {
  await requireRole("platform_owner");
  const admin = createAdminClient();

  const [{ data: centers }, { data: subscriptions }, { data: invoices }, { data: tutorLinks }] = await Promise.all([
    admin.from("centers").select("id, name, center_number, is_demo, created_at").order("name", { ascending: true }),
    admin.from("centre_subscriptions").select("*"),
    admin
      .from("centre_invoices")
      .select("*")
      .order("created_at", { ascending: false }),
    // for-claude-code-command-center-trainer-roster.md: "sourced from the
    // same tutor-to-course relational link already needed for the
    // concurrent-course checks" -- reuses course_tutors (migration 0051)
    // rather than a new model, same table src/lib/concurrent-course-check.ts
    // reads from.
    admin
      .from("course_tutors")
      .select("profile_id, tutor_role, joined_at, left_at, course_id")
      .order("joined_at", { ascending: false }),
  ]);

  const centresList = centers ?? [];
  const subsList = subscriptions ?? [];
  const invoicesList = invoices ?? [];

  const subByCenter = new Map(subsList.map((s) => [s.center_id, s]));
  const latestInvoiceByCenter = new Map<string, (typeof invoicesList)[number]>();
  for (const inv of invoicesList) {
    if (!latestInvoiceByCenter.has(inv.center_id)) latestInvoiceByCenter.set(inv.center_id, inv);
  }

  const activeSubs = subsList.filter((s) => s.status === "active");
  const mrrByCurrency = groupByCurrency(activeSubs.map((s) => ({ amount: s.monthly_amount, currency: s.currency })));

  const in30Days = new Date();
  in30Days.setDate(in30Days.getDate() + 30);
  const renewalsDue = activeSubs.filter((s) => s.renewal_date && new Date(s.renewal_date) <= in30Days);

  const outstanding = invoicesList.filter((i) => i.status === "outstanding");
  const outstandingByCurrency = groupByCurrency(outstanding.map((i) => ({ amount: i.amount, currency: i.currency })));

  const tutorLinksList = tutorLinks ?? [];
  const tutorProfileIds = [...new Set(tutorLinksList.map((t) => t.profile_id))];
  const tutorCourseIds = [...new Set(tutorLinksList.map((t) => t.course_id))];
  const { data: tutorProfiles } =
    tutorProfileIds.length > 0 ? await admin.from("profiles").select("id, full_name").in("id", tutorProfileIds) : { data: [] };
  const { data: tutorCourses } =
    tutorCourseIds.length > 0
      ? await admin.from("courses").select("id, name, course_code, start_date, end_date, center_id").in("id", tutorCourseIds)
      : { data: [] };
  const tutorNameById = new Map((tutorProfiles ?? []).map((p) => [p.id, p.full_name]));
  const tutorCourseById = new Map((tutorCourses ?? []).map((c) => [c.id, c]));
  const centerNameById = new Map(centresList.map((c) => [c.id, c.name]));

  interface TrainerAssignment {
    courseLabel: string;
    centerName: string;
    role: string;
    startDate: string;
    endDate: string;
  }
  interface TrainerRow {
    name: string;
    current: TrainerAssignment[];
    history: TrainerAssignment[];
  }
  const trainerByProfileId = new Map<string, TrainerRow>();
  for (const link of tutorLinksList) {
    const course = tutorCourseById.get(link.course_id);
    if (!course) continue;
    const row = trainerByProfileId.get(link.profile_id) ?? {
      name: tutorNameById.get(link.profile_id) ?? "Unknown",
      current: [],
      history: [],
    };
    const assignment: TrainerAssignment = {
      courseLabel: course.course_code || course.name,
      centerName: centerNameById.get(course.center_id) ?? "Unknown centre",
      role: tutorRoleLabel(link.tutor_role),
      startDate: course.start_date,
      endDate: course.end_date,
    };
    (link.left_at === null ? row.current : row.history).push(assignment);
    trainerByProfileId.set(link.profile_id, row);
  }
  const trainerRows = [...trainerByProfileId.values()].sort((a, b) => a.name.localeCompare(b.name));

  type ActivityItem = { at: string; label: string };
  const activity: ActivityItem[] = [
    ...centresList.map((c) => ({ at: c.created_at, label: `${c.name} joined Connect` })),
    ...subsList.map((s) => ({
      at: s.updated_at,
      label: `${centresList.find((c) => c.id === s.center_id)?.name ?? "A centre"}'s subscription set to ${s.status} (${money(s.monthly_amount, s.currency)}/mo)`,
    })),
    ...invoicesList.map((i) => ({
      at: i.paid_at ?? i.created_at,
      label: `${centresList.find((c) => c.id === i.center_id)?.name ?? "A centre"}'s ${money(i.amount, i.currency)} invoice ${i.status === "paid" ? "paid" : i.status === "void" ? "voided" : "recorded"}`,
    })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 15);

  return (
    <div className="container py-8">
      <div className="frame flex flex-col gap-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/platform/command-center" className="text-sm font-semibold text-primary hover:underline">
            ← Command center
          </Link>
          <h1 className="mt-2 font-serif text-2xl text-ink">Accounts</h1>
          <p className="mt-1 text-sm text-muted">Revenue and accounts across every centre — platform-owner only.</p>
        </div>
      </div>

      {/* Small KPI-tile-style stat cards move the decorative accent to the
          left side instead of the top rule, per the Centre Management pilot
          (src/app/centre/page.tsx) -- MRR/Renewals/Outstanding already carry
          a real semantic top-rule color (gold/conditional amber/conditional
          red) and stay untouched; only the one plain tile gets the side
          treatment. */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="card card-side-teal p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Active centres</p>
          <p className="mt-1.5 text-2xl font-bold text-ink">{centresList.length}</p>
        </div>
        <div className="card card-gold p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">MRR</p>
          <p className="mt-1.5 text-2xl font-bold text-ink">
            {mrrByCurrency.length ? mrrByCurrency.map((m) => money(m.amount, m.currency)).join(" · ") : "—"}
          </p>
        </div>
        <div className={`card p-4${renewalsDue.length ? " card-amber" : ""}`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Renewals due (30d)</p>
          <p className="mt-1.5 text-2xl font-bold text-ink">{renewalsDue.length}</p>
        </div>
        <div className={`card p-4${outstanding.length ? " card-red" : ""}`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Outstanding invoices</p>
          <p className="mt-1.5 text-2xl font-bold text-ink">
            {outstanding.length} {outstandingByCurrency.length ? `(${outstandingByCurrency.map((m) => money(m.amount, m.currency)).join(" · ")})` : ""}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card card-side-garnet p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Connect</p>
          <p className="mt-1.5 text-xl font-bold text-ink">{centresList.length} centres</p>
          <p className="mt-1 text-sm text-muted">{mrrByCurrency.length ? mrrByCurrency.map((m) => money(m.amount, m.currency)).join(" · ") : "£0"}/mo</p>
        </div>
        <div className="card card-gold p-4 opacity-60">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Connect Hub</p>
          <p className="mt-1.5 text-xl font-bold text-ink">Illustrative</p>
          <p className="mt-1 text-sm text-muted">No usage/billing reporting wired yet — separate piece of work.</p>
        </div>
        <div className="card card-amber p-4 opacity-60">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Affina</p>
          <p className="mt-1.5 text-xl font-bold text-ink">Illustrative</p>
          <p className="mt-1 text-sm text-muted">No usage/billing reporting wired yet — separate piece of work.</p>
        </div>
      </div>

      {/* Purely decorative teal/garnet alternation across these plain stacked
          cards below -- none carries a status of its own, same treatment as
          the Centre Management pilot (src/app/centre/page.tsx). */}
      <div className="card">
        <div className="border-b border-border-faint px-5 py-3.5">
          <h2 className="font-serif text-lg text-ink">Accounts ({centresList.length})</h2>
        </div>
        {centresList.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted">No centres yet.</p>
        ) : (
          centresList.map((c) => {
            const sub = subByCenter.get(c.id);
            const latestInvoice = latestInvoiceByCenter.get(c.id);
            return (
              <div key={c.id} className="list-row admin-hover flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-ink">
                    {c.name}
                    {c.is_demo ? <span className="ml-2 text-xs font-normal text-muted">(demo)</span> : null}
                  </span>
                  <span className="text-xs text-muted">
                    {sub ? `${sub.plan_name} · ${money(sub.monthly_amount, sub.currency)}/mo · ${sub.status}` : "No subscription on record"}
                    {sub?.renewal_date ? ` · renews ${sub.renewal_date}` : ""}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {latestInvoice ? (
                    <span className="flex items-center gap-2">
                      <span className="text-xs text-muted">
                        Last invoice: {money(latestInvoice.amount, latestInvoice.currency)} ({latestInvoice.status})
                      </span>
                      {latestInvoice.status === "outstanding" ? <InvoiceRowActions invoiceId={latestInvoice.id} /> : null}
                    </span>
                  ) : (
                    <span className="text-xs text-muted">No invoices yet</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="card card-garnet">
        <div className="border-b border-border-faint px-5 py-3.5">
          <h2 className="font-serif text-lg text-ink">Trainers ({trainerRows.length})</h2>
          <p className="mt-0.5 text-xs text-muted">Who&apos;s working where, across every centre — owner-only.</p>
        </div>
        {trainerRows.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted">No trainers on record yet.</p>
        ) : (
          trainerRows.map((t) => (
            <div key={t.name} className="list-row admin-hover flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink">{t.name}</span>
              {t.current.length > 0 ? (
                <div className="flex flex-col gap-0.5">
                  {t.current.map((a, i) => (
                    <span key={i} className="text-xs text-ink">
                      {a.centerName} · {a.courseLabel} — {a.role}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-muted">Not currently active on a course</span>
              )}
              {t.history.length > 0 ? (
                <div className="mt-1 flex flex-col gap-0.5 border-t border-border-faint pt-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">History</span>
                  {t.history.map((a, i) => (
                    <span key={i} className="text-xs text-muted">
                      {a.centerName} · {a.courseLabel} — {a.role} ({a.startDate}–{a.endDate})
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>

      <div className="card p-5">
        <h2 className="font-serif text-lg text-ink">Set a centre&apos;s subscription</h2>
        <p className="mt-1 text-sm text-muted">Hand-entered — no payment provider connected yet. One active plan per centre; saving again updates it.</p>
        <div className="mt-4">
          <SubscriptionForm centres={centresList} />
        </div>
      </div>

      <div className="card card-garnet p-5">
        <h2 className="font-serif text-lg text-ink">Record an invoice</h2>
        <div className="mt-4">
          <InvoiceForm centres={centresList} />
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-serif text-lg text-ink">Payments</h2>
        <p className="mt-1 text-sm text-muted">
          No payment provider is connected for centre subscriptions. Wiring one (Stripe or equivalent — webhooks, checkout, invoice automation) is its
          own scoped piece of work.
        </p>
        <button type="button" disabled className="mt-3 h-10 rounded-[6px] border border-input bg-card-inset px-4 text-sm font-semibold text-muted opacity-60">
          Connect payment provider
        </button>
      </div>

      <div className="card card-garnet">
        <div className="border-b border-border-faint px-5 py-3.5">
          <h2 className="font-serif text-lg text-ink">Activity</h2>
        </div>
        {activity.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted">Nothing yet.</p>
        ) : (
          activity.map((item, i) => (
            <div key={i} className="list-row admin-hover flex items-center justify-between gap-3">
              <span className="text-sm text-ink">{item.label}</span>
              <span className="text-xs text-muted">{new Date(item.at).toLocaleString()}</span>
            </div>
          ))
        )}
      </div>
      </div>
    </div>
  );
}
