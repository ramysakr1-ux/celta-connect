"use client";

import { useActionState, useRef } from "react";
import { setEventSharesMaterials } from "@/app/trainer/(hub)/timetable/actions";

// One switch per session: whether volunteer students can see what is
// attached. Submits on change -- one field, immediate consequence, the
// same shape as the timetable's other per-event controls. A refused save
// (the shared demo course refuses every write) is said out loud under the
// switch rather than left as a box that springs back.
export function ShareToggle({ eventId, shares }: { eventId: string; shares: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(setEventSharesMaterials, { error: null });
  return (
    <form ref={formRef} action={action} className="flex flex-col gap-1">
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="shares_materials" value={shares ? "false" : "true"} />
      <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={shares}
          disabled={pending}
          onChange={() => formRef.current?.requestSubmit()}
          className="size-4"
          style={{ accentColor: "var(--hub-accent)" }}
        />
        Volunteer students can see materials shared for this session
      </label>
      <p className="text-xs text-muted">
        {shares
          ? "Shown on the volunteer view under this session's title, with whatever you attach below."
          : "Off -- volunteer students do not see this session's materials. Leave it off for logistics like Lunch."}
      </p>
      {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}
