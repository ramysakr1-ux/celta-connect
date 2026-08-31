"use client";

import { useActionState, useState } from "react";
import { setAssignmentFailOverride, type FormState } from "@/app/dashboard/trainer/celta5-actions";

const initialState: FormState = { error: null };

// The manual override on a failed written assignment's consequences.
//
// Ramy, 31 Aug 2026: "everything should be potentially subject to manual
// override", with the exception of what is "hardcore built into the system."
// A failed assignment is not that -- it caps a grade and calls a Stage Three,
// both of which a grades meeting is entitled to look at again.
//
// Deliberately not a switch. It is a reason box that happens to also lift the
// ceiling, because the reason is the part that matters: this record is read by
// an assessor months later, and "overridden" on its own tells them nothing.
// Collapsed by default so the honest path -- accept the ceiling -- stays the
// path of least effort, and MCT-only because it is the MCT who runs the
// grades meeting.
export function AssignmentFailOverride({
  traineeId,
  overrideReason,
  overriddenByName,
}: {
  traineeId: string;
  overrideReason: string | null;
  overriddenByName: string | null;
}) {
  const [state, action, pending] = useActionState(setAssignmentFailOverride, initialState);
  const [open, setOpen] = useState(false);

  if (overrideReason) {
    return (
      <div className="flex flex-col gap-1.5 rounded-[6px] border border-border-faint bg-surface-muted/40 px-3 py-2">
        <p className="text-[11px] font-bold tracking-[0.1em] text-muted uppercase">Ceiling overridden</p>
        <p className="text-[11.5px] leading-relaxed text-ink">{overrideReason}</p>
        {overriddenByName ? <p className="text-[11px] text-muted">Recorded by {overriddenByName}</p> : null}
        <form action={action} className="self-start">
          <input type="hidden" name="trainee_id" value={traineeId} />
          <input type="hidden" name="clear" value="1" />
          <button type="submit" disabled={pending} className="text-[11px] text-primary hover:underline disabled:opacity-60">
            {pending ? "Removing..." : "Remove override"}
          </button>
        </form>
        {state.error ? <p className="text-[11.5px] text-destructive">{state.error}</p> : null}
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="self-start text-[11px] text-muted hover:text-primary hover:underline">
        Override this at the grades meeting
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-1.5 rounded-[6px] border border-border-faint px-3 py-2">
      <input type="hidden" name="trainee_id" value={traineeId} />
      <label htmlFor={`override-${traineeId}`} className="text-[11px] font-bold tracking-[0.1em] text-muted uppercase">
        Why is the ceiling being set aside?
      </label>
      <textarea
        id={`override-${traineeId}`}
        name="reason"
        rows={2}
        required
        minLength={10}
        placeholder="The assessor will read this. Say what the grades meeting decided and why."
        className="rounded-[6px] border border-border bg-card-inset px-2.5 py-1.5 text-[12.5px] text-ink outline-none focus:border-primary"
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-[6px] border border-border px-3 py-1 text-[12.5px] text-ink trainer-hover-fill disabled:opacity-60"
        >
          {pending ? "Saving..." : "Record override"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-[11px] text-muted hover:underline">
          Cancel
        </button>
      </div>
      {state.error ? <p className="text-[11.5px] text-destructive">{state.error}</p> : null}
    </form>
  );
}
