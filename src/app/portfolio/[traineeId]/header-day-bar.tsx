"use client";

import { useEffect, useState } from "react";
import type { TraineeDay } from "@/lib/trainee-day";

// The day bar inside the dark header.
//
// design_handoff_trainee_landing §1b. Ramy, 10 Sep 2026, on why it matters:
// "the colourful header and the clock on the header is what actually makes
// this page cool."
//
// It is the whole day at a glance -- elapsed time as a gold fill, one tick per
// session, the trainee's own TP picked out in solid gold, and a white marker on
// the minute. It reads the SAME StreamDay the main track below reads, via
// getTraineeStreamDay's per-request cache, so the two can never drift.

function useNow(serverNowMs: number, tickMs = 15_000): number {
  const [now, setNow] = useState(serverNowMs);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(t);
  }, [tickMs]);
  return now;
}

/** Minutes past midnight in the centre's frame, read off a slot rather than
 *  re-deriving the zone in the browser. */
function nowMinutes(nowMs: number, day: TraineeDay): number {
  const anchor = day.slots[0];
  if (!anchor) return day.windowStart;
  return anchor.fromMin + (nowMs - anchor.startsAtMs) / 60_000;
}

export function HeaderDayBar({
  day,
  serverNowMs,
  timeZone,
}: {
  day: TraineeDay;
  serverNowMs: number;
  timeZone: string;
}) {
  const [mounted, setMounted] = useState(false);
  const now = useNow(serverNowMs);
  useEffect(() => setMounted(true), []);

  const { slots, windowStart, windowEnd } = day;
  const span = Math.max(1, windowEnd - windowStart);
  const pct = (m: number) => ((m - windowStart) / span) * 100;
  const nowPct = Math.max(0, Math.min(100, pct(nowMinutes(now, day))));

  const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(Math.round(m) % 60).padStart(2, "0")}`;
  const clock = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(
    new Date(now)
  );

  // A day with nothing on it has no bar to draw -- the labels alone would be a
  // 09:00-to-17:00 promise the timetable is not making.
  if (slots.length === 0) return <div className="min-w-0 flex-1" />;

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <span
        className="flex-none text-[10.5px] font-bold tracking-[0.12em] tabular-nums uppercase"
        style={{ color: "oklch(78% 0.02 80)" }}
      >
        {hhmm(windowStart)}
      </span>

      <div
        className="relative h-1 min-w-0 flex-1 rounded-[2px]"
        style={{ background: "color-mix(in oklab, oklch(98.5% 0.006 90) 16%, transparent)" }}
      >
        {/* Elapsed. Only once mounted: before then it would be drawn at the
            server's minute and visibly jump. */}
        {mounted ? (
          <div
            className="absolute inset-y-0 left-0 rounded-[2px]"
            // Ramy, 10 Sep 2026: garnet for "the part of the day you're on".
            // Lifted, because plain garnet on ink-warm is barely a shade.
            style={{ width: `${nowPct}%`, background: "var(--color-garnet-lift)" }}
          />
        ) : null}

        {slots.map((s) => {
          const done = now >= s.endsAtMs;
          return (
            <span
              key={s.id}
              title={`${s.time} ${s.title}`}
              className="absolute top-[-3px] h-[10px] rounded-[2px]"
              style={{
                left: `${pct(s.fromMin)}%`,
                width: `max(1.2%, ${pct(s.toMin) - pct(s.fromMin)}%)`,
                background: s.mine
                  ? "var(--color-gold)"
                  : `color-mix(in oklab, oklch(98.5% 0.006 90) ${done ? 34 : 22}%, transparent)`,
                border: s.mine ? "1.5px solid oklch(98.5% 0.006 90)" : undefined,
                boxSizing: "border-box",
              }}
            />
          );
        })}

        {mounted ? (
          <span
            aria-hidden
            className="absolute top-[-7px] h-[18px] w-0.5 rounded-[1px]"
            style={{
              left: `${nowPct}%`,
              background: "oklch(98.5% 0.006 90)",
              boxShadow: "0 0 0 2px var(--color-ink-warm)",
            }}
          />
        ) : null}
      </div>

      <span
        className="flex-none text-[10.5px] font-bold tracking-[0.12em] tabular-nums uppercase"
        style={{ color: "oklch(78% 0.02 80)" }}
      >
        {hhmm(windowEnd)}
      </span>

      {/* min-width so the row does not shift as the digits change. */}
      <span
        className="min-w-[42px] flex-none text-[12px] font-bold tabular-nums"
        style={{ color: "oklch(98.5% 0.006 90)" }}
      >
        {mounted ? clock : ""}
      </span>
    </div>
  );
}
