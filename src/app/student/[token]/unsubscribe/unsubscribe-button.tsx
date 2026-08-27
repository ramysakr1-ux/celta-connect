"use client";

import { useActionState } from "react";
import { unsubscribeReminders, resubscribeReminders, type UnsubscribeState } from "@/app/student/[token]/unsubscribe-actions";

const initialState: UnsubscribeState = { error: null };

// Ramy, 25 Aug 2026: "if they change their mind later, they can always
// come back to the page and enable notifications" -- this always reflects
// the current state (seeded from the server, then whatever the last action
// returned) and shows whichever direction makes sense next.
export function UnsubscribeButton({ token, initiallyOptedOut }: { token: string; initiallyOptedOut: boolean }) {
  const [unsubState, unsubAction, unsubPending] = useActionState(unsubscribeReminders, initialState);
  const [resubState, resubAction, resubPending] = useActionState(resubscribeReminders, initialState);

  const latest = [unsubState, resubState].reduce((a, b) => (b.done ? b : a), initialState);
  const optedOut = latest.done ? Boolean(latest.optedOut) : initiallyOptedOut;
  const error = unsubState.error ?? resubState.error;

  if (optedOut) {
    return (
      <form action={resubAction} className="mt-5 flex flex-col items-center gap-3">
        <input type="hidden" name="token" value={token} />
        <ReminderStatusTag enabled={false} />
        <button
          type="submit"
          disabled={resubPending}
          className="volunteer-hover-fill h-9 rounded-full border border-border px-4 text-sm font-semibold text-ink disabled:opacity-60"
        >
          {resubPending ? "Saving…" : "Turn reminder emails back on"}
        </button>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </form>
    );
  }

  return (
    <form action={unsubAction} className="mt-5 flex flex-col items-center gap-3">
      <input type="hidden" name="token" value={token} />
      <ReminderStatusTag enabled={true} />
      <button
        type="submit"
        disabled={unsubPending}
        className="volunteer-hover-fill h-9 rounded-full border border-border px-4 text-sm font-semibold text-ink disabled:opacity-60"
      >
        {unsubPending ? "Saving…" : "Yes, stop these emails"}
      </button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </form>
  );
}

// Ramy, 25 Aug 2026: "notification disabled in red... notification enabled
// in green" -- same teal/garnet pair the rest of this page already uses
// for attended/missed status pills, not new literal colours.
function ReminderStatusTag({ enabled }: { enabled: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
      style={{
        background: enabled ? "var(--color-status-on-track-bg)" : "var(--color-status-at-risk-bg)",
        color: enabled ? "var(--color-status-on-track-text)" : "var(--color-status-at-risk-text)",
      }}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {enabled ? "Reminder emails enabled" : "Reminder emails disabled"}
    </span>
  );
}
