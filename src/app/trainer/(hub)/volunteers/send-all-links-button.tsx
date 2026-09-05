"use client";

import { HUB_BUTTON } from "@/app/trainer/(hub)/page-head";

import { useActionState } from "react";
import { sendAllVolunteerStartingEmails, type SendAllLinksState } from "@/app/trainer/(hub)/volunteers/actions";

const initialState: SendAllLinksState = { error: null, sentCount: null };

export function SendAllLinksButton() {
  const [state, action, pending] = useActionState(sendAllVolunteerStartingEmails, initialState);

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <button
        type="submit"
        disabled={pending}
        title="Sends the class-starting email with their own join link to every volunteer with an email on file"
        className={`${HUB_BUTTON} disabled:opacity-60`}
      >
        {pending ? "Sending…" : state.sentCount !== null ? `Emailed ${state.sentCount}` : "Email all links"}
      </button>
      {state.error ? <p className="text-[11px] text-destructive">{state.error}</p> : null}
    </form>
  );
}
