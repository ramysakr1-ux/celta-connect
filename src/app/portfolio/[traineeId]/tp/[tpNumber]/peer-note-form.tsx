"use client";

import { useActionState } from "react";
import { savePeerNote, type PeerNoteFormState } from "@/app/portfolio/[traineeId]/tp/[tpNumber]/peer-observation-actions";

const initialState: PeerNoteFormState = { error: null };

export function PeerNoteForm({
  traineeId,
  tpNumber,
  prompt1,
  prompt2,
  initialNote1,
  initialNote2,
}: {
  traineeId: string;
  tpNumber: number;
  prompt1: string;
  prompt2: string;
  initialNote1: string;
  initialNote2: string;
}) {
  const [state, action, pending] = useActionState(savePeerNote, initialState);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="trainee_id" value={traineeId} />
      <input type="hidden" name="tp_number" value={tpNumber} />
      <div className="flex flex-col gap-1">
        <label className="text-sm text-muted">{prompt1}</label>
        <input
          name="note_1"
          type="text"
          maxLength={140}
          defaultValue={initialNote1}
          placeholder="One line -- a jotting, not an essay"
          className="rounded-[6px] border border-input bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm text-muted">{prompt2}</label>
        <input
          name="note_2"
          type="text"
          maxLength={140}
          defaultValue={initialNote2}
          placeholder="One line"
          className="rounded-[6px] border border-input bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
        />
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-card disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save note"}
      </button>
      <p className="text-xs text-muted">Private until your trainer reveals it -- you can change it anytime before then.</p>
    </form>
  );
}
