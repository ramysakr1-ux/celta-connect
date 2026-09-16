import { createClient } from "@/lib/supabase/server";
import { RefundsPanel, type RefundRow } from "@/app/centre/payments/refunds-panel";
import { PaymentNotificationsPanel } from "@/app/centre/payments/payment-notifications-panel";
import { TransactionsPanel } from "@/app/centre/payments/transactions-panel";
import { DEFAULT_TIMEZONE } from "@/lib/timetable-grid";

// The money records behind the providers: notifications a cron wrote, refunds
// agreed, webhook transactions received.
//
// A6 (centre side spec, 16 Sep 2026): these three used to be a page of their
// own at /centre/payments, reached from one "Refund history" link inside this
// tab and from nowhere else, with its own BackLink and a second copy of
// ProviderList above them. One place for money settings, so they moved here
// and the page went.
export async function MoneyPanels({ centerId, canEdit }: { centerId: string; canEdit: boolean }) {
  const supabase = await createClient();

  // Four independent queries, none needing another's result (Ramy, 27 Aug
  // 2026). All scoped to the branch being worked in, not the reader's home
  // branch -- that mismatch showed one branch's refunds under another's
  // providers until it was walked on 15 Sep 2026.
  const [{ data: center }, { data: refunds }, { data: paymentNotifications }, { data: transactions }] = await Promise.all([
    supabase.from("centers").select("time_zone").eq("id", centerId).maybeSingle(),
    supabase
      .from("refunds")
      .select("id, amount, currency, reason, status, settlement, agreed_at, applicant_id")
      // single-centre: a branch's own payment records and notifications
      .eq("center_id", centerId)
      .order("agreed_at", { ascending: false })
      .limit(40),
    // runMissedInstalmentsCron (src/lib/payments-cron.ts) writes one of these
    // on every overdue instalment; this is their only reader.
    supabase
      .from("payment_notifications")
      .select("id, message, created_at")
      // single-centre: a branch's own payment records and notifications
      .eq("center_id", centerId)
      .is("read_at", null)
      .order("created_at", { ascending: false }),
    // payment_provider_transactions logs every webhook event for idempotency
    // (migration 0087); this is its only reader.
    supabase
      .from("payment_provider_transactions")
      .select("id, provider, event_type, amount, currency, received_at")
      // single-centre: a branch's own payment records and notifications
      .eq("center_id", centerId)
      .order("received_at", { ascending: false })
      .limit(30),
  ]);

  // A refund agreed, an instalment missed, a webhook received: all moments,
  // and all of them the centre's. Rendered in the reader's own zone they
  // showed the wrong day to anyone abroad.
  const timeZone = center?.time_zone ?? DEFAULT_TIMEZONE;

  // Names for the rows that have an applicant. A refund can also stand alone
  // (a deposit taken before anyone applied through Connect), so this is a
  // lookup, not a join.
  const refundApplicantIds = [...new Set((refunds ?? []).map((r) => r.applicant_id).filter(Boolean))] as string[];
  const { data: refundApplicants } = refundApplicantIds.length
    ? await supabase.from("applicants").select("id, full_name").in("id", refundApplicantIds)
    : { data: [] };
  const refundName = new Map((refundApplicants ?? []).map((a) => [a.id, a.full_name]));

  const refundRows: RefundRow[] = (refunds ?? []).map((r) => ({
    id: r.id,
    amount: Number(r.amount),
    currency: r.currency,
    reason: r.reason,
    status: r.status,
    settlement: r.settlement,
    agreedAt: r.agreed_at,
    ageDays: Math.floor((Date.now() - new Date(r.agreed_at).getTime()) / 86400000),
    applicantName: r.applicant_id ? (refundName.get(r.applicant_id) ?? null) : null,
  }));

  return (
    <>
      <PaymentNotificationsPanel
        notifications={(paymentNotifications ?? []).map((n) => ({ id: n.id, message: n.message, createdAt: n.created_at }))}
        canEdit={canEdit}
        timeZone={timeZone}
      />
      <RefundsPanel refunds={refundRows} canEdit={canEdit} timeZone={timeZone} />
      <TransactionsPanel
        timeZone={timeZone}
        transactions={(transactions ?? []).map((t) => ({
          id: t.id,
          provider: t.provider,
          eventType: t.event_type,
          amount: t.amount != null ? Number(t.amount) : null,
          currency: t.currency,
          receivedAt: t.received_at,
        }))}
      />
      <p className="text-label leading-relaxed text-muted">
        One currency per course, set by the centre. Card is one of four accepted methods and is never required. Card
        payments show as <span className="text-ink">Confirmed</span> because the provider verified them; every other
        method shows <span className="text-ink">Marked by</span> whoever recorded it.
      </p>
    </>
  );
}
