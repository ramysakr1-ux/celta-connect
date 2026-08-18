"use client";

import { useActionState } from "react";
import { saveFilmedObservationSession, type FormState } from "@/app/trainer/(hub)/timetable/filmed-observation-actions";
import { CEFR_LEVELS } from "@/lib/levels";

const initialState: FormState = { error: null };

export function FilmedObservationSetupForm({
  eventId,
  lessonTitle,
  recordingUrl,
  lengthMinutes,
  level,
  learnerCount,
}: {
  eventId: string;
  lessonTitle: string | null;
  recordingUrl: string | null;
  lengthMinutes: number | null;
  level: string | null;
  learnerCount: number | null;
}) {
  const [state, action, pending] = useActionState(saveFilmedObservationSession, initialState);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="event_id" value={eventId} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="lesson_title" className="text-xs text-muted">
          Lesson title
        </label>
        <input
          id="lesson_title"
          name="lesson_title"
          type="text"
          defaultValue={lessonTitle ?? ""}
          placeholder="Focus set by the trainer per session"
          className="h-9 rounded-[6px] border border-border bg-card px-2.5 text-sm text-ink outline-none focus:border-primary"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="recording_url" className="text-xs text-muted">
          Recording link
        </label>
        <input
          id="recording_url"
          name="recording_url"
          type="url"
          defaultValue={recordingUrl ?? ""}
          placeholder="https://..."
          className="h-9 rounded-[6px] border border-border bg-card px-2.5 text-sm text-ink outline-none focus:border-primary"
        />
        <p className="text-[11px] text-muted">A link to a recording you hold rights to, or an internally-hosted file. Never fetched automatically.</p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="length_minutes" className="text-xs text-muted">
            Length (minutes)
          </label>
          <input
            id="length_minutes"
            name="length_minutes"
            type="number"
            min={1}
            defaultValue={lengthMinutes ?? ""}
            className="h-9 w-32 rounded-[6px] border border-border bg-card px-2.5 text-sm text-ink outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="level" className="text-xs text-muted">
            Level
          </label>
          <select
            id="level"
            name="level"
            defaultValue={level ?? ""}
            className="h-9 w-40 rounded-[6px] border border-border bg-card px-2.5 text-sm text-ink outline-none focus:border-primary"
          >
            <option value="">Not set</option>
            {CEFR_LEVELS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name} ({l.code})
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="learner_count" className="text-xs text-muted">
            Learners
          </label>
          <input
            id="learner_count"
            name="learner_count"
            type="number"
            min={0}
            defaultValue={learnerCount ?? ""}
            className="h-9 w-24 rounded-[6px] border border-border bg-card px-2.5 text-sm text-ink outline-none focus:border-primary"
          />
        </div>
      </div>
      <p className="text-[11px] text-muted">Length feeds the Observations hours log once a trainee marks their task complete.</p>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-[6px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
