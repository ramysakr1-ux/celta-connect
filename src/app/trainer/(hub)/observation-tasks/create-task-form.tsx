"use client";

import { useActionState } from "react";
import { createObservationTask, type FormState } from "@/app/trainer/(hub)/observation-tasks/actions";

const initialState: FormState = { error: null };

export function CreateTaskForm() {
  const [state, action, pending] = useActionState(createObservationTask, initialState);

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className="text-sm text-muted">
          Title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          placeholder="Observe a lesson focusing on error correction"
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="instructions" className="text-sm text-muted">
          What should candidates watch for?
        </label>
        <textarea
          id="instructions"
          name="instructions"
          rows={3}
          required
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
        />
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-[6px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Assigning..." : "Assign to cohort"}
      </button>
    </form>
  );
}
