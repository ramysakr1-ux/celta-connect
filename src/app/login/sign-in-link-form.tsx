"use client";

import { useActionState, useState } from "react";
import { sendSignInLink, type SignInLinkState } from "@/app/login/actions";

const initialState: SignInLinkState = { error: null, sent: false };

// "Fully automatic server-side... nothing for a human to operate." A
// password-free alternative to the main sign-in form, for anyone who's
// forgotten their password but doesn't want the full reset flow.
//
// `dismissed` is local UI state tracking whether the user has clicked "Send
// again" since the last completed action -- useActionState's state has no
// way to be reset except by dispatching the action again, so we derive
// `confirmed` from state.sent and dismissed during render (comparing state
// by reference to detect a fresh action result) rather than syncing via
// an effect.
export function SignInLinkForm() {
  const [state, action, pending] = useActionState(sendSignInLink, initialState);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [prevState, setPrevState] = useState(state);
  // Echoed back in the confirmation so a typo'd address is obvious before the
  // user sits waiting for mail that will never arrive.
  const [email, setEmail] = useState("");

  if (state !== prevState) {
    setPrevState(state);
    if (state.sent) setDismissed(false);
  }

  const confirmed = state.sent && !dismissed;

  if (confirmed) {
    return (
      <div className="sheet-accent-alert">
        <p className="text-sm text-ink">
          We&apos;ve sent a sign-in link to {email}. Click it to sign in -- no password needed. The link expires in 15
          minutes and works once.
        </p>
        <button type="button" onClick={() => setDismissed(true)} className="mt-2 text-xs text-primary hover:underline">
          Send again
        </button>
      </div>
    );
  }

  // A real secondary button rather than a text link -- login-form.tsx puts an
  // "OR" rule directly above this, which needs something with weight under it.
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-[6px] border border-border bg-card px-4 py-2 text-sm font-semibold text-ink hover:border-primary"
      >
        Email me a sign-in link
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
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="h-10 rounded-[6px] border border-input bg-card px-3 text-sm text-ink outline-none focus:border-primary"
      />
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-[6px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
      >
        {pending ? "Sending..." : "Send sign-in link"}
      </button>
    </form>
  );
}
