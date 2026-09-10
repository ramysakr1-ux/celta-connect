"use client";

import { useServerNow } from "@/lib/use-server-now";
import { useEffect, useState } from "react";
import type { StreamDay, StreamSlot } from "@/lib/course-stream-day";

// Course Stream's hour hand.
//
// design_handoff_trainee_landing: "The clock drives everything. One `now` value
// produces the greeting, the countdown copy, every session's done/now/next/
// later state, and the marker position. Never compute these independently --
// they must agree."
//
// Hydration, exactly as your-day.tsx solved it for the trainer hub: the server
// and the browser will never agree on the minute, and a value that differs
// between them is a mismatch. So the first paint uses the instant the SERVER
// rendered at, which both sides compute identically, and only after mount does
// the browser take over and tick. The clock in the eyebrow starts blank for the
// same reason.

type State = "done" | "now" | "next" | "later";


/** The same window isEventLive uses everywhere else: the door opens ten
 *  minutes before the session and closes when it ends. A join link that
 *  appears at a different moment from the timetable's own is worse than none. */
const JOIN_LEAD_MS = 10 * 60 * 1000;
function joinableNow(slot: StreamSlot, nowMs: number): boolean {
  return Boolean(slot.zoomUrl) && nowMs >= slot.startsAtMs - JOIN_LEAD_MS && nowMs < slot.endsAtMs;
}

function stateOf(slot: StreamSlot, nowMs: number, firstFutureId: string | null): State {
  if (nowMs >= slot.endsAtMs) return "done";
  if (nowMs >= slot.startsAtMs) return "now";
  return slot.id === firstFutureId ? "next" : "later";
}

/** The eyebrow above the hero title: greeting, date, live clock. */
export function StreamEyebrow({
  firstName,
  dateLabel,
  serverNowMs,
  timeZone,
}: {
  firstName: string;
  dateLabel: string;
  serverNowMs: number;
  timeZone: string;
}) {
  const [mounted, setMounted] = useState(false);
  const now = useServerNow(serverNowMs);
  useEffect(() => setMounted(true), []);

  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hour12: false }).format(new Date(now))
  );
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const clock = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(
    new Date(now)
  );

  return (
    <p className="text-[11px] font-bold tracking-[0.14em] text-muted uppercase">
      {greeting}, {firstName} &middot; {dateLabel}
      {mounted ? <> &middot; <span className="tabular-nums">{clock}</span></> : null}
    </p>
  );
}

