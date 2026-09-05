"use client";

import { useActionState } from "react";
import { bookConsultationSlot, type BookState } from "@/app/trainer/(hub)/timetable/consultation-actions";

const initialState: BookState = { error: null };

// The candidate's booking control. "About which assignment?" is optional:
// it is how build-spec.md rule 15 is judged (any tutor before that
// assignment's first submission, own tutor only after). Left blank, the
// rule is judged against whether anything has been submitted at all.
export function BookConsultationButton({ blockId, assignments, ownTutor }: { blockId: string; assignments: string[]; ownTutor: boolean }) {
  const [state, formAction, pending] = useActionState(bookConsultationSlot, initialState);

  return (
    <form action={formAction} className="sheet flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-ink">Claim the next open position.</p>
        <p className="text-xs text-muted">
          {ownTutor
            ? "This is your own tutor's sheet, so any assignment is fine."
            : "Before an assignment's first submission you may book any tutor; after it, only your own tutor for that assignment."}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="block_id" value={blockId} />
        <select name="assignment_type" defaultValue="" aria-label="About which assignment" className="h-9 rounded-[6px] border border-border bg-card px-2.5 text-sm text-ink outline-none focus:border-primary">
          <option value="">General / not about an assignment</option>
          {assignments.map((a) => (
            <option key={a} value={a}>
              About {a}
            </option>
          ))}
        </select>
        <button type="submit" disabled={pending} className="rounded-[6px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
          {pending ? "Booking…" : "Book next open position"}
        </button>
      </div>
      {state.error ? <p className="w-full text-sm text-destructive">{state.error}</p> : null}
    </form>
  );
}
