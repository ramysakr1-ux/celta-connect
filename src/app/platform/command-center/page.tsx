import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";
import { SubscriptionForm, InvoiceForm, InvoiceRowActions } from "@/app/platform/command-center/command-center-forms";

// specs/for-claude-code-command-center-belongs-in-connect.md: this is Connect's
// own revenue/accounts view for the platform owner, not a Connect Hub screen --
// see that spec (and specs/command-center-visual-reference.html, which turned
// out not to match the spec's own description of it -- built to the spec's
// "What to build" list instead, adapting to Connect's design system rather
// than copying either). Connect's own data (centres, subscriptions, invoices)
// is wired for real; Connect Hub and Affina have no reporting mechanism yet
// (that's a separate, later piece of work) so their cards stay illustrative.
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

  const [{ data: centers }, { data: subscriptions }, { data: invoices }] = await Promise.all([
    admin.from("centers").select("id, name, center_number, is_demo, created_at").order("name", { ascending: true }),
    admin.from("centre_subscriptions").select("*"),
    admin
      .from("centre_invoices")
      .select("*")
      .order("created_at", { ascending: false }),
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
    <div className="min-h-full bg-tint-centre-admin">
      <div className="container flex flex-col gap-6 py-8">
      <div>
        <Link href="/platform" className="text-sm font-semibold text-primary hover:underline">
          ← Platform
        </Link>
        <h1 className="mt-2 font-serif text-2xl text-ink">Command center</h1>
        <p className="mt-1 text-sm text-muted">Revenue and accounts across every centre — platform-owner only.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Active centres</p>
          <p className="mt-1.5 text-2xl font-bold text-ink">{centresList.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">MRR</p>
          <p className="mt-1.5 text-2xl font-bold text-ink">
            {mrrByCurrency.length ? mrrByCurrency.map((m) => money(m.amount, m.currency)).join(" · ") : "—"}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Renewals due (30d)</p>
          <p className="mt-1.5 text-2xl font-bold text-ink">{renewalsDue.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Outstanding invoices</p>
          <p className="mt-1.5 text-2xl font-bold text-ink">
            {outstanding.length} {outstandingByCurrency.length ? `(${outstandingByCurrency.map((m) => money(m.amount, m.currency)).join(" · ")})` : ""}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card border-t-4 border-t-primary p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Connect</p>
          <p className="mt-1.5 text-xl font-bold text-ink">{centresList.length} centres</p>
          <p className="mt-1 text-sm text-muted">{mrrByCurrency.length ? mrrByCurrency.map((m) => money(m.amount, m.currency)).join(" · ") : "£0"}/mo</p>
        </div>
        <div className="card border-t-4 border-t-gold p-4 opacity-60">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Connect Hub</p>
          <p className="mt-1.5 text-xl font-bold text-ink">Illustrative</p>
          <p className="mt-1 text-sm text-muted">No usage/billing reporting wired yet — separate piece of work.</p>
        </div>
        <div className="card border-t-4 border-t-bronze p-4 opacity-60">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Affina</p>
          <p className="mt-1.5 text-xl font-bold text-ink">Illustrative</p>
          <p className="mt-1 text-sm text-muted">No usage/billing reporting wired yet — separate piece of work.</p>
        </div>
      </div>

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
              <div key={c.id} className="list-row flex flex-wrap items-center justify-between gap-3">
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

      <div className="card p-5">
        <h2 className="font-serif text-lg text-ink">Set a centre&apos;s subscription</h2>
        <p className="mt-1 text-sm text-muted">Hand-entered — no payment provider connected yet. One active plan per centre; saving again updates it.</p>
        <div className="mt-4">
          <SubscriptionForm centres={centresList} />
        </div>
      </div>

      <div className="card p-5">
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
        <button type="button" disabled className="mt-3 h-10 rounded-[6px] border border-input bg-card px-4 text-sm font-semibold text-muted opacity-60">
          Connect payment provider
        </button>
      </div>

      <div className="card">
        <div className="border-b border-border-faint px-5 py-3.5">
          <h2 className="font-serif text-lg text-ink">Activity</h2>
        </div>
        {activity.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted">Nothing yet.</p>
        ) : (
          activity.map((item, i) => (
            <div key={i} className="list-row flex items-center justify-between gap-3">
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
