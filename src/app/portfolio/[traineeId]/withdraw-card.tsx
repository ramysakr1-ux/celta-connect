"use client";

import { useActionState, useState } from "react";
import { withdrawTrainee, grantExtension, type WithdrawFormState, type ExtensionFormState } from "@/app/portfolio/[traineeId]/status-actions";

const initialWithdrawState: WithdrawFormState = { error: null };
const initialExtensionState: ExtensionFormState = { error: null };

type Mode = "none" | "withdraw" | "extension";

export function CandidateStatusCard({ traineeId, specialConsideration }: { traineeId: string; specialConsideration: string | null }) {
  const [mode, setMode] = useState<Mode>("none");
  const [withdrawState, withdrawAction, withdrawPending] = useActionState(withdrawTrainee, initialWithdrawState);
  const [extensionState, extensionAction, extensionPending] = useActionState(grantExtension, initialExtensionState);

  return (
    <div className="sheet-accent h-fit">
      <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Candidate status</p>

      {mode === "none" ? (
        <div className="mt-3 flex flex-col gap-1.5">
          <button type="button" onClick={() => setMode("withdraw")} className="text-left text-sm font-medium text-destructive hover:underline">
            Withdraw candidate…
          </button>
          <button type="button" onClick={() => setMode("extension")} className="text-left text-sm font-medium text-primary hover:underline">
            Grant an extension…
          </button>
        </div>
      ) : null}

      {mode === "withdraw" ? (
        <form action={withdrawAction} className="mt-3 flex flex-col gap-2.5">
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
          {withdrawState.error ? <p className="text-xs text-destructive">{withdrawState.error}</p> : null}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={withdrawPending}
              className="rounded-[6px] bg-destructive px-3 py-1.5 text-xs font-semibold text-card disabled:opacity-60"
            >
              {withdrawPending ? "Withdrawing…" : "Confirm withdrawal"}
            </button>
            <button type="button" onClick={() => setMode("none")} className="text-xs text-muted hover:underline">
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {mode === "extension" ? (
        <form action={extensionAction} className="mt-3 flex flex-col gap-2.5">
          <input type="hidden" name="trainee_id" value={traineeId} />
          <p className="text-xs text-muted">
            For special consideration. The portfolio stays fully active &mdash; this only flags that
            they&apos;ll complete after the official end date, and close-out should wait for them.
          </p>
          {specialConsideration ? (
            <p className="text-xs text-ink">
              Special consideration on file: <span className="italic">&ldquo;{specialConsideration}&rdquo;</span>
            </p>
          ) : (
            <p className="text-xs text-status-warning-text">No special consideration is on file for this candidate yet.</p>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">Expected completion date</label>
            <input
              type="date"
              name="completes_by"
              className="rounded-[6px] border border-input bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
            />
          </div>
          <textarea
            name="note"
            rows={2}
            placeholder="Reason / note (optional)"
            className="rounded-[6px] border border-input bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
          />
          {extensionState.error ? <p className="text-xs text-destructive">{extensionState.error}</p> : null}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={extensionPending}
              className="rounded-[6px] bg-primary px-3 py-1.5 text-xs font-semibold text-card disabled:opacity-60"
            >
              {extensionPending ? "Saving…" : "Grant extension"}
            </button>
            <button type="button" onClick={() => setMode("none")} className="text-xs text-muted hover:underline">
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
