"use client";

import { useActionState, useTransition } from "react";
import {
  upsertSubscription,
  recordInvoice,
  markInvoicePaid,
  markInvoiceVoid,
  type UpsertSubscriptionState,
  type RecordInvoiceState,
} from "@/app/platform/accounts/actions";

const upsertInitial: UpsertSubscriptionState = {};
const invoiceInitial: RecordInvoiceState = {};

const inputClass = "h-10 rounded-[6px] border border-input bg-card-inset px-3 text-sm text-ink outline-none focus:border-primary";

export function SubscriptionForm({ centres }: { centres: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(upsertSubscription, upsertInitial);

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-1 min-w-[12rem] flex-col gap-1.5">
          <span className="text-sm text-muted">Centre</span>
          <select name="center_id" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              Pick a centre
            </option>
            {centres.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-1 min-w-[10rem] flex-col gap-1.5">
          <span className="text-sm text-muted">Plan</span>
          <input name="plan_name" required placeholder="e.g. Standard" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">Monthly amount</span>
          <input name="monthly_amount" type="number" step="0.01" min="0.01" required className={`${inputClass} w-32`} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">Currency</span>
          <input name="currency" required maxLength={3} placeholder="GBP" className={`${inputClass} w-20 uppercase`} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">Status</span>
          <select name="status" defaultValue="active" className={inputClass}>
            <option value="trial">Trial</option>
            <option value="active">Active</option>
            <option value="past_due">Past due</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">Renewal date</span>
          <input name="renewal_date" type="date" className={inputClass} />
        </label>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">Notes (optional)</span>
        <input name="notes" className={inputClass} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="h-10 self-start rounded-[6px] bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save subscription"}
      </button>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.notice ? <p className="text-sm text-primary">{state.notice}</p> : null}
    </form>
  );
}

export function InvoiceForm({ centres }: { centres: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(recordInvoice, invoiceInitial);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-1 min-w-[12rem] flex-col gap-1.5">
        <span className="text-sm text-muted">Centre</span>
        <select name="center_id" required defaultValue="" className={inputClass}>
          <option value="" disabled>
            Pick a centre
          </option>
          {centres.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">Amount</span>
        <input name="amount" type="number" step="0.01" min="0.01" required className={`${inputClass} w-32`} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">Currency</span>
        <input name="currency" required maxLength={3} placeholder="GBP" className={`${inputClass} w-20 uppercase`} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">Due date</span>
        <input name="due_date" type="date" className={inputClass} />
      </label>
      <label className="flex flex-1 min-w-[10rem] flex-col gap-1.5">
        <span className="text-sm text-muted">Note (optional)</span>
        <input name="note" className={inputClass} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="h-10 rounded-[6px] bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Recording..." : "Record invoice"}
      </button>
      {state.error ? <p className="w-full text-sm text-destructive">{state.error}</p> : null}
      {state.notice ? <p className="w-full text-sm text-primary">{state.notice}</p> : null}
    </form>
  );
}

export function InvoiceRowActions({ invoiceId }: { invoiceId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => markInvoicePaid(invoiceId))}
        className="rounded-[6px] border border-primary/40 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/5 disabled:opacity-60 admin-hover-fill"
      >
        Mark paid
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => markInvoiceVoid(invoiceId))}
        className="rounded-[6px] border border-border-faint px-2.5 py-1 text-xs font-semibold text-muted hover:bg-card disabled:opacity-60 admin-hover-fill"
      >
        Void
      </button>
    </div>
  );
}
