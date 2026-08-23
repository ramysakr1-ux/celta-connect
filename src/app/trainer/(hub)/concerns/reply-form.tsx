"use client";

import { useActionState } from "react";
import { replyToConcern, type FormState } from "@/app/trainer/(hub)/concerns/actions";

const initialState: FormState = { error: null };

export function ConcernReplyForm({ concernId }: { concernId: string }) {
  const [state, formAction, pending] = useActionState(replyToConcern, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2 border-t border-border-faint pt-2.5">
      <input type="hidden" name="concern_id" value={concernId} />
      <textarea
        name="response"
        rows={2}
        required
        placeholder="Reply…"
        className="rounded-[6px] border border-border bg-card px-2.5 py-2 text-sm text-ink outline-none focus:border-primary"
      />
      {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-[6px] border border-border px-3 py-1.5 text-xs font-semibold text-ink trainer-hover disabled:opacity-60"
      >
        {pending ? "Sending…" : "Reply"}
      </button>
    </form>
  );
}
