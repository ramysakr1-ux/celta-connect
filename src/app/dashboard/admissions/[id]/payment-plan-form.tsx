"use client";

import { useActionState } from "react";
import { createPaymentPlan, type PaymentFormState } from "@/lib/payments/actions";

const initialState: PaymentFormState = { error: null };
const inputClass = "rounded-[6px] border border-border bg-card-inset px-3 py-1.5 text-sm text-ink outline-none focus:border-primary";

// "A payment can be split into a plan... at setup." Shown when an
// applicant has no payment_plans row yet -- equal instalments 30 days
// apart from the chosen first due date (see createPaymentPlan for why).
export function PaymentPlanForm({
  applicantId,
  defaultAmount,
  defaultCurrency,
}: {
  applicantId: string;
  defaultAmount: number | null;
  defaultCurrency: string | null;
}) {
  const [state, action, pending] = useActionState(createPaymentPlan, initialState);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="applicant_id" value={applicantId} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="total_amount" className="text-xs text-muted">
            Total amount
          </label>
          <input
            id="total_amount"
            name="total_amount"
            type="number"
            min="0.01"
            step="0.01"
            required
            defaultValue={defaultAmount ?? undefined}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="currency" className="text-xs text-muted">
            Currency
          </label>
          <input
            id="currency"
            name="currency"
            type="text"
            required
            maxLength={3}
            placeholder="GBP"
            defaultValue={defaultCurrency ?? ""}
            className={`${inputClass} w-20 uppercase`}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="instalment_count" className="text-xs text-muted">
            Instalments
          </label>
          <input
            id="instalment_count"
            name="instalment_count"
            type="number"
            min="1"
            max="12"
            required
            defaultValue={1}
            className={`${inputClass} w-20`}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="first_due_date" className="text-xs text-muted">
            First due date
          </label>
          <input id="first_due_date" name="first_due_date" type="date" required className={inputClass} />
        </div>
      </div>
      <p className="text-xs text-muted">
        Equal instalments, 30 days apart from the first due date. Each can be paid online (Stripe) or marked paid
        manually once money arrives another way.
      </p>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-card disabled:opacity-60"
      >
        {pending ? "Creating..." : "Create payment plan"}
      </button>
    </form>
  );
}
