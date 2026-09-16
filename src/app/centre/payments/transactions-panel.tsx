import { formatCurrency } from "@/lib/money-by-currency";

export interface TransactionRow {
  id: string;
  provider: string;
  eventType: "payment_succeeded" | "payment_failed" | "refunded";
  amount: number | null;
  currency: string | null;
  receivedAt: string;
}

const EVENT_LABEL: Record<TransactionRow["eventType"], string> = {
  payment_succeeded: "Payment succeeded",
  payment_failed: "Payment failed",
  refunded: "Refunded",
};

const EVENT_PILL_CLASS: Record<TransactionRow["eventType"], string> = {
  payment_succeeded: "status-pill-on-track",
  payment_failed: "status-pill-at-risk",
  refunded: "status-pill-pending",
};

/**
 * payment_provider_transactions logs every Stripe webhook event (migration
 * 0087) purely for idempotency -- the unique(provider, provider_event_id)
 * constraint stops a duplicate webhook double-processing a payment. That's
 * real, valuable data (every succeeded/failed/refunded event, with amount
 * and currency) that nothing has ever read back. First reader.
 */
export function TransactionsPanel({ transactions, timeZone }: { transactions: TransactionRow[]; timeZone: string }) {
  if (transactions.length === 0) return null;

  // The centre's zone. formatDateTime would force a year in, which this
  // list does not want, so the zone goes in explicitly instead -- the rule
  // is that it is never left to the runtime, not that it is always a helper.
  const when = (iso: string) =>
    new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone });

  return (
    <div className="card">
      <div className="border-b border-border px-5 py-4">
        <h2 className="font-serif text-h3 font-semibold text-ink">Recent provider activity</h2>
        <p className="mt-0.5 text-label text-muted">Every Stripe event received, most recent first.</p>
      </div>
      <ul className="flex flex-col">
        {transactions.map((t) => (
          <li key={t.id} className="hover-ring flex items-center justify-between gap-3 px-5 py-4 border-b border-border-faint last:border-none">
            <div>
              <span className={`status-pill ${EVENT_PILL_CLASS[t.eventType]}`}>{EVENT_LABEL[t.eventType]}</span>
              <p className="mt-1 text-label text-muted">{when(t.receivedAt)}</p>
            </div>
            <p className="shrink-0 text-body text-ink">{t.amount != null && t.currency ? formatCurrency(t.amount, t.currency) : "--"}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
