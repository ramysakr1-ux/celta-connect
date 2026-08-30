"use client";

import { useActionState } from "react";
import { declineClass, undoDeclineClass, type DeclineState } from "@/app/student/[token]/decline-actions";

const initialState: DeclineState = { error: null };

export function DeclineButton({ token, eventId, alreadyDeclined }: { token: string; eventId: string; alreadyDeclined: boolean }) {
  const [state, formAction, pending] = useActionState(declineClass, initialState);
  const [undoState, undoAction, undoPending] = useActionState(undoDeclineClass, initialState);

  // Whichever action ran last wins, so the row can be toggled both ways in
  // one visit rather than needing a reload between them.
  const declined = undoState.declined === false ? false : (state.declined ?? alreadyDeclined);

  if (declined) {
    return (
      <div className="flex flex-wrap items-center gap-2.5">
        <p className="text-xs font-medium text-muted">You&apos;ve let them know you can&apos;t make it.</p>
        <form action={undoAction}>
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="event_id" value={eventId} />
          <button
            type="submit"
            disabled={undoPending}
            className="volunteer-hover-fill h-8 rounded-full border border-border px-3.5 text-xs font-semibold text-ink disabled:opacity-60"
          >
            {undoPending ? "Sending…" : "Actually, I can come"}
          </button>
        </form>
        {undoState.error ? <p className="text-xs text-destructive">{undoState.error}</p> : null}
      </div>
    );
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
          className="volunteer-hover-fill h-8 rounded-full border border-border px-3.5 text-xs font-semibold text-ink disabled:opacity-60"
        >
          {pending ? "Sending…" : "Let them know"}
        </button>
      </form>
      {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
    </div>
  );
}
