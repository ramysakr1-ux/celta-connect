"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  saveFilmedObservationTaskDraft,
  markFilmedObservationTaskComplete,
  type FormState,
} from "@/app/portfolio/[traineeId]/filmed-observation-actions";

const initialState: FormState = { error: null };

export function TaskResponseForm({
  taskId,
  sessionId,
  prompt1,
  prompt2,
  generalPrompt,
  ratingLabel,
  ratingOptions,
  response1,
  response2,
  responseGeneral,
  rating,
  completed,
}: {
  taskId: string;
  sessionId: string;
  prompt1: string;
  prompt2: string;
  generalPrompt: string;
  ratingLabel: string;
  ratingOptions: string[];
  response1: string;
  response2: string;
  responseGeneral: string;
  rating: string;
  completed: boolean;
}) {
  const [r1, setR1] = useState(response1);
  const [r2, setR2] = useState(response2);
  const [rGeneral, setRGeneral] = useState(responseGeneral);
  const [rRating, setRRating] = useState(rating);
  const [completeState, completeAction, completePending] = useActionState(markFilmedObservationTaskComplete, initialState);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Continuous autosave, debounced -- no explicit save action, matching the
  // spec's "responses save continuously as the trainee types."
  useEffect(() => {
    if (completed) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const fd = new FormData();
      fd.set("task_id", taskId);
      fd.set("response_1", r1);
      fd.set("response_2", r2);
      fd.set("response_general", rGeneral);
      fd.set("rating", rRating);
      void saveFilmedObservationTaskDraft(fd);
    }, 800);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r1, r2, rGeneral, rRating, completed]);

  const isLocked = completed;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink">{prompt1}</label>
        <textarea
          value={r1}
          onChange={(e) => setR1(e.target.value)}
          disabled={isLocked}
          rows={3}
          className="rounded-[6px] border border-border bg-card px-2.5 py-2 text-sm text-ink outline-none focus:border-primary disabled:opacity-70"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink">{prompt2}</label>
        <textarea
          value={r2}
          onChange={(e) => setR2(e.target.value)}
          disabled={isLocked}
          rows={3}
          className="rounded-[6px] border border-border bg-card px-2.5 py-2 text-sm text-ink outline-none focus:border-primary disabled:opacity-70"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink">{generalPrompt}</label>
        <textarea
          value={rGeneral}
          onChange={(e) => setRGeneral(e.target.value)}
          disabled={isLocked}
          rows={3}
          className="rounded-[6px] border border-border bg-card px-2.5 py-2 text-sm text-ink outline-none focus:border-primary disabled:opacity-70"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink">{ratingLabel}</span>
        <div className="flex flex-wrap gap-2">
          {ratingOptions.map((opt) => (
            <button
              key={opt}
              type="button"
              disabled={isLocked}
              aria-pressed={rRating === opt}
              onClick={() => setRRating(opt)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-70 ${
                rRating === opt ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted trainee-hover hover:text-ink"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border-faint pt-3">
        <p className="text-xs text-muted">{isLocked ? "Completed — responses are locked." : "Saved automatically as you type."}</p>
        {!isLocked ? (
          <form action={completeAction}>
            <input type="hidden" name="task_id" value={taskId} />
            <input type="hidden" name="session_id" value={sessionId} />
            <button
              type="submit"
              disabled={completePending}
              className="rounded-[6px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {completePending ? "Saving…" : "Mark as complete"}
            </button>
          </form>
        ) : null}
      </div>
      {completeState.error ? <p className="text-sm text-destructive">{completeState.error}</p> : null}
    </div>
  );
}
