"use client";

import { useState, useTransition } from "react";
import { cancelTimetableEvent, deleteTimetableEvent } from "@/app/trainer/(hub)/timetable/actions";

// Splits the old single-click, no-confirm delete into two real choices --
// "Cancel" (fires cancelTimetableEvent, pushes the cohort) for a session
// that's genuinely off, vs "Just remove" (the old deleteTimetableEvent,
// silent) for a trainer fixing a typo via delete+re-add, since there's no
// generic edit action. Same two server actions power both grid contexts
// (compact hover-glyph in the week grid, text link in the drag board) --
// only the trigger's own styling differs, via `compact`.
export function DeleteEventButton({ eventId, compact }: { eventId: string; compact: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className={
          compact
            ? "shrink-0 text-[10px] text-muted opacity-0 group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
            : "text-xs text-destructive hover:underline"
        }
      >
        {compact ? "×" : "Delete this event"}
      </button>
    );
  }

  const run = (action: (fd: FormData) => Promise<void>) => {
    const fd = new FormData();
    fd.set("event_id", eventId);
    startTransition(async () => {
      await action(fd);
      setConfirming(false);
    });
  };

  return (
    <div className={compact ? "mt-1 flex flex-col items-start gap-1" : "mt-1 flex flex-col items-start gap-1.5"}>
      <span className="text-[10px] text-muted">Remove, or cancel and notify the cohort?</span>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(cancelTimetableEvent)}
          className="text-[10px] font-semibold text-destructive hover:underline disabled:opacity-50"
        >
          Cancel &amp; notify
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(deleteTimetableEvent)}
          className="text-[10px] text-muted hover:text-ink disabled:opacity-50"
        >
          Just remove
        </button>
        <button type="button" disabled={pending} onClick={() => setConfirming(false)} className="text-[10px] text-muted hover:text-ink">
          Never mind
        </button>
      </div>
    </div>
  );
}
