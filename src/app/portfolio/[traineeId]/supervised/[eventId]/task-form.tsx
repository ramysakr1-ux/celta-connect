"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { heartbeatSupervisedSession, submitSupervisedSession, type SubmitState } from "@/app/portfolio/[traineeId]/supervised/[eventId]/actions";
import { VoiceTextarea } from "@/components/voice-textarea";
import type { Database } from "@/lib/supabase/types";

type Completion = Database["public"]["Tables"]["supervised_session_completions"]["Row"];

const initialState: SubmitState = { error: null };
const HEARTBEAT_SECONDS = 15;

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function SupervisedTaskForm({ eventId, completion }: { eventId: string; completion: Completion | null }) {
  const [state, formAction, pending] = useActionState(submitSupervisedSession, initialState);
  const [liveSeconds, setLiveSeconds] = useState(completion?.time_spent_seconds ?? 0);
  const pendingDelta = useRef(0);

  const locked = Boolean(completion?.submitted_at);

  // Ticks once a second for the on-screen display, and reports accumulated
  // real time back to the server every HEARTBEAT_SECONDS -- see
  // actions.ts's own comment on why this is incremental, not one final
  // self-reported total. Pauses while the tab isn't visible (switching
  // apps, locking the phone) so idle time in the background isn't counted
  // as time spent on the task.
  useEffect(() => {
    if (locked) return;
    const tick = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setLiveSeconds((s) => s + 1);
      pendingDelta.current += 1;
    }, 1000);
    const heartbeat = setInterval(() => {
      if (pendingDelta.current <= 0) return;
      const delta = pendingDelta.current;
      pendingDelta.current = 0;
      heartbeatSupervisedSession(eventId, delta);
    }, HEARTBEAT_SECONDS * 1000);
    function flushOnHide() {
      if (document.visibilityState === "hidden" && pendingDelta.current > 0) {
        const delta = pendingDelta.current;
        pendingDelta.current = 0;
        heartbeatSupervisedSession(eventId, delta);
      }
    }
    document.addEventListener("visibilitychange", flushOnHide);
    return () => {
      clearInterval(tick);
      clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", flushOnHide);
      if (pendingDelta.current > 0) heartbeatSupervisedSession(eventId, pendingDelta.current);
    };
  }, [eventId, locked]);

  if (locked) {
    return (
      <div className="sheet flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-ink">Submitted</p>
          <p className="text-xs text-muted">Time spent: {formatDuration(completion!.time_spent_seconds)}</p>
        </div>
        <p className="whitespace-pre-wrap text-sm text-ink">{completion?.response}</p>
        {completion?.checked_at ? (
          <p className="text-xs text-primary">Checked by your trainer.</p>
        ) : (
          <p className="text-xs text-muted">Waiting on your trainer to check this.</p>
        )}
      </div>
    );
  }

  return (
    <form action={formAction} className="sheet flex flex-col gap-3">
      <input type="hidden" name="event_id" value={eventId} />
      <p className="text-xs text-muted">Time on this task: {formatDuration(liveSeconds)}</p>
      <VoiceTextarea
        name="response"
        rows={8}
        defaultValue={completion?.response ?? ""}
        placeholder="Write what you found, or your answers -- whatever this task asks for."
        className="w-full rounded-[6px] border border-input bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
      />
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-[6px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Submitting…" : "Mark complete"}
      </button>
    </form>
  );
}
