"use client";

import { useActionState } from "react";
import { sendOffer, type FormState } from "@/app/dashboard/admissions/actions";
import { currencyChoices } from "@/lib/currency-options";

const initialState: FormState = { error: null };
const inputClass = "rounded-[6px] border border-border bg-card-inset px-3 py-1.5 text-body text-ink outline-none focus:border-primary";

export function OfferForm({
  applicantId,
  hasDeposit,
  hasMarkedTask,
  centreCurrency,
}: {
  applicantId: string;
  hasDeposit: boolean;
  /** A written task is on file AND has been marked -- Handbook §7.2's half of selection. */
  hasMarkedTask: boolean;
  /** The centre's own currency, which the select opens on (remainder pass A4). */
  centreCurrency: string | null;
}) {
  const [state, action, pending] = useActionState(sendOffer, initialState);
  // Both overrides appear together once the server has objected to either:
  // the boxes are checkboxes on the same form, and a box that unmounted
  // between two tries would have its objection come straight back.
  const gateObjected = Boolean(state.error?.startsWith("Before this offer goes out"));
  const choices = currencyChoices(centreCurrency);

  return (
    <form action={action} className="card flex flex-col gap-3 p-5">
      <input type="hidden" name="applicant_id" value={applicantId} />
      <h2 className="font-serif text-h3 font-semibold text-ink">Offer</h2>
      <p className="text-body text-muted">
        States the fee and an accept-by date, records the offer, and emails the applicant automatically.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="fee_amount" className="text-label text-muted">
            Fee amount
          </label>
          <input id="fee_amount" name="fee_amount" type="number" min={0} step="0.01" className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="fee_currency" className="text-label text-muted">
            Currency
          </label>
          {/* Remainder pass A4: was a free-text 3-char box, one slip from
              pricing an offer in "GPB". Opens on the centre's own currency. */}
          <select id="fee_currency" name="fee_currency" defaultValue={choices[0]} className={inputClass}>
            {choices.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="offer_accept_by" className="text-label text-muted">
            Accept by
          </label>
          <input id="offer_accept_by" name="offer_accept_by" type="date" required className={inputClass} />
        </div>
      </div>
      {state.error ? <p className="text-body text-destructive">{state.error}</p> : null}
      {/* Only offered once the server has objected -- there is no point
          pre-emptively asking someone to override a rule they haven't hit. */}
      {!hasDeposit && gateObjected ? (
        <label className="flex items-start gap-2 text-label text-muted">
          <input type="checkbox" name="confirm_no_deposit" value="1" className="mt-0.5 accent-primary" />
          <span>Send this offer without a recorded deposit.</span>
        </label>
      ) : null}
      {!hasMarkedTask && gateObjected ? (
        <label className="flex items-start gap-2 text-label text-muted">
          <input type="checkbox" name="confirm_no_task" value="1" className="mt-0.5 accent-primary" />
          <span>Send this offer without a marked written task on file.</span>
        </label>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-[6px] bg-primary px-4 py-2 text-body font-medium text-card disabled:opacity-60"
      >
        {pending ? "Saving..." : "Record offer"}
      </button>
    </form>
  );
}
