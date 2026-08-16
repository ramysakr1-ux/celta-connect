"use client";

import { useActionState } from "react";
import { recordDeposit } from "@/app/dashboard/admissions/actions";
import type { FormState } from "@/app/dashboard/admissions/actions";

const initial: FormState = { error: null };

/**
 * The deposit is what lets a centre invite someone before the balance is
 * settled, so this sits next to the offer controls rather than buried in the
 * payments panel.
 *
 * Worded as a record of what a person observed -- deposits usually arrive by
 * bank transfer, and Connect never sees the money.
 */
export function DepositForm({
  applicantId,
  depositAmount,
  depositCurrency,
  depositPaidAt,
  markedByName,
  note,
}: {
  applicantId: string;
  depositAmount: number | null;
  depositCurrency: string | null;
  depositPaidAt: string | null;
  markedByName: string | null;
  note: string | null;
}) {
  const [state, action, pending] = useActionState(recordDeposit, initial);

  if (depositPaidAt) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-ink">
          Deposit of{" "}
          <span className="font-semibold">
            {depositCurrency ?? ""}
            {depositAmount}
          </span>{" "}
          recorded {new Date(depositPaidAt).toLocaleDateString("en-GB")}
          {markedByName ? ` by ${markedByName}` : ""}.
        </p>
        {note ? <p className="text-xs text-muted">{note}</p> : null}
        <form action={action}>
          <input type="hidden" name="applicant_id" value={applicantId} />
          <input type="hidden" name="clear" value="1" />
          <button type="submit" disabled={pending} className="text-xs text-muted hover:text-destructive disabled:opacity-60">
            {pending ? "Clearing..." : "Clear this record"}
          </button>
        </form>
        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="applicant_id" value={applicantId} />
      <p className="text-xs text-muted">
        Record a deposit you&apos;ve received. Connect never handles the money -- this is your record that it arrived.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Amount</span>
          <input
            name="deposit_amount"
            type="number"
            min="1"
            step="0.01"
            required
            className="h-9 w-28 rounded-[6px] border border-input bg-card px-2 text-sm text-ink outline-none focus:border-primary"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Currency</span>
          <input
            name="deposit_currency"
            type="text"
            maxLength={3}
            placeholder="GBP"
            className="h-9 w-20 rounded-[6px] border border-input bg-card px-2 text-sm text-ink uppercase outline-none focus:border-primary"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs text-muted">Note (optional)</span>
          <input
            name="deposit_note"
            type="text"
            placeholder="Bank transfer, ref 4471"
            className="h-9 w-full rounded-[6px] border border-input bg-card px-2 text-sm text-ink outline-none focus:border-primary"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="h-9 rounded-[6px] bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {pending ? "Recording..." : "Record deposit"}
        </button>
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
    </form>
  );
}
