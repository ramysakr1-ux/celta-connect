"use client";

import { useActionState } from "react";
import { saveFilmedObservationTask, type FormState } from "@/app/trainer/(hub)/timetable/filmed-observation-actions";

const initialState: FormState = { error: null };

export function FilmedObservationTaskForm({
  sessionId,
  task,
}: {
  sessionId: string;
  task: {
    criteria_codes: string[];
    prompt_1: string;
    prompt_2: string;
    general_prompt: string;
    rating_label: string;
    rating_options: string[];
  } | null;
}) {
  const [state, action, pending] = useActionState(saveFilmedObservationTask, initialState);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="session_id" value={sessionId} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="criteria_codes" className="text-xs text-muted">
          Criteria (comma-separated, e.g. 4c, 5f)
        </label>
        <input
          id="criteria_codes"
          name="criteria_codes"
          type="text"
          defaultValue={(task?.criteria_codes ?? []).join(", ")}
          className="h-9 rounded-[6px] border border-border bg-card px-2.5 text-sm text-ink outline-none focus:border-primary"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="prompt_1" className="text-xs text-muted">
          Prompt 1 — tied directly to the criterion
        </label>
        <input
          id="prompt_1"
          name="prompt_1"
          type="text"
          required
          defaultValue={task?.prompt_1 ?? ""}
          placeholder="Note two examples of clear instructions."
          className="h-9 rounded-[6px] border border-border bg-card px-2.5 text-sm text-ink outline-none focus:border-primary"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="prompt_2" className="text-xs text-muted">
          Prompt 2 — tied directly to the criterion
        </label>
        <input
          id="prompt_2"
          name="prompt_2"
          type="text"
          required
          defaultValue={task?.prompt_2 ?? ""}
          placeholder="One moment where instructions could have been clearer."
          className="h-9 rounded-[6px] border border-border bg-card px-2.5 text-sm text-ink outline-none focus:border-primary"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="general_prompt" className="text-xs text-muted">
          General prompt
        </label>
        <input
          id="general_prompt"
          name="general_prompt"
          type="text"
          defaultValue={task?.general_prompt ?? "What would you borrow for your own teaching?"}
          className="h-9 rounded-[6px] border border-border bg-card px-2.5 text-sm text-ink outline-none focus:border-primary"
        />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="rating_label" className="text-xs text-muted">
            Rating axis
          </label>
          <input
            id="rating_label"
            name="rating_label"
            type="text"
            defaultValue={task?.rating_label ?? "Pace"}
            className="h-9 w-40 rounded-[6px] border border-border bg-card px-2.5 text-sm text-ink outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="rating_options" className="text-xs text-muted">
            Options (comma-separated)
          </label>
          <input
            id="rating_options"
            name="rating_options"
            type="text"
            defaultValue={(task?.rating_options ?? ["Too slow", "Just right", "Too fast"]).join(", ")}
            className="h-9 rounded-[6px] border border-border bg-card px-2.5 text-sm text-ink outline-none focus:border-primary"
          />
        </div>
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-[6px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save task"}
      </button>
    </form>
  );
}
