"use client";

import { useActionState } from "react";
import { saveConnectHubLink, type FormState } from "@/app/trainer/(hub)/connect-hub/actions";

const initialState: FormState = { error: null };

export function ConnectHubLinkForm({ defaultValue }: { defaultValue: string }) {
  const [state, action, pending] = useActionState(saveConnectHubLink, initialState);

  return (
    <form action={action} className="flex flex-col gap-2">
      <input
        type="url"
        name="connect_hub_link"
        defaultValue={defaultValue}
        placeholder="https://.../?tutor=..."
        required
        className="rounded-[6px] border border-input bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
      />
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save and open"}
      </button>
    </form>
  );
}
