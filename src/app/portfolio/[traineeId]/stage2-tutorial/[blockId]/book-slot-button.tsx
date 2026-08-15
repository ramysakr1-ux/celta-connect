"use client";

import { useActionState } from "react";
import { bookStage2Slot, type BookState } from "@/app/trainer/(hub)/timetable/stage2-actions";

const initialState: BookState = { error: null };

export function BookSlotButton({ blockId }: { blockId: string }) {
  const [state, formAction, pending] = useActionState(bookStage2Slot, initialState);

  return (
    <form action={formAction} className="sheet flex items-center justify-between gap-3">
      <p className="text-sm text-ink">Claim the next open position.</p>
      <div className="flex items-center gap-3">
        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
        <input type="hidden" name="block_id" value={blockId} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-[6px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {pending ? "Booking…" : "Book next open position"}
        </button>
      </div>
    </form>
  );
}
