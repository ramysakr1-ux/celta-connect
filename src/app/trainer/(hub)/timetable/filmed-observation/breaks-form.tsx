"use client";

import { useActionState } from "react";
import { addFilmedObservationBreak, deleteFilmedObservationBreak, type FormState } from "@/app/trainer/(hub)/timetable/filmed-observation-actions";

const initialState: FormState = { error: null };

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function FilmedObservationBreaksForm({
  sessionId,
  breaks,
}: {
  sessionId: string;
  breaks: { id: string; break_number: number; timestamp_seconds: number; duration_seconds: number; prompt: string }[];
}) {
  const [state, action, pending] = useActionState(addFilmedObservationBreak, initialState);

  return (
    <div className="flex flex-col gap-3">
      {breaks.length > 0 ? (
        <div className="flex flex-col">
          {breaks.map((b, i) => (
            <div key={b.id} className={`flex items-start justify-between gap-3 py-2.5 ${i > 0 ? "border-t border-border-faint" : ""}`}>
              <div>
                <p className="text-sm text-ink">
                  Break {b.break_number} · at {formatTimestamp(b.timestamp_seconds)} · {b.duration_seconds}s countdown
                </p>
                <p className="mt-0.5 text-xs text-muted">{b.prompt}</p>
              </div>
              <form action={deleteFilmedObservationBreak}>
                <input type="hidden" name="break_id" value={b.id} />
                <button type="submit" className="shrink-0 text-xs text-destructive hover:underline">
                  Remove
                </button>
              </form>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">No discussion breaks yet.</p>
      )}

      <form action={action} className="flex flex-col gap-2 border-t border-border-faint pt-3">
        <input type="hidden" name="session_id" value={sessionId} />
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="timestamp_seconds" className="text-[11px] text-muted">
              At (seconds)
            </label>
            <input
              id="timestamp_seconds"
              name="timestamp_seconds"
              type="number"
              min={0}
              required
              className="h-9 w-28 rounded-[6px] border border-border bg-card px-2 text-sm text-ink outline-none focus:border-primary"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="duration_seconds" className="text-[11px] text-muted">
              Countdown (seconds)
            </label>
            <input
              id="duration_seconds"
              name="duration_seconds"
              type="number"
              min={1}
              defaultValue={180}
              className="h-9 w-28 rounded-[6px] border border-border bg-card px-2 text-sm text-ink outline-none focus:border-primary"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="prompt" className="text-[11px] text-muted">
            Discussion prompt
          </label>
          <input
            id="prompt"
            name="prompt"
            type="text"
            required
            placeholder="What did you notice about how instructions were given in this stage?"
            className="h-9 rounded-[6px] border border-border bg-card px-2.5 text-sm text-ink outline-none focus:border-primary"
          />
        </div>
        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-[6px] border border-border px-3 py-1.5 text-xs font-semibold text-ink hover:border-primary disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add break"}
        </button>
      </form>
    </div>
  );
}
