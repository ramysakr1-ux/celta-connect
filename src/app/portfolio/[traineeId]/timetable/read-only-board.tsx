"use client";

import { useMemo, useState } from "react";
import { buildDayRows, bandIndexFor, categorize, isEventLive, type CellCategory, type DayRow, type TimeBand, type TimetableEvent } from "@/lib/timetable-grid";

// for-claude-code-timetable-view.md -- read-only 4-week glass-card board,
// shared by trainee and staff-preview viewers of a trainee's portfolio
// timetable. Reuses the same buildDayRows()/isEventLive() the trainer's own
// editable grid uses (timetable-grid.ts), so this never invents its own
// notion of "what's scheduled" -- only how it's presented.

type DisplayCategory = "wg" | "rm" | "admin" | "iw" | "lu";

// The spec's own 5-bucket model has no separate "consultation" category --
// `cs` (split out from `rm` elsewhere in the app, see timetable-grid.ts)
// folds back into `iw` here ("Individual / bookable (consultations,
// own-time writing, Stage 3)" -- the spec's own wording).
function toDisplayCategory(cat: CellCategory): DisplayCategory {
  return cat === "cs" ? "iw" : cat;
}

const CATEGORY_STYLE: Record<DisplayCategory, { accent: string; tintFrom: string; tintTo: string; label: string; titleWeight: number }> = {
  wg: {
    accent: "oklch(38% 0.072 195)",
    tintFrom: "oklch(95.5% 0.03 195 / 0.75)",
    tintTo: "oklch(95.5% 0.03 195 / 0.35)",
    label: "Whole group — Zoom input",
    titleWeight: 500,
  },
  rm: {
    accent: "oklch(23.5% 0.017 65)",
    tintFrom: "oklch(100% 0 0 / 0.92)",
    tintTo: "oklch(100% 0 0 / 0.55)",
    label: "Group room — TP, feedback, planning",
    titleWeight: 600,
  },
  admin: {
    // Ramy's design file (29 Aug 2026) uses gold here, and gold is what the
    // 2026-08-21 colour audit had re-pointed to amber. His file is the
    // authority for this screen, so gold it is -- the legend swatch and the
    // card spine both read from this one value, so they cannot disagree.
    accent: "oklch(60% 0.11 70)",
    tintFrom: "oklch(96% 0.045 80 / 0.75)",
    tintTo: "oklch(96% 0.045 80 / 0.35)",
    label: "Admin & deadlines",
    titleWeight: 500,
  },
  iw: {
    accent: "oklch(51% 0.017 70)",
    tintFrom: "oklch(96% 0.008 85 / 0.6)",
    tintTo: "oklch(96% 0.008 85 / 0.25)",
    label: "Individual · bookable",
    titleWeight: 500,
  },
  lu: {
    accent: "transparent",
    tintFrom: "oklch(96% 0.008 85 / 0.35)",
    tintTo: "oklch(96% 0.008 85 / 0.15)",
    label: "Lunch",
    titleWeight: 400,
  },
};

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-3" stroke="currentColor" fill="none" strokeWidth={1.8} aria-hidden="true">
      <path d="M23 7l-7 5 7 5V7z" />
      <rect x="1" y="5" width="15" height="14" rx="2.5" />
    </svg>
  );
}

interface WeekGroup {
  label: string;
  rows: DayRow[];
}

function groupIntoWeeks(rows: DayRow[]): WeekGroup[] {
  const weeks: WeekGroup[] = [];
  for (const row of rows) {
    if (row.weekLabel || weeks.length === 0) {
      weeks.push({ label: row.weekLabel ?? `Week ${weeks.length + 1}`, rows: [] });
    }
    weeks[weeks.length - 1].rows.push(row);
  }
  return weeks;
}

