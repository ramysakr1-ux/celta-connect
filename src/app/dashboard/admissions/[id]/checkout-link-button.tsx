"use client";

import { useActionState } from "react";
import { createProviderCheckoutLink, type PaymentFormState } from "@/lib/payments/actions";

const initialState: PaymentFormState = { error: null };

export function CheckoutLinkButton({
  paymentId,
  applicantId,
  existingUrl,
}: {
  paymentId: string;
  applicantId: string;
  existingUrl: string | null;
}) {
  const [state, action, pending] = useActionState(createProviderCheckoutLink, initialState);

  return (
    <form action={action} className="flex flex-col gap-1.5">
      <input type="hidden" name="payment_id" value={paymentId} />
      <input type="hidden" name="applicant_id" value={applicantId} />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-[6px] border border-border px-3 py-1.5 text-xs text-ink hover:border-primary disabled:opacity-60 admin-hover-fill"
        >
          {pending ? "Creating link..." : existingUrl ? "Regenerate payment link" : "Send payment link"}
        </button>
      </div>
      {existingUrl ? (
        <p className="max-w-full truncate text-xs text-muted">
          <a href={existingUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
            {existingUrl}
          </a>
        </p>
      ) : null}
      {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}
