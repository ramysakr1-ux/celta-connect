"use client";

import { useMemo, useState } from "react";
import { buildDayRows, categorize, isEventLive, type CellCategory, type DayRow, type TimeBand, type TimetableEvent } from "@/lib/timetable-grid";

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
    label: "Whole group -- Zoom",
    titleWeight: 500,
  },
  rm: {
    accent: "oklch(23.5% 0.017 65)",
    tintFrom: "oklch(100% 0 0 / 0.92)",
    tintTo: "oklch(100% 0 0 / 0.55)",
    label: "Group room -- TP, feedback, planning",
    titleWeight: 600,
  },
  admin: {
    // Re-pointed off gold per the color audit (2026-08-21) -- deadlines are
    // amber, matching the same category's fix on the trainer-side event-cell.tsx.
    accent: "oklch(44% 0.095 68)",
    tintFrom: "oklch(94.5% 0.065 85 / 0.75)",
    tintTo: "oklch(94.5% 0.065 85 / 0.35)",
    label: "Admin & deadlines",
    titleWeight: 500,
  },
  iw: {
    accent: "oklch(51% 0.017 70)",
    tintFrom: "oklch(96% 0.008 85 / 0.6)",
    tintTo: "oklch(96% 0.008 85 / 0.25)",
    label: "Individual -- consultations, own time",
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
}

export interface ReadOnlyBoardProps {
  events: TimetableEvent[];
  eventMeta: Record<string, EventMeta>;
  timeBands: TimeBand[];
  viewerName: string;
  viewerGroupLabel: string | null;
  today: string;
  nowIso: string;
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
  const liveEvent = events.find((e) => isEventLive(e, now)) ?? null;

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
            <span className="size-2 shrink-0 animate-pulse rounded-full bg-muted" />
            <span className="text-[11px] font-semibold tracking-[0.08em] uppercase">Live now</span>
            <span className="text-sm font-medium">{liveEvent.title}</span>
            {liveEvent.event_time ? <span className="text-xs opacity-80">{liveEvent.event_time.slice(0, 5)}</span> : null}
          </div>
          {liveEvent.zoom_url ? (
            <a
              href={liveEvent.zoom_url}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 rounded-full bg-card px-3 py-1 text-xs font-semibold text-ink"
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

      <div
        className="overflow-x-auto rounded-[14px] p-3"
        style={{
          background:
            "linear-gradient(135deg, oklch(38% 0.072 195 / 0.06), oklch(96% 0.045 80 / 0.06), oklch(60% 0.11 70 / 0.08))",
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
                    <Cell events={row.admin} eventMeta={eventMeta} now={now} mineOnly={mineOnly} onSelect={setSelectedEvent} />
                  </td>
                  {row.bands.map((bandEvents, i) => (
                    <td key={i} className="align-top">
                      <Cell events={bandEvents} eventMeta={eventMeta} now={now} mineOnly={mineOnly} onSelect={setSelectedEvent} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-center gap-2">
        {weeks.map((w, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setWeekIndex(i)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold ${
              i === weekIndex ? "bg-primary text-primary-foreground" : "border border-border text-muted hover:border-primary"
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
  mineOnly,
  onSelect,
}: {
  events: TimetableEvent[];
  eventMeta: Record<string, EventMeta>;
  now: Date;
  mineOnly: boolean;
  onSelect: (event: TimetableEvent) => void;
}) {
  if (events.length === 0) return null;
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
          mineOnly={mineOnly}
          onSelect={onSelect}
          titleWeight={style.titleWeight}
          displayCat={displayCat}
        />
      ))}
    </div>
  );
}

function SessionTile({
  event,
  meta,
  now,
  mineOnly,
  onSelect,
  titleWeight,
  displayCat,
}: {
  event: TimetableEvent;
  meta: EventMeta;
  now: Date;
  mineOnly: boolean;
  onSelect: (event: TimetableEvent) => void;
  titleWeight: number;
  displayCat: DisplayCategory;
}) {
  const { mine, ownTpSlot, teachingLetters: letters } = meta;
  const youTeach = mineOnly && ownTpSlot;
  const showCamera = displayCat !== "lu" && displayCat !== "admin";
  const live = isEventLive(event, now);

  return (
    <button type="button" onClick={() => onSelect(event)} className="flex flex-col items-start gap-1 text-left">
      <span className="text-[11.5px] leading-snug text-ink" style={{ fontWeight: titleWeight }}>
        {event.title}
      </span>
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
