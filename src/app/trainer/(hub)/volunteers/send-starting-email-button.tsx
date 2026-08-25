"use client";

import { useActionState } from "react";
import { sendVolunteerStartingEmailNow, type SendStartingEmailState } from "@/app/trainer/(hub)/volunteers/actions";

const initialState: SendStartingEmailState = { error: null, sent: false };

export function SendStartingEmailButton({ volunteerId }: { volunteerId: string }) {
  const [state, action, pending] = useActionState(sendVolunteerStartingEmailNow, initialState);

  return (
    <form action={action}>
      <input type="hidden" name="volunteer_id" value={volunteerId} />
      <button
        type="submit"
        disabled={pending}
        title="Sends the class-starting email with their join link now, regardless of the automatic send timing"
        className="rounded-[6px] border border-border px-3 py-1.5 text-xs text-ink trainer-hover-fill disabled:opacity-60"
      >
        {pending ? "Sending..." : state.sent ? "Sent!" : "Email starting link"}
      </button>
      {state.error ? <p className="mt-1 text-[11px] text-destructive">{state.error}</p> : null}
    </form>
  );
}
