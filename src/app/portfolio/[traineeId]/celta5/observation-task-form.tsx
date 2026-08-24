"use client";

import { useActionState } from "react";
import { submitObservationTask, type ObservationTaskFormState } from "@/app/dashboard/trainee/actions";
import { CEFR_LEVELS } from "@/lib/levels";

const initialState: ObservationTaskFormState = { error: null };

export function ObservationTaskForm({
  taskId,
  deliveryMode,
}: {
  taskId: string;
  deliveryMode?: "f2f" | "online" | "mixed";
}) {
  const [state, action, pending] = useActionState(submitObservationTask, initialState);

  return (
    <form action={action} className="mt-3 flex flex-col gap-3">
      <input type="hidden" name="task_id" value={taskId} />
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-muted">Date</label>
          <input
            name="observation_date"
            type="date"
            className="rounded-[6px] border border-border bg-card-inset px-3 py-2 text-sm text-ink outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-muted">Length (minutes)</label>
          <input
            name="length_minutes"
            type="number"
            className="rounded-[6px] border border-border bg-card-inset px-3 py-2 text-sm text-ink outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-muted">Level</label>
          <select
            name="level"
            defaultValue=""
            className="appearance-none rounded-[6px] border border-border bg-card-inset px-3 py-2 text-sm text-ink outline-none focus:border-primary"
          >
            <option value="">Select a level</option>
            {CEFR_LEVELS.map((l) => (
              <option key={l.code} value={`${l.name} (${l.code})`}>
                {l.name} ({l.code})
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-muted">Learners present</label>
          <input
            name="learners_present"
            type="number"
            className="rounded-[6px] border border-border bg-card-inset px-3 py-2 text-sm text-ink outline-none focus:border-primary"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" name="filmed" />
        Filmed lesson
      </label>

      {deliveryMode === "mixed" ? (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-muted">Mode observed</label>
          <select
            name="mode"
            required
            defaultValue=""
            className="appearance-none rounded-[6px] border border-border bg-card-inset px-3 py-2 text-sm text-ink outline-none focus:border-primary"
          >
            <option value="" disabled>
              Select a mode
            </option>
            <option value="f2f">Face-to-face</option>
            <option value="online">Online</option>
          </select>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">Your response</label>
        <textarea
          name="response"
          rows={4}
          required
          className="rounded-[6px] border border-border bg-card-inset px-3 py-2 text-sm text-ink outline-none focus:border-primary"
        />
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Submitting..." : "Submit"}
      </button>
    </form>
  );
}
