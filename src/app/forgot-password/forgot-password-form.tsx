"use client";

import { useActionState, useState } from "react";
import {
  requestPasswordReset,
  type ForgotPasswordState,
} from "@/app/forgot-password/actions";

const initialState: ForgotPasswordState = { error: null, sent: false };

// `dismissed` tracks whether the user has clicked "Send again" since the
// last completed action -- useActionState's state has no way to be reset
// except by dispatching the action again, so `confirmed` is derived from
// state.sent and dismissed during render (comparing state by reference to
// detect a fresh action result) rather than synced via an effect.
export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, initialState);
  const [dismissed, setDismissed] = useState(false);
  const [prevState, setPrevState] = useState(state);

  if (state !== prevState) {
    setPrevState(state);
    if (state.sent) setDismissed(false);
  }

  const confirmed = state.sent && !dismissed;

  if (confirmed) {
    return (
      <div className="sheet-accent-alert mt-4">
        <p className="text-sm text-ink">
          If an account exists for that address, a reset link is on its way. It expires in 15 minutes and works once.
        </p>
        <button type="button" onClick={() => setDismissed(true)} className="mt-2 text-xs text-primary hover:underline">
          Send again
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="mt-6 flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm text-muted">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="card rounded-[6px] px-3 py-2 text-ink outline-none focus:border-primary"
        />
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-[6px] bg-primary px-4 py-2 font-medium text-card disabled:opacity-60"
      >
        {pending ? "Sending..." : "Send reset link"}
      </button>
    </form>
  );
}
