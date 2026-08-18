"use client";

import { useActionState } from "react";
import { saveObservation, type ObservationFormState } from "@/app/dashboard/trainee/actions";
import { CEFR_LEVELS } from "@/lib/levels";
import type { Database } from "@/lib/supabase/types";

type Observation = Database["public"]["Tables"]["observations"]["Row"];

const initialState: ObservationFormState = { error: null };

export function ObservationForm({
  observation,
  deliveryMode,
}: {
  observation?: Observation;
  deliveryMode?: "f2f" | "online" | "mixed";
}) {
  const [state, action, pending] = useActionState(saveObservation, initialState);

  return (
    <form action={action} className="card flex flex-col gap-3 p-4">
      {observation ? (
        <input type="hidden" name="observation_id" value={observation.id} />
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-muted">Date</label>
          <input
            name="observation_date"
            type="date"
            defaultValue={observation?.observation_date ?? ""}
            className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-muted">Length (minutes)</label>
          <input
            name="length_minutes"
            type="number"
            defaultValue={observation?.length_minutes ?? ""}
            className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-muted">Level</label>
          <select
            name="level"
            defaultValue={observation?.level ?? ""}
            className="appearance-none rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
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
            defaultValue={observation?.learners_present ?? ""}
            className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">Lesson focus</label>
        <input
          name="lesson_focus"
          type="text"
          defaultValue={observation?.lesson_focus ?? ""}
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" name="filmed" defaultChecked={observation?.filmed} />
        Filmed lesson
      </label>

      {deliveryMode === "mixed" ? (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-muted">Mode observed</label>
          <select
            name="mode"
            required
            defaultValue={observation?.mode ?? ""}
            className="appearance-none rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
          >
            <option value="" disabled>
              Select a mode
            </option>
            <option value="f2f">Face-to-face</option>
            <option value="online">Online</option>
          </select>
        </div>
      ) : null}

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-card disabled:opacity-60"
      >
        {pending ? "Saving..." : observation ? "Save" : "Add observation"}
      </button>
    </form>
  );
}