export interface EventMeta {
  mine: boolean;
  ownTpSlot: boolean;
  teachingLetters: string | null;
  // Ramy, 25 Aug 2026: "the trainers should show how many volunteers are...
  // attending" -- aggregate count only, no names (names are a centre-admin
  // concern, not a trainer/trainee one). Undefined/null where the course has
  // no volunteers at all, so the row just doesn't render rather than
  // showing "0 of 0".
  volunteerAttendance?: { expected: number; total: number } | null;
}

export interface ReadOnlyBoardProps {
  events: TimetableEvent[];
  eventMeta: Record<string, EventMeta>;
  timeBands: TimeBand[];
  viewerName: string;
  viewerGroupLabel: string | null;
  today: string;
  nowIso: string;
  timeZone: string;
}

const EMPTY_META: EventMeta = { mine: true, ownTpSlot: false, teachingLetters: null };

export function ReadOnlyTimetableBoard({
  events,
  eventMeta,
  timeBands,
  viewerName,
  viewerGroupLabel,
  today,
  nowIso,
  timeZone,
}: ReadOnlyBoardProps) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const dayRows = useMemo(() => buildDayRows(events, timeBands), [events, timeBands]);
  const weeks = useMemo(() => groupIntoWeeks(dayRows), [dayRows]);
  const initialWeek = Math.max(
    0,
    weeks.findIndex((w) => w.rows.some((r) => r.isoDate >= today))
  );
  const [weekIndex, setWeekIndex] = useState(initialWeek === -1 ? 0 : initialWeek);
  const [mineOnly, setMineOnly] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<TimetableEvent | null>(null);

  const week = weeks[weekIndex] ?? weeks[0];
  const liveEvent = events.find((e) => isEventLive(e, now, timeZone)) ?? null;
  // for-claude-code-timetable-view.md: "time range + 'opened HH:MM'" -- opened
  // is the join-window's own start (isEventLive's -10min), the range's end is
  // the event's time band boundary, not a stored field on the event itself.
  // Ramy, 28 Aug 2026: this used to build a Date via new Date(0).setHours(),
  // which reads back in the VIEWER's own local timezone, not the centre's --
  // event_time is already the centre's own wall-clock "HH:MM", so this is
  // just HH:MM arithmetic now, no Date/timezone conversion needed at all.
  const liveEventTimes = liveEvent?.event_time
    ? (() => {
        const [h, m] = liveEvent.event_time!.split(":").map(Number);
        const totalMin = ((h * 60 + m - 10) % 1440 + 1440) % 1440;
        const pad = (n: number) => String(n).padStart(2, "0");
        const band = timeBands[bandIndexFor(liveEvent.event_time, timeBands)];
        return { opened: `${pad(Math.floor(totalMin / 60))}:${pad(totalMin % 60)}`, end: band?.end };
      })()
    : null;

  const initials = viewerName
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">Connect · Timetable</p>
          <h1 className="font-serif text-2xl text-ink">{week ? `Week ${weekIndex + 1} · ${week.label}` : "Nothing scheduled yet"}</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
              {initials || "?"}
            </span>
            <span className="text-sm text-ink">
              {viewerName}
              {viewerGroupLabel ? <span className="text-muted"> · {viewerGroupLabel}</span> : null}
            </span>
          </div>
          <div className="flex rounded-full border border-border p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setMineOnly(false)}
              className={`rounded-full px-3 py-1 font-medium transition-colors ${!mineOnly ? "bg-primary text-primary-foreground" : "text-muted"}`}
            >
              Everything
            </button>
            <button
              type="button"
              onClick={() => setMineOnly(true)}
              className={`rounded-full px-3 py-1 font-medium transition-colors ${mineOnly ? "bg-primary text-primary-foreground" : "text-muted"}`}
            >
              Mine
            </button>
          </div>
        </div>
      </div>

      {liveEvent ? (
        <div className="flex items-center justify-between gap-3 rounded-[10px] px-4 py-3 text-primary-foreground" style={{ background: "oklch(38% 0.072 195)" }}>
          <div className="flex items-center gap-3">
            <span className="size-2 shrink-0 animate-pulse rounded-full" style={{ background: "oklch(63% 0.096 72)" }} />
            <span className="text-[11px] font-semibold tracking-[0.08em] uppercase">Live now</span>
            <span className="text-sm font-medium">{liveEvent.title}</span>
            {liveEvent.event_time ? (
              <span className="text-xs opacity-80">
                {liveEvent.event_time.slice(0, 5)}
                {liveEventTimes?.end ? ` – ${liveEventTimes.end}` : ""}
                {liveEventTimes?.opened ? ` · opened ${liveEventTimes.opened}` : ""}
              </span>
            ) : null}
          </div>
          {liveEvent.zoom_url ? (
            <a
              href={liveEvent.zoom_url}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold text-ink"
              style={{ background: "oklch(63% 0.096 72)" }}
            >
              Join
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap justify-end gap-4 text-[11px] text-muted">
        {(Object.keys(CATEGORY_STYLE) as DisplayCategory[]).map((cat) => (
          <span key={cat} className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-[3px]" style={{ background: CATEGORY_STYLE[cat].accent || "oklch(88% 0.016 82)" }} />
            {CATEGORY_STYLE[cat].label}
          </span>
        ))}
      </div>

      {/* Desktop board. Columns, row height and padding are the design
          file's own values, not approximations -- 64px gutter, 150px admin
          column, nine bands at a 118px floor that stretch to fill. Hidden
          below 900px, where the day list takes over. */}
      <div
        className="hidden overflow-x-auto rounded-[14px] min-[900px]:block"
        style={{
          padding: "4px 16px 12px",
          border: "1px solid oklch(88% 0.016 82)",
          background:
            "linear-gradient(135deg, oklch(97% 0.02 190 / 0.5), oklch(97.5% 0.018 85 / 0.6) 45%, oklch(96% 0.025 70 / 0.4))",
        }}
      >
        <table className="w-full min-w-[900px] border-separate" style={{ borderSpacing: "6px" }}>
          <thead>
            <tr>
              <th className="w-16" />
              <th className="w-[150px] p-2 text-left text-[10px] font-semibold tracking-[0.08em] text-muted uppercase">Admin</th>
              {timeBands.map((band) => (
                <th key={band.label} className="min-w-[118px] p-2 text-left text-[10px] font-semibold tracking-[0.08em] text-muted uppercase">
                  {band.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(week?.rows ?? []).map((row) => {
              const isToday = row.isoDate === today;
              return (
                <tr key={row.isoDate}>
                  <td className={`align-top p-2 ${isToday ? "border-l-[3px] border-primary" : ""}`}>
                    <p className="font-serif text-lg text-ink">{row.date.split(" ")[1]}</p>
                    <p className="text-[10px] font-semibold tracking-[0.06em] text-muted uppercase">{row.weekday}</p>
                    {isToday ? <p className="text-[10px] font-semibold text-primary uppercase">Today</p> : null}
                  </td>
                  <td className="align-top">
                    <Cell events={row.admin} eventMeta={eventMeta} now={now} timeZone={timeZone} mineOnly={mineOnly} onSelect={setSelectedEvent} />
                  </td>
                  {row.bands.map((bandEvents, i) => (
                    <td key={i} className="align-top">
                      <Cell events={bandEvents} eventMeta={eventMeta} now={now} timeZone={timeZone} mineOnly={mineOnly} onSelect={setSelectedEvent} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile. The design is a 1280px grid; below 900px that is a sideways
          scroll nobody reads, so the same week renders as a day list -- same
          categories, same colours, same live bar and lens, time band moved
          from a column header onto each row since there are no columns left
          to head. In "Mine" it HIDES rather than dims: on a grid a faded
          tile still says "something is here", on a phone it only costs the
          scarcest thing there is, which is vertical space. */}
      <div className="flex flex-col gap-3 min-[900px]:hidden">
        {(week?.rows ?? []).map((row) => {
          const isToday = row.isoDate === today;
          const rowItems: { band: string; event: TimetableEvent }[] = [
            ...row.admin.map((e) => ({ band: "Admin", event: e })),
            ...row.bands.flatMap((bandEvents, i) =>
              bandEvents.map((e) => ({ band: timeBands[i]?.label ?? "", event: e }))
            ),
          ];
          const visible = rowItems.filter(({ event }) => !mineOnly || (eventMeta[event.id] ?? EMPTY_META).mine);
          if (visible.length === 0) return null;
          return (
            <div
              key={row.isoDate}
              className="overflow-hidden rounded-[12px] border border-border bg-frame"
              style={isToday ? { boxShadow: "inset 3px 0 0 oklch(38% 0.072 195)" } : undefined}
            >
              <div className="flex items-baseline gap-2 border-b border-border-faint px-3.5 py-2.5">
                <span className={`font-serif text-lg ${isToday ? "text-primary" : "text-ink"}`}>{row.date.split(" ")[1]}</span>
                <span className="text-[9px] font-semibold tracking-[0.12em] text-muted uppercase">{row.weekday}</span>
                {isToday ? (
                  <span className="text-[8.5px] font-semibold tracking-[0.1em] text-primary uppercase">Today</span>
                ) : null}
              </div>
              {visible.map(({ band, event }) => {
                const cat = toDisplayCategory(categorize(event));
                const style = CATEGORY_STYLE[cat];
                const meta = eventMeta[event.id] ?? EMPTY_META;
                const live = isEventLive(event, now, timeZone);
                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => setSelectedEvent(event)}
                    className="flex w-full items-start gap-3 border-b border-border-faint px-3.5 py-2.5 text-left last:border-b-0"
                    style={{ borderLeft: `3px solid ${style.accent === "transparent" ? "oklch(88% 0.016 82)" : style.accent}` }}
                  >
                    <span className="w-[74px] shrink-0 pt-0.5 text-[10px] font-semibold text-muted">{band}</span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-[12.5px] text-ink" style={{ fontWeight: style.titleWeight }}>
                        {event.title}
                      </span>
                      {meta.teachingLetters ? (
                        <span className="text-[10.5px] text-muted">{meta.teachingLetters}</span>
                      ) : null}
                      {mineOnly && meta.ownTpSlot ? (
                        <span
                          className="mt-0.5 self-start rounded-full px-2 py-0.5 text-[9px] font-bold tracking-[0.06em] uppercase"
                          style={{ background: "oklch(60% 0.11 70 / 0.18)", color: "oklch(45% 0.09 70)" }}
                        >
                          You teach
                        </span>
                      ) : null}
                    </span>
                    {event.zoom_url ? (
                      <span
                        className="flex size-[26px] shrink-0 items-center justify-center self-center rounded-full"
                        style={
                          live
                            ? { background: "oklch(38% 0.072 195)", color: "oklch(98.5% 0.006 90)" }
                            : { background: "oklch(38% 0.072 195 / 0.1)", color: "oklch(38% 0.072 195 / 0.6)" }
                        }
                      >
                        <CameraIcon />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="flex justify-center gap-2">
        {weeks.map((w, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setWeekIndex(i)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold ${
              i === weekIndex ? "bg-primary text-primary-foreground" : "border border-border text-muted trainee-hover-fill"
            }`}
          >
            Week {i + 1}
          </button>
        ))}
      </div>

      {selectedEvent ? (
        <DetailPanel event={selectedEvent} onClose={() => setSelectedEvent(null)} meta={eventMeta[selectedEvent.id] ?? EMPTY_META} />
      ) : null}

      <p className="text-center text-[11px] text-muted">
        Read-only -- ask your tutor to change anything here. &quot;Mine&quot; hides sessions that don&apos;t involve you; it never removes anything from the real schedule.
      </p>
    </div>
  );
}

function Cell({
  events,
  eventMeta,
  now,
  timeZone,
  mineOnly,
  onSelect,
}: {
  events: TimetableEvent[];
  eventMeta: Record<string, EventMeta>;
  now: Date;
  timeZone: string;
  mineOnly: boolean;
  onSelect: (event: TimetableEvent) => void;
}) {
  if (events.length === 0) return null;

  // Ramy, 28 Aug 2026: "the master timetable" -- simultaneous TP slots
  // (TP1·A, TP1·B, TP1·C teaching at the same time) are separate cards
  // side by side in the real design. Other same-band items (a plenary
  // immediately followed by an announcement, same room/audience) still
  // legitimately stack inside one shared card -- "some things will be
  // stacked... but not TP." Only split when every event here is a TP.
  const allTp = events.every((e) => e.type === "tp");
  if (!allTp) {
    const displayCat = toDisplayCategory(categorize(events[0]));
    const style = CATEGORY_STYLE[displayCat];
    const mine = events.some((e) => (eventMeta[e.id] ?? EMPTY_META).mine);
    const faded = mineOnly && !mine;
    return (
      <div
        className="flex flex-col gap-1.5 rounded-[10px] p-2 transition-opacity duration-150"
        style={{
          opacity: faded ? 0.25 : 1,
          backdropFilter: "blur(10px)",
          border: "1px solid oklch(100% 0 0 / 0.75)",
          borderTop: `2.5px solid ${style.accent}`,
          boxShadow: "0 6px 18px oklch(23.5% 0.017 65 / 0.07), inset 0 1px 0 oklch(100% 0 0 / 0.8)",
          background: `linear-gradient(180deg, ${style.tintFrom}, ${style.tintTo})`,
        }}
      >
        {events.map((event) => (
          <SessionTile
            key={event.id}
            event={event}
            meta={eventMeta[event.id] ?? EMPTY_META}
            now={now}
            timeZone={timeZone}
            mineOnly={mineOnly}
            onSelect={onSelect}
            titleWeight={style.titleWeight}
            displayCat={displayCat}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-start gap-1.5">
      {events.map((event) => {
        const displayCat = toDisplayCategory(categorize(event));
        const style = CATEGORY_STYLE[displayCat];
        const mine = (eventMeta[event.id] ?? EMPTY_META).mine;
        const faded = mineOnly && !mine;
        return (
          <div
            key={event.id}
            className="min-w-0 flex-1 rounded-[10px] p-2 transition-opacity duration-150"
            style={{
              opacity: faded ? 0.25 : 1,
              backdropFilter: "blur(10px)",
              border: "1px solid oklch(100% 0 0 / 0.75)",
              borderTop: `2.5px solid ${style.accent}`,
              boxShadow: "0 6px 18px oklch(23.5% 0.017 65 / 0.07), inset 0 1px 0 oklch(100% 0 0 / 0.8)",
              background: `linear-gradient(180deg, ${style.tintFrom}, ${style.tintTo})`,
            }}
          >
            <SessionTile
              event={event}
              meta={eventMeta[event.id] ?? EMPTY_META}
              now={now}
              timeZone={timeZone}
              mineOnly={mineOnly}
              onSelect={onSelect}
              titleWeight={style.titleWeight}
              displayCat={displayCat}
            />
          </div>
        );
      })}
    </div>
  );
}

function SessionTile({
  event,
  meta,
  now,
  timeZone,
  mineOnly,
  onSelect,
  titleWeight,
  displayCat,
}: {
  event: TimetableEvent;
  meta: EventMeta;
  now: Date;
  timeZone: string;
  mineOnly: boolean;
  onSelect: (event: TimetableEvent) => void;
  titleWeight: number;
  displayCat: DisplayCategory;
}) {
  const { mine, ownTpSlot, teachingLetters: letters } = meta;
  const youTeach = mineOnly && ownTpSlot;
  const showCamera = displayCat !== "lu" && displayCat !== "admin";
  const live = isEventLive(event, now, timeZone);

  return (
    <button type="button" onClick={() => onSelect(event)} className="flex flex-col items-start gap-1 text-left">
      <span className="text-[11.5px] leading-snug text-ink" style={{ fontWeight: titleWeight }}>
        {event.title}
      </span>
      {event.detail ? <span className="text-[10px] text-muted">{event.detail}</span> : null}
      {letters || event.event_time ? (
        <span className="text-[10px] text-muted">
          {event.event_time?.slice(0, 5)}
          {letters ? ` · ${letters}` : ""}
        </span>
      ) : null}
      {youTeach ? <span className="pill pill-neutral text-[9px]">You teach</span> : null}
      {showCamera ? <CameraChip event={event} live={live} mine={mine} /> : null}
    </button>
  );
}

function CameraChip({ event, live, mine }: { event: TimetableEvent; live: boolean; mine: boolean }) {
  const hasLink = Boolean(event.zoom_url);
  const clickable = live && mine && hasLink;
  const title = !hasLink
    ? "No link set for this session"
    : !live
      ? "Opens 10 minutes before the session"
      : !mine
        ? "Not your session"
        : "Join now";

  const icon = (
    <span
      className="mt-0.5 inline-flex size-[22px] items-center justify-center rounded-full"
      style={
        clickable
          ? { background: "oklch(38% 0.072 195)", color: "white" }
          : { background: "oklch(38% 0.072 195 / 0.1)", color: "oklch(38% 0.072 195 / 0.6)" }
      }
    >
      <CameraIcon />
    </span>
  );

  if (!clickable) {
    return (
      <span title={title} aria-disabled="true" style={{ cursor: "default", pointerEvents: "none" }}>
        {icon}
      </span>
    );
  }
  return (
    <a
      href={event.zoom_url!}
      target="_blank"
      rel="noreferrer"
      title={title}
      onClick={(e) => e.stopPropagation()}
      style={{ cursor: "pointer" }}
    >
      {icon}
    </a>
  );
}

function DetailPanel({
  event,
  onClose,
  meta,
}: {
  event: TimetableEvent;
  onClose: () => void;
  meta: EventMeta;
}) {
  const rows: { label: string; value: string }[] = [];
  const letters = meta.teachingLetters;

  if (event.type === "tp") {
    if (letters) rows.push({ label: "Teaching today", value: letters });
    if (event.linked_tp_number) rows.push({ label: "TP number", value: `TP${event.linked_tp_number}` });
    if (meta.volunteerAttendance) rows.push({ label: "Volunteers", value: `${meta.volunteerAttendance.expected} of ${meta.volunteerAttendance.total} coming` });
    if (event.zoom_url) rows.push({ label: "Zoom link", value: event.zoom_url });
  } else if (event.tag === "consultation") {
    rows.push({ label: "Format", value: event.zoom_url ? "Online" : "In person" });
    if (event.tag) rows.push({ label: "Booking", value: "Arranged with your tutor" });
  } else if (event.type === "input_session") {
    if (event.input_session_criteria.length > 0) {
      rows.push({ label: "Syllabus strands", value: event.input_session_criteria.join(", ") });
    }
    rows.push({ label: "Format", value: event.is_asynchronous ? "Self-paced" : "Live" });
    if (event.zoom_url) rows.push({ label: "Zoom link", value: event.zoom_url });
  } else if (event.type === "assignment_due" || event.type === "resubmission_due") {
    if (event.linked_assignment_type) rows.push({ label: "Assignment", value: event.linked_assignment_type });
  } else if (event.zoom_url) {
    rows.push({ label: "Zoom link", value: event.zoom_url });
  }

  return (
    <div className="sheet flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-serif text-lg text-ink">{event.title}</h2>
          <p className="text-xs text-muted">
            {new Date(`${event.event_date}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", weekday: "long" })}
            {event.event_time ? ` · ${event.event_time.slice(0, 5)}` : ""}
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-lg text-muted hover:text-ink" aria-label="Close">
          ×
        </button>
      </div>
      {rows.length > 0 ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {rows.map((r) => (
            <div key={r.label} className="contents">
              <span className="text-muted">{r.label}</span>
              <span className="text-ink">{r.value}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">No further details recorded for this session.</p>
      )}
    </div>
  );
}
