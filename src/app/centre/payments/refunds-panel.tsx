"use client";

import { useActionState } from "react";
import { agreeRefund, settleRefund } from "@/app/dashboard/admissions/actions";
import type { FormState } from "@/app/dashboard/admissions/actions";

const initial: FormState = { error: null };

export interface RefundRow {
  id: string;
  amount: number;
  currency: string;
  reason: string | null;
  status: "pending" | "completed" | "cancelled";
  settlement: "manual" | "provider";
  agreedAt: string;
  /** Computed on the server -- Date.now() during render is impure, and the
      figure only needs to be right at page load. */
  ageDays: number;
  applicantName: string | null;
}

/**
 * The other half of the "Refunds pending" figure on the Overview.
 *
 * A refund is agreed first and settled second, so a pending row stays visible
 * with the date it was agreed — that age is the useful part. A centre glancing
 * at this should be able to see "agreed three weeks ago, still not sent"
 * without doing arithmetic, which is why the list leads with the date rather
 * than the amount.
 */
export function RefundsPanel({ refunds, canEdit }: { refunds: RefundRow[]; canEdit: boolean }) {
  const [agreeState, agreeAction, agreeing] = useActionState(agreeRefund, initial);
  const [settleState, settleAction, settling] = useActionState(settleRefund, initial);

  const pending = refunds.filter((r) => r.status === "pending");
  const settled = refunds.filter((r) => r.status !== "pending");
  const money = (r: RefundRow) => `${r.currency} ${r.amount.toLocaleString("en-GB")}`;
  const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  return (
    <div className="card card-gold">
      <div className="border-b border-border px-5 py-3">
        <h2 className="font-serif text-base text-ink">Refunds</h2>
        <p className="mt-0.5 text-xs text-muted">
          Agreed and not yet returned. These are the figure on your Overview.
        </p>
      </div>

      {pending.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted">Nothing awaiting payout.</p>
      ) : (
        pending.map((r) => {
          const age = r.ageDays;
          return (
            <div key={r.id} className="admin-hover flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
              <div>
                <p className="text-sm text-ink">
                  {money(r)}
                  {r.applicantName ? ` · ${r.applicantName}` : ""}
                </p>
                <p className="text-xs text-muted">
                  Agreed {day(r.agreedAt)}
                  {age > 0 ? ` · ${age} day${age === 1 ? "" : "s"} ago` : " · today"}
                  {r.settlement === "provider" ? " · awaiting the provider" : " · paid by the centre"}
                  {r.reason ? ` · ${r.reason}` : ""}
                </p>
              </div>
              {canEdit ? (
                <div className="flex shrink-0 items-center gap-3">
                  <form action={settleAction}>
                    <input type="hidden" name="refund_id" value={r.id} />
                    <button
                      type="submit"
                      disabled={settling}
                      className="admin-hover-fill rounded-[6px] bg-ink-warm px-3 py-1.5 text-xs font-semibold text-card disabled:opacity-60"
                    >
                      Mark as sent
                    </button>
                  </form>
                  <form action={settleAction}>
                    <input type="hidden" name="refund_id" value={r.id} />
                    <input type="hidden" name="cancel" value="1" />
                    <button type="submit" disabled={settling} className="text-xs text-muted underline disabled:opacity-60">
                      Cancel
                    </button>
                  </form>
                </div>
              ) : null}
            </div>
          );
        })
      )}

      {canEdit ? (
        <form action={agreeAction} className="flex flex-wrap items-end gap-2 px-5 py-4">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-muted">Amount</label>
            <input
              name="amount"
              type="number"
              step="0.01"
              min="0"
              required
              className="h-9 w-28 rounded-[6px] border border-input bg-card-inset px-2.5 text-sm text-ink outline-none focus:border-primary"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-muted">Currency</label>
            <input
              name="currency"
              type="text"
              required
              maxLength={3}
              placeholder="GBP"
              className="h-9 w-20 rounded-[6px] border border-input bg-card-inset px-2.5 text-sm text-ink uppercase outline-none focus:border-primary"
            />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-[11px] font-medium text-muted">Why</label>
            <input
              name="reason"
              type="text"
              placeholder="Withdrew before the course started"
              className="h-9 w-full rounded-[6px] border border-input bg-card-inset px-2.5 text-sm text-ink outline-none focus:border-primary"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-muted">Settled by</label>
            <select
              name="settlement"
              defaultValue="manual"
              className="h-9 rounded-[6px] border border-input bg-card-inset px-2.5 text-sm text-ink outline-none focus:border-primary"
            >
              <option value="manual">The centre</option>
              <option value="provider">The provider</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={agreeing}
            className="admin-hover-fill h-9 rounded-[6px] bg-ink-warm px-4 text-sm font-semibold text-card disabled:opacity-60"
          >
            {agreeing ? "Recording…" : "Agree a refund"}
          </button>
        </form>
      ) : null}

      {agreeState.error ? <p className="px-5 pb-3 text-sm text-destructive">{agreeState.error}</p> : null}
      {settleState.error ? <p className="px-5 pb-3 text-sm text-destructive">{settleState.error}</p> : null}

      {settled.length > 0 ? (
        <div className="border-t border-border px-5 py-3">
          <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Settled</p>
          {settled.slice(0, 5).map((r) => (
            <p key={r.id} className="mt-1 text-xs text-muted">
              {money(r)}
              {r.applicantName ? ` · ${r.applicantName}` : ""} · {r.status === "completed" ? "sent" : "cancelled"}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
