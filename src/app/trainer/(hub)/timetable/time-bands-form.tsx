"use client";

import { useActionState, useState } from "react";
import { setTimeBands, resetTimeBands, type FormState } from "@/app/trainer/(hub)/timetable/actions";
import type { TimeBand } from "@/lib/supabase/types";

const initialState: FormState = { error: null };

// §2 -- three real historical timetables (full-time, afternoon-only,
// online) each ran a genuinely different daily shape, so this is a plain
// per-course editable list rather than a fixed 6-slot grid. Rows are local
// UI state (add/remove/reorder-by-edit); the actual band list is only
// submitted as repeated band_start/band_end fields when the form saves.
export function TimeBandsForm({ timeBands, isCustom }: { timeBands: TimeBand[]; isCustom: boolean }) {
  const [state, formAction, pending] = useActionState(setTimeBands, initialState);
  const [rows, setRows] = useState(timeBands.map((b) => ({ start: b.start, end: b.end })));

  const updateRow = (index: number, field: "start" | "end", value: string) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="font-serif text-lg text-ink">Daily time bands</h3>
        <p className="mt-1 text-sm text-muted">
          The columns of the timetable grid below -- match your course&apos;s actual daily rhythm (full-time,
          afternoon-only, online all run different hours). {isCustom ? "Customised for this course." : "Using the standard default shape."}
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          {rows.map((row, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                name="band_start"
                type="time"
                required
                value={row.start}
                onChange={(e) => updateRow(i, "start", e.target.value)}
                className="rounded-[6px] border border-border bg-card px-3 py-1.5 text-sm text-ink outline-none focus:border-primary"
              />
              <span className="text-sm text-muted">–</span>
              <input
                name="band_end"
                type="time"
                required
                value={row.end}
                onChange={(e) => updateRow(i, "end", e.target.value)}
                className="rounded-[6px] border border-border bg-card px-3 py-1.5 text-sm text-ink outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                disabled={rows.length <= 1}
                className="rounded-[6px] px-2 py-1.5 text-sm text-muted hover:text-destructive disabled:opacity-30"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setRows((prev) => [...prev, { start: "", end: "" }])}
            className="self-start rounded-[6px] border border-border px-3 py-1.5 text-sm text-ink trainer-hover"
          >
            + Add band
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-[6px] bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save time bands"}
          </button>
          {isCustom ? (
            <button
              type="submit"
              formAction={resetTimeBands}
              className="text-sm text-muted hover:text-ink hover:underline"
            >
              Reset to default
            </button>
          ) : null}
        </div>

        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      </form>
    </div>
  );
}
