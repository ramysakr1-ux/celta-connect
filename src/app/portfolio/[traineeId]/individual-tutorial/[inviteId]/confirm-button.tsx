"use client";

import { useActionState } from "react";
import { confirmIndividualTutorialInvite, type ConfirmState } from "@/app/trainer/(hub)/timetable/individual-tutorial-actions";

const initialState: ConfirmState = { error: null };

export function ConfirmButton({ inviteId }: { inviteId: string }) {
  const [state, action, pending] = useActionState(confirmIndividualTutorialInvite, initialState);

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="invite_id" value={inviteId} />
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-[6px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Confirming…" : "Confirm this time"}
      </button>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
    </form>
  );
}
