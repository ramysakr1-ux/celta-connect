"use client";

import { useActionState } from "react";
import { saveGroupFeedback, type GroupFeedbackFormState } from "@/app/portfolio/[traineeId]/tp/[tpNumber]/peer-observation-actions";

const initialState: GroupFeedbackFormState = { error: null };

export function GroupFeedbackForm({
  traineeId,
  tpNumber,
  initialFeedback,
}: {
  traineeId: string;
  tpNumber: number;
  initialFeedback: string;
}) {
  const [state, action, pending] = useActionState(saveGroupFeedback, initialState);

  return (
    <form action={action} className="mt-3 flex flex-col gap-2">
      <input type="hidden" name="trainee_id" value={traineeId} />
      <input type="hidden" name="tp_number" value={tpNumber} />
      <textarea
        name="group_feedback"
        rows={3}
        defaultValue={initialFeedback}
        placeholder="What the three of you agreed, reading the notes together"
        className="rounded-[6px] border border-input bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
      />
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-[6px] bg-primary px-3 py-1.5 text-xs font-semibold text-card disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save group feedback"}
      </button>
    </form>
  );
}
