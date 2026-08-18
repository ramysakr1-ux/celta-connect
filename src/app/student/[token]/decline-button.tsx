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
    <form action={formAction}>
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="event_id" value={eventId} />
      <button type="submit" disabled={pending} className="text-xs font-medium text-primary hover:underline disabled:opacity-60">
        {pending ? "Sending…" : "Can't make it? → Let them know"}
      </button>
      {state.error ? <p className="mt-1 text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}
