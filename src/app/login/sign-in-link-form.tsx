"use client";

import { useActionState, useEffect, useState } from "react";
import { sendSignInLink, type SignInLinkState } from "@/app/login/actions";

const initialState: SignInLinkState = { error: null, sent: false };

// "Fully automatic server-side... nothing for a human to operate." A
// password-free alternative to the main sign-in form, for anyone who's
// forgotten their password but doesn't want the full reset flow.
//
// `confirmed` is local UI state, separate from the action's own `sent`
// flag -- useActionState's state has no way to be reset except by
// dispatching the action again, so "Send again" needs its own local switch
// back to the form rather than trying to un-set state.sent directly.
export function SignInLinkForm() {
  const [state, action, pending] = useActionState(sendSignInLink, initialState);
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (state.sent) setConfirmed(true);
  }, [state.sent]);

  if (confirmed) {
    return (
      <div className="sheet-accent-alert mt-4">
        <p className="text-sm text-ink">Check your email -- a sign-in link is on its way. It expires in 15 minutes and works once.</p>
        <button type="button" onClick={() => setConfirmed(false)} className="mt-2 text-xs text-primary hover:underline">
          Send again
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-center text-sm text-muted hover:text-ink">
        Email me a sign-in link instead
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-2">
      <input
        name="email"
        type="email"
        required
        placeholder="Your email"
        autoComplete="email"
        className="h-10 rounded-[6px] border border-input bg-card px-3 text-sm text-ink outline-none focus:border-primary"
      />
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-[6px] border border-border px-4 py-2 text-sm text-ink hover:border-primary disabled:opacity-60"
      >
        {pending ? "Sending..." : "Send sign-in link"}
      </button>
    </form>
  );
}
