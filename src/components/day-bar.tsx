"use client";

import { useEffect, useState } from "react";

// The day, end to end, as one thin bar: how much of it has gone, where each
// session sits in it, and the clock.
//
// Built for the trainee's dark header (design_handoff_trainee_landing §1b) and
// then shared with the trainer hub -- Ramy, 10 Sep 2026: "keep the bar colour
// relevant to the trainer role, MCT or ACT." So the accent is an input, never a
// constant: garnet for an MCT, gold for an ACT, and on the trainee's header the
// lifted garnet that survives an ink-warm ground. Colour signals scope in this
// app, and a bar that hardcoded one would be saying the wrong thing on two of
// the three screens it appears on.
//
// `tone` is which ground it sits on, which decides the neutrals only. Everything
// coloured comes from `accent`.
//
// Ramy, 10 Sep 2026: "I think everyone should have a clock. Every landing page
// should have a clock." Not everyone has a DAY -- a centre manager may be
// looking at four courses at once, a platform owner at four centres -- but
// everyone has a time. So with no sessions to draw, this renders the clock
// alone rather than nothing, and the bar is the part that needs a course.

export interface DayBarItem {
  id: string;
  /** Minutes past midnight, centre-local. */
  fromMin: number;
  toMin: number;
  /** UTC ms, so "finished" is a real moment and not a clock comparison. */
  endsAtMs: number;
  title: string;
  /** Draw this one in the accent -- the trainee's own TP. */
  emphasis?: boolean;
}

function useNow(serverNowMs: number, tickMs = 15_000): number {
  const [now, setNow] = useState(serverNowMs);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(t);
  }, [tickMs]);
  return now;
}

export function DayBar({
  items,
  windowStart,
  windowEnd,
  /** A known (ms, minutes) pair, so "now" converts to the centre's clock
   *  without re-deriving the zone in the browser. */
  anchorMs,
  anchorMin,
  accent,
  tone,
  serverNowMs,
  timeZone,
}: {
  items: DayBarItem[];
  windowStart: number;
  windowEnd: number;
  anchorMs: number;
  anchorMin: number;
  accent: string;
  tone: "dark" | "light";
  serverNowMs: number;
  /** The CENTRE's zone. This clock is the centre's wall clock, never the
   *  reader's device -- a course has one timetable and one 10:00, and a tutor
   *  working from another country who saw their own time next to it would show
   *  up an hour out. See zoneNote below for how it says so. */
  timeZone: string;
}) {
  const [mounted, setMounted] = useState(false);
  const now = useNow(serverNowMs);
  useEffect(() => setMounted(true), []);

  const span = Math.max(1, windowEnd - windowStart);
  const pct = (m: number) => ((m - windowStart) / span) * 100;
  const nowMin = anchorMin + (now - anchorMs) / 60_000;
  const nowPct = Math.max(0, Math.min(100, pct(nowMin)));

  const dark = tone === "dark";
  const label = dark ? "oklch(78% 0.02 80)" : "var(--color-muted)";
  const trackBg = dark ? "color-mix(in oklab, oklch(98.5% 0.006 90) 16%, transparent)" : "var(--color-border)";
  const tick = (done: boolean) =>
    dark
      ? `color-mix(in oklab, oklch(98.5% 0.006 90) ${done ? 34 : 22}%, transparent)`
      : `color-mix(in oklab, var(--color-ink-warm) ${done ? 34 : 20}%, var(--color-card))`;
  const markerFill = dark ? "oklch(98.5% 0.006 90)" : "var(--color-card)";
  const markerRing = dark ? "var(--color-ink-warm)" : accent;
  const clockInk = dark ? "oklch(98.5% 0.006 90)" : "var(--color-ink)";

  const hhmm = (m: number) =>
    `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(Math.round(m) % 60).padStart(2, "0")}`;
  const clock = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(
    new Date(now)
  );

  // Ramy, 10 Sep 2026, on his own device in Istanbul reading a New York
  // centre: "why is the clock not set to my time zone or the course time
  // zone?" It was the course's, exactly as designed -- but a bare "11:08" with
  // nothing naming it just reads as a broken clock, which is what he
  // concluded. So when the reader is somewhere else, the clock says whose it
  // is. In the centre's own zone there is nothing to disambiguate and the note
  // stays off, which is every trainee on a normal course.
  //
  // Mount-gated: the server has no idea where the reader is, and a value that
  // differs between the two is a hydration mismatch.
  const zoneNote = (() => {
    if (!mounted) return null;
    const here = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!here || here === timeZone) return null;
    return timeZone.split("/").pop()?.replace(/_/g, " ") ?? timeZone;
  })();

  const clockBlock = (
    <span className="flex flex-none items-baseline gap-1.5">
      {/* min-width so the row does not shift as the digits change. */}
      <span className="min-w-[42px] text-[12px] font-bold tabular-nums" style={{ color: clockInk }}>
        {mounted ? clock : ""}
      </span>
      {zoneNote ? (
        <span className="text-[10.5px] whitespace-nowrap" style={{ color: label }}>
          {zoneNote}
        </span>
      ) : null}
    </span>
  );

  // No sessions, no bar -- end labels alone would promise a day the timetable
  // is not describing. The clock still stands: it is the centre's time, which
  // is true whether or not anything is timetabled in it.
  if (items.length === 0) {
    return (
      <div className="flex min-w-0 flex-1 items-center justify-end gap-3">{clockBlock}</div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <span className="flex-none text-[10.5px] font-bold tracking-[0.12em] tabular-nums uppercase" style={{ color: label }}>
        {hhmm(windowStart)}
      </span>

      <div className="relative h-1 min-w-0 flex-1 rounded-[2px]" style={{ background: trackBg }}>
        {/* Elapsed, in the accent -- "the part of the day you're on". Held back
            until mount: drawn at the server's minute it would visibly jump. */}
        {mounted ? (
          <div className="absolute inset-y-0 left-0 rounded-[2px]" style={{ width: `${nowPct}%`, background: accent }} />
        ) : null}

        {items.map((s) => (
          <span
            key={s.id}
            title={`${hhmm(s.fromMin)} ${s.title}`}
            className="absolute top-[-3px] h-[10px] rounded-[2px]"
            style={{
              left: `${pct(s.fromMin)}%`,
              width: `max(1.2%, ${pct(s.toMin) - pct(s.fromMin)}%)`,
              background: s.emphasis ? "var(--color-gold)" : tick(now >= s.endsAtMs),
              border: s.emphasis ? `1.5px solid ${markerFill}` : undefined,
              boxSizing: "border-box",
            }}
          />
        ))}

        {mounted ? (
          <span
            aria-hidden
            className="absolute top-[-7px] h-[18px] w-0.5 rounded-[1px]"
            style={{ left: `${nowPct}%`, background: markerFill, boxShadow: `0 0 0 2px ${markerRing}` }}
          />
        ) : null}
      </div>

      <span className="flex-none text-[10.5px] font-bold tracking-[0.12em] tabular-nums uppercase" style={{ color: label }}>
        {hhmm(windowEnd)}
      </span>

      {clockBlock}
    </div>
  );
}
