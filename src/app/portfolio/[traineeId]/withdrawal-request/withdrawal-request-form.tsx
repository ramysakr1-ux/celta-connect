"use client";

import { useActionState, useState } from "react";
import {
  submitWithdrawalRequest,
  WITHDRAWAL_REASON_TAGS,
  WITHDRAW_CONFIRMATIONS,
  DEFER_CONFIRMATIONS,
  type WithdrawalRequestFormState,
} from "@/app/portfolio/[traineeId]/withdrawal-request-actions";
import { SetSignatureForm } from "@/components/set-signature-form";

const initialState: WithdrawalRequestFormState = { error: null };

type Kind = "withdraw" | "defer";

export function WithdrawalRequestForm({
  traineeId,
  fullName,
  signatureName,
}: {
  traineeId: string;
  fullName: string;
  signatureName: string | null;
}) {
  const [state, formAction, pending] = useActionState(submitWithdrawalRequest, initialState);
  const [kind, setKind] = useState<Kind>("withdraw");
  const [reasonTag, setReasonTag] = useState<string>(WITHDRAWAL_REASON_TAGS[0]);
  const [stillAttending, setStillAttending] = useState<"yes" | "no">("yes");
  const confirmations = kind === "withdraw" ? WITHDRAW_CONFIRMATIONS : DEFER_CONFIRMATIONS;
  const [checked, setChecked] = useState<boolean[]>(() => confirmations.map(() => false));

  if (state.sent) {
    return (
      <div className="rounded-[6px] border border-border-faint bg-surface-muted/40 p-4">
        <p className="text-sm font-semibold text-primary">Sent -- waiting for the centre.</p>
        <p className="mt-1 text-sm text-muted">A tutor will act on this and follow up with you.</p>
      </div>
    );
  }

  function pickKind(next: Kind) {
    setKind(next);
    setChecked((next === "withdraw" ? WITHDRAW_CONFIRMATIONS : DEFER_CONFIRMATIONS).map(() => false));
  }

  const allConfirmed = checked.every(Boolean);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="trainee_id" value={traineeId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="reason_tag" value={reasonTag} />

      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted">What are you asking for?</p>
        <div className="flex flex-col gap-2">
          <label
            className={`flex cursor-pointer flex-col gap-1 rounded-[6px] border p-3 ${
              kind === "withdraw" ? "border-status-warning-text bg-status-warning-bg" : "border-border"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <input type="radio" checked={kind === "withdraw"} onChange={() => pickKind("withdraw")} className="mt-0.5" />
              <span className="text-sm font-semibold text-ink">Withdraw from the course</span>
            </span>
            <span className="pl-6 text-xs text-muted">You are leaving and will not complete this course. This cannot be undone.</span>
          </label>
          <label
            className={`flex cursor-pointer flex-col gap-1 rounded-[6px] border p-3 ${
              kind === "defer" ? "border-primary bg-primary/5" : "border-border"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <input type="radio" checked={kind === "defer"} onChange={() => pickKind("defer")} className="mt-0.5" />
              <span className="text-sm font-semibold text-ink">Request a deferral</span>
            </span>
            <span className="pl-6 text-xs text-muted">
              You want to stop now and finish on a later course. Subject to the centre agreeing and a place being available.
            </span>
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted">{kind === "withdraw" ? "Your reason for withdrawing" : "Your reason for asking to defer"}</p>
        <div className="flex flex-wrap gap-1.5">
          {WITHDRAWAL_REASON_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setReasonTag(tag)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                reasonTag === tag ? "border-primary bg-primary/10 text-primary" : "border-border text-muted hover:border-primary/40"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="note" className="text-xs text-muted">
            Anything you would like the centre to know
          </label>
          <span className="text-[11px] text-muted">optional</span>
        </div>
        <textarea
          id="note"
          name="note"
          rows={3}
          placeholder={
            kind === "withdraw"
              ? "Write or dictate -- this appears in your letter in your own words…"
              : "When would you hope to return, and is there anything the centre should know…"
          }
          className="rounded-[6px] border border-border bg-card-inset px-3 py-2 text-sm text-ink outline-none focus:border-primary"
        />
        <p className="text-[11px] text-muted italic">
          This is read by the centre only. It does not affect your record, and nothing you write here reaches Cambridge.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="effective_date" className="text-xs text-muted">
          {kind === "withdraw" ? "Last day on the course" : "Last day you will attend"}
        </label>
        <input
          id="effective_date"
          name="effective_date"
          type="date"
          required
          className="h-10 rounded-[6px] border border-border bg-card-inset px-3 text-sm text-ink outline-none focus:border-primary"
        />
      </div>

      {kind === "withdraw" ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted">Would you like to keep attending sessions?</p>
          <input type="hidden" name="still_attending" value={stillAttending} />
          {(
            [
              ["yes", "Yes -- I would like to keep attending as an observer"],
              ["no", "No -- this is my last day"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className={`flex cursor-pointer items-center gap-2.5 rounded-[6px] border p-2.5 ${
                stillAttending === value ? "border-primary bg-primary/5" : "border-border"
              }`}
            >
              <input type="radio" checked={stillAttending === value} onChange={() => setStillAttending(value)} />
              <span className="text-sm text-ink">{label}</span>
            </label>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-2 border-t border-border-faint pt-4">
        <p className="text-[10px] font-semibold tracking-[0.1em] text-muted uppercase">Please confirm</p>
        {confirmations.map((text, i) => (
          <label key={text} className="flex items-start gap-2.5 text-sm text-ink">
            <input
              type="checkbox"
              name="confirmed"
              value={text}
              checked={checked[i] ?? false}
              onChange={(e) =>
                setChecked((prev) => {
                  const next = [...prev];
                  next[i] = e.target.checked;
                  return next;
                })
              }
              className="mt-0.5"
            />
            {text}
          </label>
        ))}
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      {!signatureName ? (
        <SetSignatureForm fullName={fullName} />
      ) : (
        <div className="flex flex-col gap-2 border-t border-border-faint pt-4">
          <input type="hidden" name="signed_name" value={signatureName} />
          <p className="text-xs text-muted">Signed electronically. Your name and the time are recorded on the request.</p>
          <button
            type="submit"
            disabled={pending || !allConfirmed}
            className="self-start rounded-[6px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {pending ? "Sending…" : `Sign as ${signatureName} and send`}
          </button>
          {!allConfirmed ? <p className="text-xs text-muted">Confirm every statement above to sign.</p> : null}
        </div>
      )}
    </form>
  );
}
