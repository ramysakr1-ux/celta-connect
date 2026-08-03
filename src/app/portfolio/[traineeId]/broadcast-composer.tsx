"use client";

import { useActionState } from "react";
import { postBroadcast, type FormState } from "@/app/portfolio/[traineeId]/stream-actions";

const initialState: FormState = { error: null };

export function BroadcastComposer({ traineeId }: { traineeId: string }) {
  const action = postBroadcast.bind(null, traineeId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="sheet flex flex-col gap-3">
      <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
        Broadcast to cohort
      </p>
      <input
        name="title"
        type="text"
        placeholder="Title"
        required
        className="h-10 rounded-[6px] border border-input bg-card px-3 text-sm text-ink outline-none focus:border-primary"
      />
      <textarea
        name="body"
        placeholder="Write your announcement…"
        rows={3}
        className="rounded-[6px] border border-input bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          name="zoom_url"
          type="url"
          placeholder="Zoom link (optional)"
          className="h-10 rounded-[6px] border border-input bg-card px-3 text-sm text-ink outline-none focus:border-primary"
        />
        <input
          name="zoom_time"
          type="datetime-local"
          className="h-10 rounded-[6px] border border-input bg-card px-3 text-sm text-ink outline-none focus:border-primary"
        />
        <input
          name="attachment_name"
          type="text"
          placeholder="Attachment name (optional)"
          className="h-10 rounded-[6px] border border-input bg-card px-3 text-sm text-ink outline-none focus:border-primary"
        />
        <input
          name="attachment_url"
          type="url"
          placeholder="Attachment link (optional)"
          className="h-10 rounded-[6px] border border-input bg-card px-3 text-sm text-ink outline-none focus:border-primary"
        />
      </div>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" name="pinned" />
          Pin to top
        </label>
        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="rounded-[6px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {pending ? "Posting…" : "Post announcement"}
        </button>
      </div>
    </form>
  );
}
