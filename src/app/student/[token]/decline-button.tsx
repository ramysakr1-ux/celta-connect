"use client";

import { useActionState } from "react";
import { declineClass, type DeclineState } from "@/app/student/[token]/decline-actions";

const initialState: DeclineState = { error: null };

export function DeclineButton({ token, eventId, alreadyDeclined }: { token: string; eventId: string; alreadyDeclined: boolean }) {
  const [state, formAction, pending] = useActionState(declineClass, initialState);
  const declined = alreadyDeclined || state.declined;

  if (declined) {
    return <p className="text-xs font-medium text-muted">You&apos;ve let them know you can&apos;t make it.</p>;
  }

  return (
    <div className="flex items-center gap-2.5">
      <span className="text-xs text-muted">Can&apos;t make it?</span>
      <form action={formAction}>
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="event_id" value={eventId} />
        <button
          type="submit"
          disabled={pending}
          className="admin-hover-fill h-8 rounded-full border border-border px-3.5 text-xs font-semibold text-ink disabled:opacity-60"
        >
          {pending ? "Sending…" : "Let them know"}
        </button>
      </form>
      {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
    </div>
  );
}
