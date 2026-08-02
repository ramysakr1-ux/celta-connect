"use client";

import { useActionState } from "react";
import {
  requestPasswordReset,
  type ForgotPasswordState,
} from "@/app/forgot-password/actions";

const initialState: ForgotPasswordState = { error: null, sent: false };

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, initialState);

  if (state.sent) {
    return (
      <p className="mt-4 text-sm text-ink">
        If that email has an account, a reset link is on its way. Check your inbox (and spam).
      </p>
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
