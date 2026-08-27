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
export function TransactionsPanel({ transactions }: { transactions: TransactionRow[] }) {
  if (transactions.length === 0) return null;

  const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="card">
      <div className="border-b border-border px-5 py-3">
        <h2 className="font-serif text-base text-ink">Recent provider activity</h2>
        <p className="mt-0.5 text-xs text-muted">Every Stripe event received, most recent first.</p>
      </div>
      <ul className="flex flex-col">
        {transactions.map((t) => (
          <li key={t.id} className="admin-hover flex items-center justify-between gap-3 px-5 py-3 border-b border-border-faint last:border-none">
            <div>
              <span className={`status-pill ${EVENT_PILL_CLASS[t.eventType]}`}>{EVENT_LABEL[t.eventType]}</span>
              <p className="mt-1 text-xs text-muted">{when(t.receivedAt)}</p>
            </div>
            <p className="shrink-0 text-sm text-ink">{t.amount != null && t.currency ? `${t.currency} ${t.amount.toLocaleString("en-GB")}` : "--"}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
