"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useServerNow } from "@/lib/use-server-now";
import type { StreamDay, StreamSlot } from "@/lib/course-stream-day";
import { CATEGORY_STYLE, type DisplayCategory } from "@/lib/timetable-category-style";

// Course Stream's hero, as the glass tile.
//
// for-claude-code-trainee-workspace-complete.md B4 and Part 5. The hero was a
// headline and two buttons floating on the page background while everything
// below it -- Your day, the timetable, every session card -- wore the
// timetable's glass. The one thing on the page that IS today's lesson looked
// least like it.
//
// Values are Part 5's own: two columns at 1fr / 320px, the card tinted from
// CATEGORY_STYLE (own TP is `rm`, the white glass), a 3px top spine in the
// accent, the start time at 44 beside a countdown, and the live garnet marker
// riding elapsed/duration across the card -- the same marker, from the same
// `now`, as the day track underneath.
//
// Sizes come from the app's type scale rather than Part 5's literals (the
// scale landed after it was written): hero 44, h1 28, meta 12.5, label 11.5,
// micro 10.5.

const JOIN_LEAD_MS = 10 * 60 * 1000;

export interface HeroTeaching {
  /** The timetable row, so the hero and the day track agree on which slot. */
  eventId: string;
  tpNumber: number;
  /** The candidate's letter in the teaching order -- "D" of "TP1 · D". */
  letter: string | null;
  groupName: string | null;
  title: string;
  /** Level, group size, volunteers -- whatever the room already says. */
  meta: string | null;
  planHref: string;
  zoomUrl: string | null;
}

export interface HeroGeneric {
  /** "Before day one", "You teach tomorrow" -- the pill, not a title. */
  label: string;
  big: string;
  bigSub: string | null;
  ctaHref: string;
  ctaLabel: string;
  external?: boolean;
  /** Part 5: a lesson that is not today still gets the time column --
   *  "09:30" under "Tomorrow" -- but never a Join button. */
  time?: { at: string; when: string } | null;
}

function tint(category: DisplayCategory) {
  const s = CATEGORY_STYLE[category];
  return {
    background: `linear-gradient(160deg, ${s.tintFrom}, ${s.tintTo})`,
    accent: s.accent,
  };
}

function countdownLabel(slot: StreamSlot, now: number): { text: string; live: boolean } {
  if (now >= slot.endsAtMs) return { text: "Taught", live: false };
  if (now >= slot.startsAtMs) return { text: "Teaching now", live: true };
  const mins = Math.round((slot.startsAtMs - now) / 60_000);
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return { text: `In ${h} h${m ? ` ${m} min` : ""}`, live: false };
  }
  return { text: `In ${mins} minute${mins === 1 ? "" : "s"}`, live: false };
}

export function StreamHero({
  day,
  serverNowMs,
  teaching,
  generic,
}: {
  day: StreamDay;
  serverNowMs: number;
  teaching: HeroTeaching | null;
  generic: HeroGeneric | null;
}) {
  const [mounted, setMounted] = useState(false);
  const now = useServerNow(serverNowMs);
  useEffect(() => setMounted(true), []);

  const slot = teaching
    ? (day.slots.find((s) => s.id === teaching.eventId) ?? day.slots.find((s) => s.mine) ?? null)
    : null;

  // Part 5: the next non-lunch slot's category decides the side card's tint.
  const upcoming = day.slots.filter((s) => s.category !== "lu" && s.endsAtMs > now && s.id !== slot?.id).slice(0, 3);

  // Two columns only when there is something in the second one. Late in the
  // day every remaining session is behind you, "Next for you" drops, and a
  // hero holding a 320px column of nothing open to its right looked like a
  // card that had failed to load.
  return (
    <div className={`grid items-start gap-[14px] ${upcoming.length > 0 ? "lg:grid-cols-[minmax(0,1fr)_320px]" : ""}`}>
      {slot && teaching ? (
        <TeachingHero slot={slot} teaching={teaching} now={now} mounted={mounted} />
      ) : (
        <GenericHero generic={generic} />
      )}
      {upcoming.length > 0 ? <NextForYou slots={upcoming} /> : null}
    </div>
  );
}

