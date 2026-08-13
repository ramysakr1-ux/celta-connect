"use client";

import { useActionState, useState } from "react";
import { withdrawTrainee, type WithdrawFormState } from "@/app/portfolio/[traineeId]/status-actions";

const initialState: WithdrawFormState = { error: null };

export function WithdrawCard({ traineeId }: { traineeId: string }) {
  const [state, action, pending] = useActionState(withdrawTrainee, initialState);
  const [open, setOpen] = useState(false);

  return (
    <div className="sheet-accent h-fit">
      <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Candidate status</p>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 text-sm font-medium text-destructive hover:underline"
        >
          Withdraw candidate…
        </button>
      ) : (
        <form action={action} className="mt-3 flex flex-col gap-2.5">
          <input type="hidden" name="trainee_id" value={traineeId} />
          <p className="text-xs text-muted">
            Formal and final &mdash; there is no reversal. Their portfolio becomes read-only but is
            kept, not erased, and their next Teaching Practice slot is simply left empty.
          </p>
          <textarea
            name="note"
            rows={2}
            placeholder="Reason (optional, kept on the record)"
            className="rounded-[6px] border border-input bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
          />
          {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-[6px] bg-destructive px-3 py-1.5 text-xs font-semibold text-card disabled:opacity-60"
            >
              {pending ? "Withdrawing…" : "Confirm withdrawal"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs text-muted hover:underline"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
