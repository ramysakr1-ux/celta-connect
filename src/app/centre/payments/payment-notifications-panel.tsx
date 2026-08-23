import { markPaymentNotificationRead } from "@/lib/payments/actions";

export interface PaymentNotificationRow {
  id: string;
  message: string;
  createdAt: string;
}

/**
 * runMissedInstalmentsCron (src/lib/payments-cron.ts) has been writing an
 * "instalment overdue" row here on every missed payment -- this is the
 * first screen that reads them back. Dismiss just sets read_at; the
 * underlying payment record (and the refunds/plan views) are untouched,
 * this only stops the notification itself surfacing as outstanding.
 */
export function PaymentNotificationsPanel({ notifications, canEdit }: { notifications: PaymentNotificationRow[]; canEdit: boolean }) {
  if (notifications.length === 0) return null;

  const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  return (
    <div className="rounded-[10px] border border-status-warning-text/40 border-t-[3px] border-t-status-warning-text bg-status-warning-bg">
      <div className="border-b border-status-warning-text/30 px-5 py-3">
        <h2 className="font-serif text-base text-ink">Overdue instalments</h2>
        <p className="mt-0.5 text-xs text-muted">{notifications.length} flagged by the missed-instalment sweep.</p>
      </div>
      <ul className="flex flex-col">
        {notifications.map((n) => (
          <li key={n.id} className="flex items-center justify-between gap-3 border-b border-status-warning-text/20 px-5 py-3 last:border-none">
            <div>
              <p className="text-sm text-ink">{n.message}</p>
              <p className="mt-0.5 text-xs text-muted">{day(n.createdAt)}</p>
            </div>
            {canEdit ? (
              <form action={markPaymentNotificationRead}>
                <input type="hidden" name="notification_id" value={n.id} />
                <button type="submit" className="shrink-0 rounded-[6px] border border-border px-3 py-1.5 text-xs font-medium text-ink hover:border-primary">
                  Dismiss
                </button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
