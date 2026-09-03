"use client";

import { useActionState } from "react";
import { rescheduleInterview, type RescheduleState } from "@/app/interview/[token]/actions";

const initial: RescheduleState = { error: null };

// One change, and the page only offers it when there is one left to make --
// the action re-checks all three guards regardless, since a rendered button
// is not authorisation.
export function RescheduleButton({ token }: { token: string }) {
  const [state, action, pending] = useActionState(rescheduleInterview, initial);

  return (
    <form action={action} className="mt-5 flex flex-col gap-2">
      <input type="hidden" name="token" value={token} />
      <button
        type="submit"
        disabled={pending}
        className="trainee-hover-fill w-fit rounded-[6px] border border-border bg-card px-3.5 py-2 text-sm font-medium text-ink disabled:opacity-60"
      >
        {pending ? "Releasing your slot…" : "I need a different time"}
      </button>
      <p className="text-xs text-muted">
        You can move your interview once, up to 24 hours before it. Your current time is released straight away and
        you choose a new one.
      </p>
      {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}
