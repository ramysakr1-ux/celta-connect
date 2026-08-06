"use client";

import { useMemo, useState } from "react";
import { DEFAULT_TIME_BANDS, overridesband, type DayRow, type TimeBand } from "@/lib/timetable-grid";
import { EventCell, type Volunteer } from "@/app/trainer/(hub)/timetable/event-cell";

// §1.1a v2 rule 10 -- mobile does not shrink the grid, it collapses to one
// day at a time, opening on today, with a control to step between days and
// jump between weeks.
export function MobileDayView({
  rows,
  today,
  locked,
  volunteers,
  attendedByEvent,
  timeBands = DEFAULT_TIME_BANDS,
}: {
  rows: DayRow[];
  today: string;
  locked: boolean;
  volunteers: Volunteer[];
  attendedByEvent: Record<string, string[]>;
  timeBands?: TimeBand[];
}) {
  const todayIndex = rows.findIndex((r) => r.isoDate === today);
  const [index, setIndex] = useState(todayIndex >= 0 ? todayIndex : 0);
  const now = useMemo(() => new Date(), []);

  const weeks = useMemo(() => {
    const seen = new Map<string, number>();
    rows.forEach((row, i) => {
      if (row.weekLabel && !seen.has(row.weekLabel)) seen.set(row.weekLabel, i);
    });
    return [...seen.entries()];
  }, [rows]);

  const attendedByEventMap = useMemo(
    () => new Map(Object.entries(attendedByEvent).map(([id, ids]) => [id, new Set(ids)])),
    [attendedByEvent]
  );

  if (rows.length === 0) return null;
  const row = rows[index];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(i - 1, 0))}
          disabled={index === 0}
          className="rounded-[6px] border border-border px-3 py-1.5 text-sm text-ink disabled:opacity-40"
        >
          ←
        </button>
        <div className="text-center">
          <p className="font-serif text-lg text-ink">{row.date}</p>
          {row.isoDate === today ? <p className="text-[10px] font-semibold text-primary uppercase">Today</p> : null}
        </div>
        <button
          type="button"
          onClick={() => setIndex((i) => Math.min(i + 1, rows.length - 1))}
          disabled={index === rows.length - 1}
          className="rounded-[6px] border border-border px-3 py-1.5 text-sm text-ink disabled:opacity-40"
        >
          →
        </button>
      </div>

      {weeks.length > 1 ? (
        <select
          value={weeks.find(([, i]) => i <= index)?.[0] ?? weeks[0][0]}
          onChange={(e) => {
            const target = weeks.find(([label]) => label === e.target.value);
            if (target) setIndex(target[1]);
          }}
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
        >
          {weeks.map(([label]) => (
            <option key={label} value={label}>
              Week of {label}
            </option>
          ))}
        </select>
      ) : null}

      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Admin &amp; deadlines</p>
        {row.admin.length > 0 ? (
          <EventCell
            events={row.admin}
            locked={locked}
            now={now}
            showTime={() => false}
            volunteers={volunteers}
            attendedByEvent={attendedByEventMap}
          />
        ) : (
          <p className="text-xs text-muted">Nothing due.</p>
        )}
      </div>

      {row.bands.map((bandEvents, i) =>
        bandEvents.length > 0 ? (
          <div key={timeBands[i].label} className="flex flex-col gap-2">
            <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">{timeBands[i].label}</p>
            <EventCell
              events={bandEvents}
              locked={locked}
              now={now}
              showTime={(event) => overridesband(event, timeBands)}
              volunteers={volunteers}
              attendedByEvent={attendedByEventMap}
            />
          </div>
        ) : null
      )}
    </div>
  );
}
