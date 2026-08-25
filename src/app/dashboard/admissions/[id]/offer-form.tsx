"use client";

import { useActionState } from "react";
import { sendOffer, type FormState } from "@/app/dashboard/admissions/actions";

const initialState: FormState = { error: null };
const inputClass = "rounded-[6px] border border-border bg-card-inset px-3 py-1.5 text-sm text-ink outline-none focus:border-primary";

export function OfferForm({ applicantId, hasDeposit }: { applicantId: string; hasDeposit: boolean }) {
  const [state, action, pending] = useActionState(sendOffer, initialState);

  return (
    <form action={action} className="card flex flex-col gap-3 p-6">
      <input type="hidden" name="applicant_id" value={applicantId} />
      <h2 className="font-serif text-lg text-ink">Offer</h2>
      <p className="text-sm text-muted">
        States the fee and an accept-by date, records the offer, and emails the applicant automatically.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="fee_amount" className="text-xs text-muted">
            Fee amount
          </label>
          <input id="fee_amount" name="fee_amount" type="number" min={0} step="0.01" className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="fee_currency" className="text-xs text-muted">
            Currency
          </label>
          <input id="fee_currency" name="fee_currency" type="text" placeholder="GBP" maxLength={3} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="offer_accept_by" className="text-xs text-muted">
            Accept by
          </label>
          <input id="offer_accept_by" name="offer_accept_by" type="date" required className={inputClass} />
        </div>
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {/* Only offered once the server has objected -- there is no point
          pre-emptively asking someone to override a rule they haven't hit. */}
      {!hasDeposit && state.error?.includes("No deposit") ? (
        <label className="flex items-start gap-2 text-xs text-muted">
          <input type="checkbox" name="confirm_no_deposit" value="1" className="mt-0.5 accent-primary" />
          <span>Send this offer without a recorded deposit.</span>
        </label>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-card disabled:opacity-60"
      >
        {pending ? "Saving..." : "Record offer"}
      </button>
    </form>
  );
}
