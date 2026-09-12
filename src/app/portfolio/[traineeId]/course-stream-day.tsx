"use client";

import { useServerNow } from "@/lib/use-server-now";
import { useEffect, useState } from "react";
import type { StreamDay, StreamSlot } from "@/lib/course-stream-day";
import { CATEGORY_STYLE } from "@/lib/timetable-category-style";

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

/** The same window isEventLive uses everywhere else: the door opens ten
 *  minutes before the session and closes when it ends. A join link that
 *  appears at a different moment from the timetable's own is worse than none. */
const JOIN_LEAD_MS = 10 * 60 * 1000;
function joinableNow(slot: StreamSlot, nowMs: number): boolean {
  return Boolean(slot.zoomUrl) && nowMs >= slot.startsAtMs - JOIN_LEAD_MS && nowMs < slot.endsAtMs;
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
  heading = "Your day",
}: {
  day: StreamDay;
  serverNowMs: number;
  /** The centre's zone. The marker's own clock label read the BROWSER's zone
   *  before this existed, so it disagreed with the eyebrow directly above it
   *  by however many hours the reader happened to be from the centre. */
  timeZone: string;
  /** The right-hand line: "You teach 10:00", or "Not teaching today · next TP5 Friday". */
  meta: { lead: string; countdownFor: string | null };
  /** "Your day" by default; "Your next day · Monday 14 September" when today has nothing on. */
  heading?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const now = useServerNow(serverNowMs);
  useEffect(() => setMounted(true), []);

  // windowStart/windowEnd/axis are not read here any more: placing blocks by
  // percentage went out with the equal boxes, and the axis numbers went with
  // the fixed-width boxes below (a "10:00 ... 18:00" spread under boxes that
  // are not a timeline was a lie in both directions). The header's bar is
  // what still draws to the minute.
  const { slots } = day;

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

  // The garnet marker is the only thing on this track that moves. Ramy, 11 Sep
  // 2026: "the garnet bar moving across, sort of stopping where the time of day
  // is." It rides the real clock -- gliding across whichever box is live in
  // proportion to how far through that session we are, and resting on the seam
  // before the next box during the gaps (lunch, breaks). The boxes are a fixed
  // width and wrap, so the marker is anchored to a BOX (which one, and how far
  // across it), never to the row: it is always where the live session is,
  // whichever row that box landed on.
  //
  // It never leaves. Ramy, 12 Sep 2026: "even if there's nothing on Saturday,
  // the bar should still be there ... parked either at the end of the day or at
  // the beginning of the next day. It should not disappear." Before the first
  // session it waits on the first box's left edge; after the last it rests on
  // the last box's right edge. The clock under it is still now.
  const marker = (() => {
    if (!mounted || slots.length === 0) return null;
    if (now < slots[0].startsAtMs) return { index: 0, frac: 0 };
    for (let i = 0; i < slots.length; i += 1) {
      const s = slots[i];
      if (now < s.startsAtMs) return { index: i, frac: 0 }; // in the gap before box i
      if (now < s.endsAtMs) return { index: i, frac: (now - s.startsAtMs) / (s.endsAtMs - s.startsAtMs) };
    }
    return { index: slots.length - 1, frac: 1 };
  })();
  const clockLabel = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(now));

  return (
    <section className="flex flex-col">
      <div className="mb-2.5 flex items-baseline justify-between gap-4">
        <span className="text-[10.5px] font-bold tracking-[0.14em] text-muted uppercase">{heading}</span>
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

              So the track stops being a timeline and becomes a sequence: boxes
              of ONE fixed size, 128 x 104, properly rounded. A 30-minute
              session no longer renders half the width of an hour-long one --
              and, since 12 Sep 2026, a nine-session Monday no longer renders
              every box two-thirds the width of a six-session Friday either
              ("why are they squashed? We agreed they would be the same size").
              Equal-within-a-day was still a size that changed with the day;
              a fixed width holds, and a day with more boxes than fit the row
              wraps onto a second row. The rows are spaced for the marker's
              clock label to hang under a box on the first row.

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
          <div className="flex flex-col gap-1.5 lg:flex-row lg:flex-wrap lg:gap-x-1.5 lg:gap-y-7 lg:pb-[22px]">
            {slots.map((s, i) => {
              const cat = CATEGORY_STYLE[s.category];
              const marked = marker !== null && marker.index === i;
              // Ramy, 10 Sep 2026: "can we make it on the actual bar itself? So
              // TP8 B, if they click on it, and then they join Zoom." The whole
              // box is the door while the session is joinable.
              const joinable = joinableNow(s, now);
              const Box = joinable ? "a" : "div";
              return (
                <div key={s.id} className="relative lg:w-[128px] lg:flex-none">
                <Box
                  {...(joinable
                    ? { href: s.zoomUrl!, target: "_blank", rel: "noreferrer", title: `Join ${s.title}` }
                    : {})}
                  className={`flex min-w-0 items-center gap-3 overflow-hidden rounded-[10px] px-3 py-2.5 lg:h-[104px] lg:flex-col lg:items-stretch lg:gap-[3px] ${
                    joinable ? "cursor-pointer transition-shadow hover:brightness-[1.04]" : ""
                  }`}
                  style={{
                    // The same glass card as the 4-week timetable grid: a
                    // category tint, a white glass border with a coloured spine
                    // on top, the same blur and lift. Ramy, 11 Sep 2026 -- the
                    // day track "is basically the timetable of the day... it
                    // should be the same, the same coloration and everything",
                    // so the box that says "TP7" here and the box that says
                    // "TP7" on the grid are one object now, read from one style
                    // map (timetable-category-style.ts). And no per-time fill:
                    // the boxes hold still all day. The dark-brown "now" box
                    // that used to crawl across the row is gone -- the garnet
                    // marker below is the only thing that moves.
                    backdropFilter: "blur(10px)",
                    background: `linear-gradient(180deg, ${cat.tintFrom}, ${cat.tintTo})`,
                    border: "1px solid oklch(100% 0 0 / 0.75)",
                    borderTop: `2.5px solid ${cat.accent === "transparent" ? "oklch(88% 0.016 82)" : cat.accent}`,
                    boxShadow: "0 6px 18px oklch(23.5% 0.017 65 / 0.07), inset 0 1px 0 oklch(100% 0 0 / 0.8)",
                  }}
                >
                  {/* Stacked, the time is a fixed gutter so every title starts
                      at the same x. One inline line from lg up. */}
                  <span className="flex w-[52px] shrink-0 flex-col items-start gap-1 text-[11px] font-bold tabular-nums text-muted lg:w-auto lg:flex-row lg:items-center lg:gap-1.5">
                    {s.time}
                  </span>
                  {/* `lg:contents` dissolves this wrapper from lg up, so the
                      title and the sub-line go back to being direct children of
                      the box. Stacked, they are the second half of the row. */}
                  <span className="flex min-w-0 flex-1 flex-col gap-[3px] lg:contents">
                  <span
                    className="text-[12px] leading-tight text-ink"
                    style={{ fontWeight: cat.titleWeight }}
                  >
                    {s.title}
                  </span>
                  {/* Ramy, 10 Sep 2026: "the join the room, which is the Zoom
                      link -- I don't see it anywhere." The whole box is the
                      door when a session is joinable; otherwise the trainee's
                      own TP wears the timetable's "You teach" pill, and every
                      other box shows its room/level sub-line. */}
                  {joinable ? (
                    <span
                      className="w-fit rounded-full px-1.5 py-px text-[10px] font-bold tracking-[0.06em] uppercase"
                      style={{ background: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
                    >
                      Join
                    </span>
                  ) : s.mine ? (
                    <span className="pill pill-neutral w-fit text-[9px]">You teach</span>
                  ) : s.sub ? (
                    <span className="text-[11px] leading-tight text-muted">{s.sub}</span>
                  ) : null}
                  </span>
                </Box>

                {marked ? (
                  <span
                    aria-hidden
                    // The seam marker is a horizontal idea -- it sits between
                    // the boxes that are finished and the ones that are not.
                    // Stacked there is no seam to sit on, and the day already
                    // reads top-to-bottom, so it stays off below lg.
                    className="pointer-events-none absolute -top-1.5 -bottom-1.5 hidden w-0.5 lg:block"
                    style={{ left: `${marker!.frac * 100}%`, background: "var(--color-garnet)" }}
                  >
                    <span
                      className="absolute -top-1 -left-1 size-2.5 rounded-full"
                      style={{ background: "var(--color-garnet)" }}
                    />
                    <span
                      className="absolute -bottom-[18px] text-[10.5px] font-bold tabular-nums whitespace-nowrap"
                      style={{
                        color: "var(--color-garnet)",
                        // Slides from left-aligned to right-aligned across the
                        // box, so at either edge it never hangs outside it.
                        transform: `translateX(${-marker!.frac * 100}%)`,
                      }}
                    >
                      {clockLabel}
                    </span>
                  </span>
                ) : null}
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
