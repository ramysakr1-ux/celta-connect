"use client";

import { useActionState } from "react";
import { claimInterviewSlot, type ClaimSlotState } from "@/app/interview/[token]/actions";
import type { PickerTimeOption } from "@/lib/interview-slot-picker";

const initialState: ClaimSlotState = { error: null };

function formatWhen(option: PickerTimeOption): string {
  const when = new Date(`${option.slotDate}T${option.slotTime}`).toLocaleString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${when} (${option.mode === "online" ? "online" : "in person"})`;
}

// "Taken and past slots stay visible, greyed out and marked 'Booked'
// rather than disappearing -- the applicant sees the full picture."
export function SlotPicker({ token, options }: { token: string; options: PickerTimeOption[] }) {
  const [state, action, pending] = useActionState(claimInterviewSlot, initialState);

  return (
    <div className="mt-4 flex flex-col gap-2">
      {options.map((option) => (
        <form key={option.timeKey} action={action}>
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="time_key" value={option.timeKey} />
          <button
            type="submit"
            disabled={!option.bookable || pending}
            className={
              option.bookable
                ? "flex w-full items-center justify-between rounded-[6px] border border-border bg-card px-4 py-3 text-left text-sm text-ink hover:border-primary disabled:opacity-60"
                : "flex w-full items-center justify-between rounded-[6px] border border-border-faint bg-surface-muted/40 px-4 py-3 text-left text-sm text-muted"
            }
          >
            <span>{formatWhen(option)}</span>
            {!option.bookable ? <span className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">Booked</span> : null}
          </button>
        </form>
      ))}
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
    </div>
  );
}
