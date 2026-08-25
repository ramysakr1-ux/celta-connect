"use client";

import { useActionState } from "react";
import { unsubscribeReminders, type UnsubscribeState } from "@/app/student/[token]/unsubscribe-actions";

const initialState: UnsubscribeState = { error: null };

export function UnsubscribeButton({ token, alreadyOptedOut }: { token: string; alreadyOptedOut: boolean }) {
  const [state, formAction, pending] = useActionState(unsubscribeReminders, initialState);
  const done = alreadyOptedOut || state.done;

  if (done) {
    return <p className="mt-5 text-sm font-medium text-ink">You&apos;re unsubscribed from reminder emails.</p>;
  }

  return (
    <form action={formAction} className="mt-5 flex flex-col items-center gap-2">
      <input type="hidden" name="token" value={token} />
      <button
        type="submit"
        disabled={pending}
        className="admin-hover-fill h-9 rounded-full border border-border px-4 text-sm font-semibold text-ink disabled:opacity-60"
      >
        {pending ? "Saving…" : "Yes, stop these emails"}
      </button>
      {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}
