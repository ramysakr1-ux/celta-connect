import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";

function money(amount: number, currency: string) {
  return `${currency}${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

// command-center-full-spec.md's Money section -- billing is Connect's own
// ledger, platform-wide regardless of Owner/Invited access, same rule
// /platform/accounts and Overview's "Needs your attention" already use.
//
// "Connected to Stripe" in the mockup is honestly not true of this app --
// centre_invoices/centre_subscriptions are recorded by hand today
// (/platform/accounts' own manual forms), no Stripe integration exists at
// the platform-billing level (a centre's own payment_provider is a
// different, centre-scoped thing -- collecting from their candidates, not
// Connect billing the centre). Shown disconnected rather than faked.
//
// Migrated onto the shared .card design system 27 Aug 2026 -- was hand-built
// inline styles (CARD/GOLD/GREEN/RED literals) copied straight from
// command-center-visual-reference.html. "Outstanding" keeps its real amber
// meaning via .callout-gold (the system's own "light color-mix into the
// card level, never a flat fill" treatment); the disabled "Connect to
// Stripe" placeholder now matches the identical disabled-integration button
// already established on /platform/accounts ("Connect payment provider").
export default async function CommandCenterMoneyPage() {
  await requireRole("platform_owner");
  const admin = createAdminClient();

  const [{ data: centers }, { data: invoices }] = await Promise.all([
    admin.from("centers").select("id, name"),
    admin.from("centre_invoices").select("*").order("created_at", { ascending: false }),
  ]);
  const centerNameById = new Map((centers ?? []).map((c) => [c.id, c.name]));
  const invoicesList = invoices ?? [];

  const now = new Date();
  const collectedThisMonth = new Map<string, number>();
  const outstanding = new Map<string, number>();
  for (const inv of invoicesList) {
    if (inv.status === "paid" && inv.paid_at) {
      const paidAt = new Date(inv.paid_at);
      if (paidAt.getFullYear() === now.getFullYear() && paidAt.getMonth() === now.getMonth()) {
        collectedThisMonth.set(inv.currency, (collectedThisMonth.get(inv.currency) ?? 0) + inv.amount);
      }
    }
    if (inv.status === "outstanding") {
      outstanding.set(inv.currency, (outstanding.get(inv.currency) ?? 0) + inv.amount);
    }
  }

  const OVERDUE_DAYS = 7;
  const overdueCutoff = new Date();
  overdueCutoff.setDate(overdueCutoff.getDate() - OVERDUE_DAYS);

  const recent = invoicesList.slice(0, 10);

  return (
    <div className="card flex max-w-[720px] flex-col gap-3.5 p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-lg text-ink">Billing &amp; payments</h2>
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted">
          <div className="h-1.5 w-1.5 rounded-full bg-muted" />
          Not connected
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="flex flex-col gap-0.5 rounded-[6px] bg-card-inset px-3.5 py-3">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-muted">Collected this month</div>
          <div className="font-serif text-xl font-semibold text-ink">
            {collectedThisMonth.size === 0 ? "—" : [...collectedThisMonth.entries()].map(([c, a]) => money(a, c)).join(" · ")}
          </div>
        </div>
        <div className="callout-gold flex flex-col gap-0.5 rounded-[6px] border border-gold/25 px-3.5 py-3">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-gold">Outstanding</div>
          <div className="font-serif text-xl font-semibold text-ink">
            {outstanding.size === 0 ? "—" : [...outstanding.entries()].map(([c, a]) => money(a, c)).join(" · ")}
          </div>
        </div>
      </div>

      <div className="flex flex-col">
        <div className="pb-2 text-[10.5px] font-bold uppercase tracking-[0.06em] text-muted">Recent transactions</div>
        {recent.length === 0 ? (
          <p className="text-[12.5px] text-muted">Nothing recorded yet.</p>
        ) : (
          recent.map((inv) => {
            const isOverdue = inv.status === "outstanding" && inv.due_date && new Date(inv.due_date) < overdueCutoff;
            return (
              <div key={inv.id} className="admin-hover flex items-center justify-between gap-2.5 border-t border-border py-[9px]">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <div className="text-[12.5px] font-semibold text-ink">{centerNameById.get(inv.center_id) ?? "Unknown centre"}</div>
                  <div className="text-[11px] text-muted">{inv.note ?? (inv.status === "paid" ? "Course fee" : "Invoice")}</div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <div className="text-[12.5px] font-bold text-ink">{money(inv.amount, inv.currency)}</div>
                  <div className={`text-[10.5px] font-bold ${inv.status === "paid" ? "text-primary" : isOverdue ? "text-destructive" : "text-muted"}`}>
                    {inv.status === "paid" ? "PAID" : isOverdue ? "OVERDUE" : inv.status.toUpperCase()}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <p className="text-[11.5px] leading-normal text-muted">
        No Stripe (or other payment processor) connection exists for platform billing yet — invoices above are recorded by hand.
      </p>
      <button
        type="button"
        disabled
        title="Not built yet"
        className="h-10 rounded-[6px] border border-input bg-card-inset px-4 text-sm font-semibold text-muted opacity-60"
      >
        Connect to Stripe
      </button>
      <Link href="/platform/accounts" className="text-[11px] font-semibold text-muted hover:underline">
        Manage subscriptions &amp; invoices →
      </Link>
    </div>
  );
}
