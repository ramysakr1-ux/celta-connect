"use client";

import { useActionState } from "react";
import { claimInterviewSlot, type ClaimSlotState } from "@/app/interview/[token]/actions";
import type { PickerTimeOption } from "@/lib/interview-slot-picker";
import { interviewWhenCompact } from "@/lib/interview-time";

const initialState: ClaimSlotState = { error: null };

// "Taken and past slots stay visible, greyed out and marked 'Booked'
// rather than disappearing -- the applicant sees the full picture."
//
// Each time is said the way the confirmation page and the emails say it:
// in the applicant's own zone first, then the centre's, when they differ.
// Until 12 Sep 2026 this built a Date from the centre's wall-clock string
// in the applicant's browser and named no zone at all, so someone in Lima
// read "10:00" for a 10:00 Istanbul interview and only found out which
// 10:00 it was after booking.
export function SlotPicker({
  token,
  options,
  centreTimeZone,
  applicantTimeZone,
  centreCity,
}: {
  token: string;
  options: PickerTimeOption[];
  centreTimeZone: string | null;
  applicantTimeZone: string | null;
  /** "Istanbul" -- the city, since the zone name is what the reader needs, not the centre's full name. */
  centreCity?: string;
}) {
  const [state, action, pending] = useActionState(claimInterviewSlot, initialState);
  const formatWhen = (option: PickerTimeOption) =>
    `${interviewWhenCompact({ slot: { slotDate: option.slotDate, slotTime: option.slotTime }, centreTimeZone, applicantTimeZone, centreCity })} (${
      option.mode === "online" ? "online" : "face to face"
    })`;

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
