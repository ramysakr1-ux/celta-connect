"use client";

import { useActionState } from "react";
import { acknowledgeFormalLetter, type AcknowledgeLetterState } from "@/app/portfolio/[traineeId]/letters-actions";

const initialState: AcknowledgeLetterState = { error: null };

export function AcknowledgeButton({ letterId }: { letterId: string }) {
  const [state, action, pending] = useActionState(acknowledgeFormalLetter, initialState);

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="letter_id" value={letterId} />
      <p className="text-sm text-muted">Confirm you&apos;ve read this letter.</p>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-[6px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Saving…" : "I've read this"}
      </button>
    </form>
  );
}
