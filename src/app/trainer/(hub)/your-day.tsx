"use client";

import { useEffect, useState } from "react";

// The tutor's own day, and the clock that drives it.
//
// v4 handoff: "the page acknowledges time passing." The heading carries a
// live HH:MM, and each session below is done / now / next / later according
// to it -- so a tutor between two sessions sees where they are in the day
// without reading times.
//
// Hydration: the server and the browser will never agree on the minute, and
// a value that differs between them is a hydration mismatch (same class of
// bug as randomising in an initial render). So the first paint uses the
// instant the SERVER rendered at, passed in as a number, which both sides
// compute identically; only after mount does the browser take over and tick.
// The clock itself starts blank for that reason and fills in after mount.

export interface DaySlot {
  id: string;
  time: string; // "13:00"
  title: string;
  sub: string | null;
  /** UTC ms of the start, resolved in the centre's zone on the server. */
  startsAtMs: number;
  /** UTC ms after which the slot counts as done. */
  endsAtMs: number;
  zoomUrl: string | null;
}

type State = "done" | "now" | "next" | "later";

function stateOf(slot: DaySlot, nowMs: number, firstFutureId: string | null): State {
  if (nowMs >= slot.endsAtMs) return "done";
  if (nowMs >= slot.startsAtMs) return "now";
  return slot.id === firstFutureId ? "next" : "later";
}

function useNow(serverNowMs: number, tickMs = 30_000): number {
  const [now, setNow] = useState(serverNowMs);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(t);
  }, [tickMs]);
  return now;
}

export function LiveClock({ timeZone, serverNowMs, accent }: { timeZone: string; serverNowMs: number; accent: string }) {
  const [mounted, setMounted] = useState(false);
  const now = useNow(serverNowMs, 15_000);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  const hhmm = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(now));
  return (
    <span className="font-serif font-medium italic" style={{ color: accent }}>
      {" "}&middot; {hhmm}
    </span>
  );
}

export function YourDay({ slots, serverNowMs, accent }: { slots: DaySlot[]; serverNowMs: number; accent: string }) {
  const now = useNow(serverNowMs);
  const firstFuture = slots.find((s) => now < s.startsAtMs)?.id ?? null;

  return (
    <section className="flex flex-col rounded-[14px] border border-border bg-frame">
      <div className="flex items-center justify-between gap-3 px-[18px] pt-4 pb-2">
        <h3 className="font-serif text-[20px] font-semibold text-ink-warm">Your day</h3>
        <span className="text-[12.5px] text-muted">
          {slots.length === 0 ? "Nothing of yours today" : `Named on ${slots.length} today`}
        </span>
      </div>
      <div className="flex flex-col px-2.5 pb-2">
        {slots.map((s) => {
          const st = stateOf(s, now, firstFuture);
          const strong = st === "now";
          return (
            <div
              key={s.id}
              className={`grid grid-cols-[14px_44px_1fr] items-start gap-2.5 rounded-[8px] px-1.5 py-[9px] transition-colors ${st === "done" ? "opacity-50" : ""}`}
              style={{ background: undefined }}
            >
              <span
                className="mt-[5px] size-2 rounded-full border-[1.5px]"
                style={
                  st === "now"
                    ? { background: accent, borderColor: accent }
                    : st === "done"
                      ? { background: "var(--color-muted)", borderColor: "var(--color-muted)" }
                      : { borderColor: "var(--color-muted)" }
                }
              />
              <span className="text-[12px] font-semibold tabular-nums" style={{ color: strong ? accent : "var(--color-muted)" }}>
                {s.time}
              </span>
              <span className="min-w-0">
                <span className="text-[13.5px]" style={strong ? { color: accent, fontWeight: 700 } : undefined}>
                  {s.title}
                </span>
                {st === "now" ? (
                  <span
                    className="ml-2 rounded-full px-1.5 py-[2px] text-[9.5px] font-bold tracking-[0.08em] uppercase"
                    style={{ background: accent, color: "var(--color-primary-foreground)" }}
                  >
                    Now
                  </span>
                ) : st === "next" ? (
                  <span className="ml-2 rounded-full bg-card-inset px-1.5 py-[2px] text-[9.5px] font-bold tracking-[0.08em] text-muted uppercase">
                    Next
                  </span>
                ) : null}
                {st === "now" && s.zoomUrl ? (
                  <a href={s.zoomUrl} target="_blank" rel="noreferrer" className="ml-2 text-[11.5px] font-semibold underline" style={{ color: accent }}>
                    Join
                  </a>
                ) : null}
                {s.sub ? <span className="block text-[11.5px] text-muted">{s.sub}</span> : null}
              </span>
            </div>
          );
        })}
      </div>
      <p className="border-t border-border-faint px-[18px] py-2.5 text-[11.5px] text-muted">
        Only sessions you are named on.{" "}
        <a href="/trainer/timetable" className="underline hover:text-ink">
          Full timetable &rarr;
        </a>
      </p>
    </section>
  );
}