/** "Your day" -- the meta line, the track, the live marker, the axis. */
export function StreamDayTrack({
  day,
  serverNowMs,
  timeZone,
  meta,
}: {
  day: StreamDay;
  serverNowMs: number;
  /** The centre's zone. The marker's own clock label read the BROWSER's zone
   *  before this existed, so it disagreed with the eyebrow directly above it
   *  by however many hours the reader happened to be from the centre. */
  timeZone: string;
  /** The right-hand line: "You teach 10:00", or "Not teaching today · next TP5 Friday". */
  meta: { lead: string; countdownFor: string | null };
}) {
  const [mounted, setMounted] = useState(false);
  const now = useServerNow(serverNowMs);
  useEffect(() => setMounted(true), []);

  // windowStart/windowEnd are not read here any more: placing blocks by
  // percentage went out with the equal boxes, and the axis labels arrive
  // already formatted. The header's bar is what still draws to the minute.
  const { slots, axis } = day;
  const firstFuture = slots.find((s) => now < s.startsAtMs)?.id ?? null;

  const mine = slots.find((s) => s.mine) ?? null;
  const countdown = (() => {
    if (!meta.countdownFor || !mine) return null;
    if (now >= mine.endsAtMs) return "taught";
    if (now >= mine.startsAtMs) return "teaching now";
    const mins = Math.round((mine.startsAtMs - now) / 60_000);
    if (mins >= 60) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `in ${h} h${m ? ` ${m} min` : ""}`;
    }
    return `in ${mins} minute${mins === 1 ? "" : "s"}`;
  })();

  // With equal boxes the track is a sequence, so the marker sits on the seam
  // between what is finished and what is not, rather than at a pixel that no
  // longer means a time. The header's bar keeps the real clock position.
  const doneCount = slots.filter((s) => now >= s.endsAtMs).length;
  const markerPct = slots.length > 0 ? (doneCount / slots.length) * 100 : 0;
  const showMarker = mounted && doneCount > 0 && doneCount < slots.length;

  return (
    <section className="flex flex-col">
      <div className="mb-2.5 flex items-baseline justify-between gap-4">
        <span className="text-[10.5px] font-bold tracking-[0.14em] text-muted uppercase">Your day</span>
        <span className="text-[12.5px] text-muted">
          {meta.lead}
          {countdown ? ` · ${countdown}` : null}
        </span>
      </div>

      {slots.length === 0 ? (
        <p className="rounded-[8px] border border-border bg-card-inset px-4 py-6 text-center text-[13px] text-muted">
          Nothing timetabled for you today.
        </p>
      ) : (
        <>
          {/* Ramy, 10 Sep 2026: "those boxes should be more of a box really,
              maybe with a nice curve. And same size, a little bigger, same
              size. So they don't change size."

              So the track stops being a timeline and becomes a sequence: equal
              boxes, evenly spaced, 104px tall, properly rounded. A 30-minute
              session no longer renders half the width of an hour-long one and
              gets squeezed out of legibility.

              Nothing is lost by it -- the header's day bar is the proportional
              timeline now, drawn to the minute from the same rows, so between
              the two the day reads both ways: how long things are up top, and
              what they actually say down here. */}
          {/* Below lg the row becomes a list. Seven equal boxes on a 375px
              phone are 45px wide -- "10:00" clipped to "10:0" and "TP8 · D"
              running one letter per line, measured on production 10 Sep 2026.
              Nothing is lost by stacking: the header's bar is the proportional
              day now, so down here the boxes are a sequence of what the day
              SAYS, and a sequence reads down a phone as happily as across a
              desktop. It also makes the box a real target -- the whole box is
              the Zoom door when a session is live, and on a phone that is
              exactly where someone would tap it.

              lg, not md: the workspace rail comes back at md and takes 190px
              off the content column, so 768-1023 is the WORST width for the
              row -- 68px a box, "TP8 - D" over three lines. Stacked is right
              for the whole of that band too. */}
          <div className="relative flex flex-col gap-1.5 lg:h-[104px] lg:flex-row">
            {slots.map((s) => {
              const st = stateOf(s, now, firstFuture);
              const gold = s.mine && st !== "done";
              const lit = gold && (st === "now" || st === "next");
              // Ramy, 10 Sep 2026: "can we make it on the actual bar itself? So
              // TP8 B, if they click on it, and then they join Zoom." A pill
              // inside the box asked people to find a small target inside a
              // large one that already looked like the thing. The whole box is
              // the door while the session is joinable.
              const joinable = joinableNow(s, now);
              const Box = joinable ? "a" : "div";
              return (
                <Box
                  key={s.id}
                  {...(joinable
                    ? { href: s.zoomUrl!, target: "_blank", rel: "noreferrer", title: `Join ${s.title}` }
                    : {})}
                  className={`flex min-w-0 items-center gap-3 overflow-hidden rounded-[10px] px-3 py-2.5 lg:flex-1 lg:flex-col lg:items-stretch lg:gap-[3px] ${
                    st === "done" ? "opacity-50" : ""
                  } ${joinable ? "cursor-pointer transition-shadow hover:brightness-[1.06]" : ""}`}
                  style={{
                    // Ramy, 10 Sep 2026: "the box where you are... will have a
                    // ring around it, a garnet ring. And the box itself will
                    // change colour and become a little bit dark, same colour
                    // as the header." So the session you are in is the one dark
                    // object on a light page, tied to the header by sharing its
                    // fill -- the two ends of the same "now".
                    background: st === "now"
                      ? "var(--color-ink-warm)"
                      : gold
                        ? "color-mix(in oklab, var(--color-gold) 22%, var(--color-card))"
                        // Ramy, 10 Sep 2026: "they're almost the same colour
                        // [as the background]... make them a little bit darker,
                        // not as dark as TP8 B, but a bit darker, so you can
                        // see a contrast." --color-card-inset is 93% lightness
                        // against a 97.8% frame -- under five points, which
                        // mushes. Mixed toward ink-warm it lands near 88.5%:
                        // clearly a card, nowhere near the now-box's 30%.
                        : "color-mix(in oklab, var(--color-ink-warm) 7%, var(--color-card-inset))",
                    border: st === "now"
                      ? "1.5px solid var(--color-garnet)"
                      : gold
                        ? "1.5px solid var(--color-gold)"
                        : "1px solid var(--color-border)",
                    boxShadow:
                      st === "now"
                        ? "0 0 0 3px color-mix(in oklab, var(--color-garnet) 22%, transparent)"
                        : lit
                          ? "0 2px 10px color-mix(in oklab, var(--color-gold) 22%, transparent)"
                          : undefined,
                  }}
                >
                  {/* Stacked, the time is a fixed gutter so every title starts
                      at the same x, and the Now/Next badge drops beneath it
                      rather than shunting the title along on one row out of
                      seven. Back to one inline line from lg up. */}
                  <span
                    className="flex w-[52px] shrink-0 flex-col items-start gap-1 text-[11px] font-bold tabular-nums lg:w-auto lg:flex-row lg:items-center lg:gap-1.5"
                    style={{
                      color:
                        st === "now"
                          ? "var(--color-garnet-lift)"
                          : gold
                            ? "var(--color-gold-ink)"
                            : "var(--color-muted)",
                    }}
                  >
                    {s.time}
                    {st === "now" ? (
                      <span
                        className="rounded-full px-1.5 py-px text-[9px] font-bold tracking-[0.08em] uppercase"
                        style={{ background: "var(--color-garnet)", color: "oklch(98.5% 0.006 90)" }}
                      >
                        Now
                      </span>
                    ) : st === "next" ? (
                      <span
                        className="rounded-full bg-frame px-1.5 py-px text-[9px] font-bold tracking-[0.08em] uppercase"
                        style={{ color: "var(--color-gold-ink)" }}
                      >
                        Next
                      </span>
                    ) : null}
                  </span>
                  {/* `lg:contents` dissolves this wrapper from lg up, so the
                      title and the sub-line go back to being direct children of
                      the box and the desktop column is byte-for-byte what it
                      was. Stacked, they are the second half of the row. */}
                  <span className="flex min-w-0 flex-1 flex-col gap-[3px] lg:contents">
                  <span
                    className={`leading-tight ${gold ? "text-[14px] font-bold" : st === "now" ? "text-[12px] font-bold" : "text-[12px]"}`}
                    style={{
                      color:
                        st === "now"
                          ? "oklch(94% 0.012 86)"
                          : st === "done"
                            ? "var(--color-muted)"
                            : "var(--color-ink)",
                    }}
                  >
                    {s.title}
                  </span>
                  {/* Ramy, 10 Sep 2026: "the join the room, which is the Zoom
                      link -- I don't see it anywhere." It was on the hero and
                      nowhere else, and only for the trainee's OWN TP: every
                      other session on the day carried a zoom_url that nothing
                      rendered, so an online course had a timetable you could
                      read and not enter. Same treatment as the trainer hub's
                      own your-day.tsx, on whichever block is actually live. */}
                  {joinable ? (
                    <span
                      className="w-fit rounded-full px-1.5 py-px text-[10px] font-bold tracking-[0.06em] uppercase"
                      style={{ background: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
                    >
                      Join
                    </span>
                  ) : s.sub ? (
                    <span
                      className="text-[11px] leading-tight"
                      style={{ color: st === "now" ? "oklch(78% 0.02 80)" : "var(--color-muted)" }}
                    >
                      {s.sub}
                    </span>
                  ) : null}
                  </span>
                </Box>
              );
            })}

            {showMarker ? (
              <span
                aria-hidden
                // The seam marker is a horizontal idea -- it sits between the
                // boxes that are finished and the ones that are not. Stacked
                // there is no seam to sit on, and the day already reads
                // top-to-bottom with the done rows dimmed and the ring on the
                // one you are in, so it stays off below lg.
                className="pointer-events-none absolute -top-1.5 -bottom-1.5 hidden w-0.5 lg:block"
                style={{ left: `${markerPct}%`, background: "var(--color-garnet)" }}
              >
                <span
                  className="absolute -top-1 -left-1 size-2.5 rounded-full"
                  style={{ background: "var(--color-garnet)" }}
                />
                <span
                  className="absolute -bottom-[18px] text-[10.5px] font-bold tabular-nums whitespace-nowrap"
                  style={{
                    color: "var(--color-garnet)",
                    // Clamped at both ends so the label never hangs outside the track.
                    transform: `translateX(${-22 - ((markerPct - 50) / 50) * 22}px)`,
                  }}
                >
                  {new Intl.DateTimeFormat("en-GB", {
                    timeZone,
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  }).format(new Date(now))}
                </span>
              </span>
            ) : null}
          </div>

          {/* The 25px is headroom for the marker's clock label, which hangs
              below the track. No marker below lg, so no headroom needed. */}
          <div className="mt-3 flex justify-between border-t border-border pt-1.5 text-[11px] tabular-nums text-muted lg:mt-[25px]">
            {axis.map((a) => (
              <span key={a}>{a}</span>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
