"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { markFilmedObservationTaskComplete, saveFilmedObservationTaskResponse } from "@/app/portfolio/[traineeId]/filmed-observation-actions";

// Ramy, 29 Aug 2026: "they have now a chance to watch and type at the same
// time. It's only forty-five minutes, we don't want to waste too much
// time." This replaced the group-chat panel in the watch screen's right
// rail, so the full observation task sits beside the video instead of
// living on a page the candidate has to leave the recording to reach.
//
// No link out to the standalone task page any more -- Ramy: "we already
// have one at the bottom of the task, we don't need another one." With the
// whole task here beside the video there is nowhere else to go. That page
// still exists and reads the same responses, reached from the observation
// log after the fact.
export function FilmedObservationTaskPanel({
  sessionId,
  taskId,
  prompts,
  ratingLabel,
  ratingOptions,
  initialResponses,
  criteriaLine,
  completedAt,
}: {
  sessionId: string;
  taskId: string | null;
  prompts: string[];
  ratingLabel: string | null;
  ratingOptions: string[];
  initialResponses: Record<string, string>;
  criteriaLine: string | null;
  completedAt: string | null;
}) {
  const [values, setValues] = useState<Record<string, string>>(initialResponses);
  const [saved, setSaved] = useState(true);
  const [state, formAction, pending] = useActionState(markFilmedObservationTaskComplete, { error: null });
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((t) => clearTimeout(t));
    };
  }, []);

  function set(key: string, value: string) {
    if (!taskId) return;
    setValues((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
    const existing = timers.current.get(key);
    if (existing) clearTimeout(existing);
    timers.current.set(
      key,
      // Debounced per field rather than per keystroke across the whole
      // form: eight prompts on one screen means a single shared timer
      // would keep resetting while someone works down the list, and
      // nothing would save until they stopped entirely.
      setTimeout(() => {
        const fd = new FormData();
        fd.set("task_id", taskId);
        fd.set("field", key);
        fd.set("value", value);
        void saveFilmedObservationTaskResponse(fd).then(() => setSaved(true));
      }, 700)
    );
  }

  if (!taskId) {
    return (
      <div className="card p-4">
        <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Observation task</p>
        <p className="mt-2 text-sm text-muted">Your tutor hasn&apos;t attached a task to this recording yet.</p>
      </div>
    );
  }

  return (
    <div className="card card-garnet flex flex-col gap-3 p-4">
      <div>
        <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Observation task</p>
        {criteriaLine ? <p className="mt-1 text-sm text-ink">{criteriaLine}</p> : null}
        <p className="mt-1 text-xs text-muted">
          Answer as you watch — it saves as you go, and the video pauses to let you catch up.
        </p>
      </div>

      {completedAt ? (
        <p className="rounded-[6px] border border-border bg-card-inset px-3 py-2 text-sm font-semibold text-primary">
          Marked complete — your answers are saved and the hour is logged.
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        {prompts.map((prompt, i) => (
          <div key={i} className="flex flex-col gap-1">
            <label className="text-[13px] leading-[1.45] text-ink">
              <span className="mr-1.5 text-xs tabular-nums text-muted">{i + 1}</span>
              {prompt}
            </label>
            <textarea
              value={values[String(i)] ?? ""}
              onChange={(e) => set(String(i), e.target.value)}
              rows={2}
              placeholder="Write here…"
              disabled={Boolean(completedAt)}
              className="rounded-[6px] border border-border bg-card-inset px-2.5 py-1.5 text-sm text-ink outline-none focus:border-primary disabled:opacity-70"
            />
          </div>
        ))}

        {ratingLabel && ratingOptions.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <p className="text-[13px] leading-[1.45] text-ink">{ratingLabel}</p>
            <div className="flex flex-wrap gap-1.5">
              {ratingOptions.map((opt) => {
                const on = values["rating"] === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    aria-pressed={on}
                    disabled={Boolean(completedAt)}
                    onClick={() => set("rating", on ? "" : opt)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold disabled:opacity-70 ${
                      on ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted trainee-hover-fill"
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 border-t border-border-faint pt-3">
        <span className="text-[11px] text-muted">{saved ? "Saved" : "Saving…"}</span>
        {!completedAt ? (
          <form action={formAction} className="flex flex-col gap-1">
            <input type="hidden" name="task_id" value={taskId} />
            <input type="hidden" name="session_id" value={sessionId} />
            {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
            <button
              type="submit"
              disabled={pending}
              className="self-start rounded-[6px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {pending ? "Saving…" : "Mark as complete"}
            </button>
            <span className="text-[11px] text-muted">This is what logs the hour toward your six.</span>
          </form>
        ) : null}
      </div>
    </div>
  );
}
