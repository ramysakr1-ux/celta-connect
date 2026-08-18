"use client";

import { useActionState, useState } from "react";
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

// Part-time's own draft (PART_TIME_SKELETON) is a different shape, not
// just a different day count on the standard one -- ABC/DEF are two
// independent, unpaired TP groups each on their own fixed weekday, not
// one group's daily-alternating halves. Sat+Wed, 24 sessions (12 weeks)
// is the reference pattern; both stay editable before generating.
const PART_TIME_DEFAULT_DAYS = 24;
const PART_TIME_DEFAULT_MEETING_DAYS = [6, 3]; // Sat, Wed

// Ramy, 2026-08-18: the default full-time course is five weeks, not four
// -- the same 20 contact days (DEFAULT_TEACHING_DAYS, unchanged) spread
// over one day off per week rather than a straight Mon-Fri run. Two named
// five-week variants exist (Friday off, Wednesday off); the four-week
// Mon-Fri run is "the intensive alternative," not the default. All three
// use the same STANDARD_CELTA_SKELETON content -- this only changes which
// meeting days are pre-checked, same mechanism buildSkeletonEvents already
// stretches correctly for any day pattern.
const STANDARD_VARIANTS = {
  five_week_friday_off: { label: "Five weeks -- Friday off", meetingDays: [1, 2, 3, 4] },
  five_week_wednesday_off: { label: "Five weeks -- Wednesday off", meetingDays: [1, 2, 4, 5] },
  four_week: { label: "Four weeks -- the intensive alternative, Mon-Fri", meetingDays: DEFAULT_MEETING_DAYS as number[] },
} as const;
type StandardVariant = keyof typeof STANDARD_VARIANTS;

export function GenerateSkeletonForm() {
  const [state, formAction, pending] = useActionState(generateTimetableSkeleton, initialState);
  const [shape, setShape] = useState<"standard" | "part_time">("standard");
  const [standardVariant, setStandardVariant] = useState<StandardVariant>("five_week_friday_off");

  return (
    <form action={formAction} className="mt-4 flex flex-col gap-4">
      <input type="hidden" name="shape" value={shape} />

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">Course shape</label>
        <div className="flex flex-col gap-2">
          {(Object.keys(STANDARD_VARIANTS) as StandardVariant[]).map((variant) => (
            <label key={variant} className="flex items-center gap-1.5 text-sm text-ink">
              <input
                type="radio"
                checked={shape === "standard" && standardVariant === variant}
                onChange={() => {
                  setShape("standard");
                  setStandardVariant(variant);
                }}
              />
              {STANDARD_VARIANTS[variant].label}
            </label>
          ))}
          <label className="flex items-center gap-1.5 text-sm text-ink">
            <input type="radio" checked={shape === "part_time"} onChange={() => setShape("part_time")} />
            Part-time -- two independent groups, each on its own fixed weekday
          </label>
        </div>
      </div>

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
            key={shape}
            name="total_teaching_days"
            type="number"
            min={5}
            max={60}
            defaultValue={shape === "part_time" ? PART_TIME_DEFAULT_DAYS : DEFAULT_TEACHING_DAYS}
            required
            className="w-28 rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">
          {shape === "part_time"
            ? "Which days does the course meet? -- Saturday and Wednesday is the reference pattern; pick your centre's actual two days if different."
            : "Which days does the course meet? -- same contact days either way; this is just the calendar spread. Edit freely before generating."}
        </label>
        <div className="flex flex-wrap gap-3">
          {DAYS.map((day) => (
            <label key={`${shape}-${standardVariant}-${day.value}`} className="flex items-center gap-1.5 text-sm text-ink">
              <input
                type="checkbox"
                name="meeting_day"
                value={day.value}
                defaultChecked={(
                  shape === "part_time" ? PART_TIME_DEFAULT_MEETING_DAYS : (STANDARD_VARIANTS[standardVariant].meetingDays as number[])
                ).includes(day.value)}
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
        {pending ? "Generating…" : "Generate skeleton"}
      </button>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
    </form>
  );
}