function TeachingHero({
  slot,
  teaching,
  now,
  mounted,
}: {
  slot: StreamSlot;
  teaching: HeroTeaching;
  now: number;
  mounted: boolean;
}) {
  const style = tint(slot.category);
  const { text: countdown, live } = countdownLabel(slot, now);
  const joinable = Boolean(teaching.zoomUrl) && now >= slot.startsAtMs - JOIN_LEAD_MS && now < slot.endsAtMs;
  const over = now >= slot.endsAtMs;
  // The marker crosses the card where the lesson has got to, 8px past the top
  // and bottom edges, with a 10px dot at the top -- Part 5's own values, and
  // the same elapsed/duration the day track uses.
  const elapsed = mounted && live ? Math.min(1, Math.max(0, (now - slot.startsAtMs) / (slot.endsAtMs - slot.startsAtMs))) : null;

  return (
    <div
      className="lift relative rounded-[14px] p-[22px_26px_20px] backdrop-blur-[10px]"
      style={{
        background: style.background,
        border: "1px solid oklch(100% 0 0 / 0.8)",
        borderTop: `3px solid ${style.accent}`,
        boxShadow: "0 10px 28px oklch(23.5% 0.017 65 / 0.09), inset 0 1px 0 oklch(100% 0 0 / 0.85)",
      }}
    >
      {elapsed !== null ? (
        <span
          aria-hidden
          className="pointer-events-none absolute"
          style={{ left: `${elapsed * 100}%`, top: -8, bottom: -8, width: 2, background: "var(--color-garnet)" }}
        >
          <span
            className="absolute rounded-full"
            style={{ top: -4, left: -4, width: 10, height: 10, background: "var(--color-garnet)" }}
          />
        </span>
      ) : null}

      <div className="grid items-center gap-6 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
        <div className="pr-6 sm:border-r" style={{ borderColor: "oklch(23.5% 0.017 65 / 0.1)" }}>
          <p className="font-serif text-hero leading-none font-semibold tabular-nums text-ink-warm">{slot.time}</p>
          <p
            className={`mt-1.5 text-label font-bold tracking-[0.1em] uppercase ${live ? "text-garnet" : "text-muted"}`}
          >
            {mounted ? countdown : " "}
          </p>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-gold px-2.5 py-1 text-micro font-bold tracking-[0.1em] text-ink uppercase">
              You teach
            </span>
            <span className="text-meta font-semibold text-muted">
              TP{teaching.tpNumber}
              {teaching.letter ? ` · ${teaching.letter}` : ""}
              {teaching.groupName ? ` · ${teaching.groupName}` : ""}
            </span>
          </div>
          <h1 className="mt-2 font-serif text-h1 leading-tight font-semibold text-balance text-ink">{teaching.title}</h1>
          {teaching.meta ? <p className="mt-1 text-meta text-muted">{teaching.meta}</p> : null}
        </div>

        <div className="flex shrink-0 flex-col gap-2">
          {joinable && teaching.zoomUrl ? (
            <a
              href={teaching.zoomUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-primary px-4 text-body font-semibold text-primary-foreground"
            >
              <span aria-hidden className="size-1.5 rounded-full bg-gold" />
              Join the room
            </a>
          ) : (
            <span
              className="pointer-events-none inline-flex h-10 items-center rounded-[8px] px-4 text-body font-semibold text-muted"
              style={{ background: "oklch(23.5% 0.017 65 / 0.06)" }}
            >
              {over ? "Room closed" : "Opens 10 min before"}
            </span>
          )}
          <Link
            href={teaching.planHref}
            className="inline-flex h-9 items-center justify-center rounded-[8px] px-4 text-body font-medium text-ink"
            style={{ background: "oklch(100% 0 0 / 0.5)", border: "1px solid oklch(23.5% 0.017 65 / 0.15)" }}
          >
            Open your plan
          </Link>
        </div>
      </div>
    </div>
  );
}

// Every state that is not "you teach today" -- tomorrow, further out, all
// taught, no group yet, before day one, finished. Part 5: the same card in the
// `iw` tint, no time column, one action.
function GenericHero({ generic }: { generic: HeroGeneric | null }) {
  const style = tint("iw");
  return (
    <div
      className="rounded-[14px] p-[22px_26px_20px] backdrop-blur-[10px]"
      style={{
        background: style.background,
        border: "1px solid oklch(100% 0 0 / 0.8)",
        borderTop: `3px solid ${style.accent}`,
        boxShadow: "0 10px 28px oklch(23.5% 0.017 65 / 0.09), inset 0 1px 0 oklch(100% 0 0 / 0.85)",
      }}
    >
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
        {generic?.time ? (
          <div className="shrink-0 pr-6 sm:border-r" style={{ borderColor: "oklch(23.5% 0.017 65 / 0.1)" }}>
            <p className="font-serif text-hero leading-none font-semibold tabular-nums text-ink-warm">
              {generic.time.at}
            </p>
            <p className="mt-1.5 text-label font-bold tracking-[0.1em] text-muted uppercase">{generic.time.when}</p>
          </div>
        ) : null}
        <div className="min-w-0">
          {generic?.label ? (
            <p className="text-label font-bold tracking-[0.1em] text-muted uppercase">{generic.label}</p>
          ) : null}
          <h1 className="mt-1.5 font-serif text-h1 leading-tight font-semibold text-balance text-ink">
            {generic?.big ?? "Your day"}
          </h1>
          {generic?.bigSub ? <p className="mt-1 text-meta text-muted">{generic.bigSub}</p> : null}
        </div>
        {generic ? (
          generic.external ? (
            <a
              href={generic.ctaHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 shrink-0 items-center rounded-[8px] bg-primary px-4 text-body font-semibold text-primary-foreground"
            >
              {generic.ctaLabel}
            </a>
          ) : (
            <Link
              href={generic.ctaHref}
              className="inline-flex h-10 shrink-0 items-center rounded-[8px] bg-primary px-4 text-body font-semibold text-primary-foreground"
            >
              {generic.ctaLabel}
            </Link>
          )
        ) : null}
      </div>
    </div>
  );
}

/** Read-only: what is on after the hero's own session. No lift -- nothing opens. */
function NextForYou({ slots }: { slots: StreamSlot[] }) {
  const style = tint(slots[0].category);
  return (
    <div
      className="rounded-[14px] p-[18px_20px]"
      style={{
        background: style.background,
        border: "1px solid oklch(100% 0 0 / 0.8)",
        borderTop: `3px solid ${style.accent}`,
      }}
    >
      <p className="text-micro font-bold tracking-[0.12em] uppercase" style={{ color: style.accent }}>
        Next for you
      </p>
      <div className="mt-2.5 flex flex-col gap-2.5">
        {slots.map((s) => (
          <div key={s.id} className="grid grid-cols-[44px_minmax(0,1fr)] gap-2">
            <span className="text-meta font-bold tabular-nums text-muted">{s.time}</span>
            <span className="min-w-0">
              <span className="block text-body font-semibold text-ink">{s.title}</span>
              {s.sub ? <span className="block text-label text-muted">{s.sub}</span> : null}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
