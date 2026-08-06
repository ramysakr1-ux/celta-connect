"use client";

import { useActionState } from "react";
import { generateTimetableSkeleton, type FormState } from "@/app/trainer/(hub)/timetable/actions";
import { DEFAULT_TEACHING_DAYS, DEFAULT_MEETING_DAYS } from "@/lib/timetable-skeleton";

const initialState: FormState = { error: null };

const DAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

export function GenerateSkeletonForm() {
  const [state, formAction, pending] = useActionState(generateTimetableSkeleton, initialState);

  return (
    <form action={formAction} className="mt-4 flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-muted">Course start date</label>
          <input
            name="start_date"
            type="date"
            required
            className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-muted">Total teaching days</label>
          <input
            name="total_teaching_days"
            type="number"
            min={5}
            max={60}
            defaultValue={DEFAULT_TEACHING_DAYS}
            required
            className="w-28 rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">
          Which days does the course meet? -- 20 days Mon-Fri is a standard 4-week full-time
          course; pick more days for a 5-week course, or fewer days per week (e.g. evenings and
          Saturdays) for a part-time one.
        </label>
        <div className="flex flex-wrap gap-3">
          {DAYS.map((day) => (
            <label key={day.value} className="flex items-center gap-1.5 text-sm text-ink">
              <input
                type="checkbox"
                name="meeting_day"
                value={day.value}
                defaultChecked={(DEFAULT_MEETING_DAYS as number[]).includes(day.value)}
              />
              {day.label}
            </label>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-card disabled:opacity-60"
      >
        {pending ? "Generating…" : "Generate standard skeleton"}
      </button>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
    </form>
  );
}
