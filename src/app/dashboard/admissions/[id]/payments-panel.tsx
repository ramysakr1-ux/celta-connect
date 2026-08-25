import { markPaymentManual } from "@/lib/payments/actions";
import { PaymentPlanForm } from "@/app/dashboard/admissions/[id]/payment-plan-form";
import { CheckoutLinkButton } from "@/app/dashboard/admissions/[id]/checkout-link-button";
import type { Database } from "@/lib/supabase/types";

type Applicant = Database["public"]["Tables"]["applicants"]["Row"];
type Payment = Database["public"]["Tables"]["payments"]["Row"];

const STATUS_LABEL: Record<Payment["status"], string> = {
  pending: "Pending",
  paid: "Paid",
  missed: "Missed",
  refunded: "Refunded",
};
const STATUS_PILL_CLASS: Record<Payment["status"], string> = {
  pending: "status-pill-pending",
  paid: "status-pill-on-track",
  missed: "status-pill-at-risk",
  refunded: "status-pill-pending",
};

// "Both sources coexist in one list -- a centre doesn't have to pick one
// method for everyone." Replaces the old single fee_paid boolean
// (FeeTrackingForm) with the instalment-capable payments/payment_plans
// model -- provider-sourced (Stripe webhook) and manually-marked rows
// render side by side, distinguished only by their source badge.
export function PaymentsPanel({ applicant, payments }: { applicant: Applicant; payments: Payment[] }) {
  const sorted = [...payments].sort((a, b) => a.instalment_index - b.instalment_index);
  const total = sorted.reduce((sum, p) => sum + p.amount, 0);
  const paidTotal = sorted.filter((p) => p.status === "paid").reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="card flex flex-col gap-4 p-6">
      <div>
        <h2 className="font-serif text-lg text-ink">Payments</h2>
        {sorted.length > 0 ? (
          <p className="mt-1 text-sm text-muted">
            {paidTotal} of {total} {sorted[0].currency} paid
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted">No payment plan set up yet.</p>
        )}
      </div>

      {sorted.length === 0 ? (
        <PaymentPlanForm applicantId={applicant.id} defaultAmount={applicant.fee_amount} defaultCurrency={applicant.fee_currency} />
      ) : (
        <ul className="flex flex-col gap-3">
          {sorted.map((payment) => (
            <li key={payment.id} className="rounded-[6px] border border-border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-ink">
                    Instalment {payment.instalment_index} of {sorted.length} -- {payment.amount} {payment.currency}
                  </p>
                  <p className="text-xs text-muted">
                    Due {payment.due_date ?? "--"}
                    {payment.source ? ` · ${payment.source === "provider" ? "via Stripe" : "marked manually"}` : ""}
                  </p>
                </div>
                <span className={`status-pill ${STATUS_PILL_CLASS[payment.status]}`}>{STATUS_LABEL[payment.status]}</span>
              </div>

              {payment.status === "paid" ? (
                <div className="mt-2 text-xs text-ink">
                  <p>Paid{payment.paid_at ? ` on ${payment.paid_at.slice(0, 10)}` : ""}.</p>
                  {payment.marked_note ? <p className="mt-0.5 text-muted">{payment.marked_note}</p> : null}
                  {payment.source === "manual" ? (
                    <form action={markPaymentManual} className="mt-1">
                      <input type="hidden" name="payment_id" value={payment.id} />
                      <input type="hidden" name="applicant_id" value={applicant.id} />
                      <input type="hidden" name="paid" value="false" />
                      <button type="submit" className="text-xs text-destructive hover:underline">
                        Undo -- mark unpaid
                      </button>
                    </form>
                  ) : null}
                </div>
              ) : payment.status === "pending" || payment.status === "missed" ? (
                <div className="mt-3 flex flex-col gap-2">
                  {payment.status === "missed" ? (
                    <p className="text-xs text-destructive">Overdue -- flagged as a payment task.</p>
                  ) : null}
                  <div className="flex flex-wrap items-start gap-4">
                    <form action={markPaymentManual} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="payment_id" value={payment.id} />
                      <input type="hidden" name="applicant_id" value={applicant.id} />
                      <input type="hidden" name="paid" value="true" />
                      <input
                        name="marked_note"
                        type="text"
                        placeholder="Reference note (optional)"
                        className="rounded-[6px] border border-border bg-card-inset px-2 py-1.5 text-xs text-ink outline-none focus:border-primary"
                      />
                      <button type="submit" className="rounded-[6px] border border-border px-3 py-1.5 text-xs text-ink hover:border-primary">
                        Mark paid manually
                      </button>
                    </form>
                    <CheckoutLinkButton paymentId={payment.id} applicantId={applicant.id} existingUrl={payment.provider_checkout_url} />
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
