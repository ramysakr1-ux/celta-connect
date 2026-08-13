"use client";

import { useActionState, useState } from "react";
import {
  withdrawTrainee,
  grantExtension,
  markForRestart,
  markForDeferral,
  type WithdrawFormState,
  type ExtensionFormState,
  type RestartFormState,
  type DeferralFormState,
} from "@/app/portfolio/[traineeId]/status-actions";

const initialWithdrawState: WithdrawFormState = { error: null };
const initialExtensionState: ExtensionFormState = { error: null };
const initialRestartState: RestartFormState = { error: null };
const initialDeferralState: DeferralFormState = { error: null };

type Mode = "none" | "withdraw" | "extension" | "restart" | "deferral";

export function CandidateStatusCard({
  traineeId,
  specialConsideration,
  hoursAttended,
  totalHours,
}: {
  traineeId: string;
  specialConsideration: string | null;
  hoursAttended: number;
  totalHours: number;
}) {
  const [mode, setMode] = useState<Mode>("none");
  const [withdrawState, withdrawAction, withdrawPending] = useActionState(withdrawTrainee, initialWithdrawState);
  const [extensionState, extensionAction, extensionPending] = useActionState(grantExtension, initialExtensionState);
  const [restartState, restartAction, restartPending] = useActionState(markForRestart, initialRestartState);
  const [deferralState, deferralAction, deferralPending] = useActionState(markForDeferral, initialDeferralState);
  const [hoursCarried, setHoursCarried] = useState(hoursAttended);
  const hoursCarriedOverridden = hoursCarried !== hoursAttended;
  const belowHalfway = hoursAttended < totalHours / 2;

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
          <button type="button" onClick={() => setMode("restart")} className="text-left text-sm font-medium text-primary hover:underline">
            Approve a fee-free restart…
          </button>
          <button type="button" onClick={() => setMode("deferral")} className="text-left text-sm font-medium text-primary hover:underline">
            Defer to a later course…
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

      {mode === "restart" ? (
        <form action={restartAction} className="mt-3 flex flex-col gap-2.5">
          <input type="hidden" name="trainee_id" value={traineeId} />
          <p className="text-xs text-muted">
            First-half withdrawal, at the centre&apos;s discretion &mdash; they start a new course from
            the beginning with no new fee. Teaching restarts from TP1; their currently-passed
            assignments are frozen here and carry to whichever course they join next. This is not a
            deferral.
          </p>
          <textarea
            name="note"
            rows={2}
            placeholder="Reason (optional, kept on the record)"
            className="rounded-[6px] border border-input bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
          />
          {restartState.error ? <p className="text-xs text-destructive">{restartState.error}</p> : null}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={restartPending}
              className="rounded-[6px] bg-primary px-3 py-1.5 text-xs font-semibold text-card disabled:opacity-60"
            >
              {restartPending ? "Saving…" : "Approve restart"}
            </button>
            <button type="button" onClick={() => setMode("none")} className="text-xs text-muted hover:underline">
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {mode === "deferral" ? (
        <form action={deferralAction} className="mt-3 flex flex-col gap-2.5">
          <input type="hidden" name="trainee_id" value={traineeId} />
          <p className="text-xs text-muted">
            Only if more than half the course is completed, in exceptional circumstances. Everything
            freezes as it stands &mdash; TPs taught, assignments (even mid-marking), CELTA5 criteria and
            tutorial records &mdash; and carries to whichever course they&apos;re later linked to from
            that course&apos;s admin page.
          </p>
          {belowHalfway ? (
            <p className="text-xs text-status-warning-text">
              {hoursAttended.toFixed(1)} of {totalHours} hours attended &mdash; under half the course.
              Deferral is still the centre&apos;s call, but the Handbook frames it as a &gt;50% case.
            </p>
          ) : null}

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">Reason for the deferral (required)</label>
            <textarea
              name="reasons"
              rows={2}
              required
              placeholder="Full details, for the Appian deferral form"
              className="rounded-[6px] border border-input bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">Re-integration arrangements (optional)</label>
            <textarea
              name="reintegration_arrangements"
              rows={2}
              className="rounded-[6px] border border-input bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">Hours carried (defaults to hours attended)</label>
            <input
              type="number"
              step="0.1"
              name="hours_carried"
              value={hoursCarried}
              onChange={(e) => setHoursCarried(e.target.value === "" ? 0 : Number(e.target.value))}
              className="rounded-[6px] border border-input bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
            />
          </div>
          {hoursCarriedOverridden ? (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted">Note on the changed hours (required)</label>
              <textarea
                name="hours_carried_note"
                rows={2}
                required
                className="rounded-[6px] border border-input bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
              />
            </div>
          ) : null}

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">Re-integration deadline (6 months full-time / 12 part-time is normal)</label>
            <input
              type="date"
              name="reintegration_deadline"
              className="rounded-[6px] border border-input bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
            />
          </div>

          <textarea
            name="note"
            rows={2}
            placeholder="Any other note (optional)"
            className="rounded-[6px] border border-input bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
          />
          {deferralState.error ? <p className="text-xs text-destructive">{deferralState.error}</p> : null}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={deferralPending}
              className="rounded-[6px] bg-primary px-3 py-1.5 text-xs font-semibold text-card disabled:opacity-60"
            >
              {deferralPending ? "Saving…" : "Confirm deferral"}
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
