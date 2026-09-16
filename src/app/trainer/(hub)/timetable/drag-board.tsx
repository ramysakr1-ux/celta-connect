"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { INPUT_SESSIONS } from "@/app/input-sessions/registry";
import { inputSessionSlugForTitle } from "@/lib/input-session-registry-links";
import { categorize, isEventLive, toLocalIso, type TimeBand, type TimetableEvent } from "@/lib/timetable-grid";
import {
  moveTimetableEvent,
  setAttendance,
  setEventRegistrySlug,
  setEventDetail,
  setInputSessionCriteria,
  setTpEventMode,
  resolveZoomParticipant,
} from "@/app/trainer/(hub)/timetable/actions";
import { dependentsOf, ruleBreak, type AnchoredAnnouncement } from "@/lib/timetable-dependents";
import type { Volunteer } from "@/app/trainer/(hub)/timetable/event-cell";
import { DeleteEventButton } from "@/app/trainer/(hub)/timetable/delete-event-button";
import { formatCalendarDate, formatCalendarDateObject } from "@/lib/format-date";

// zoom-auto-attendance.md §4 -- a Zoom participant the webhook couldn't
// confidently match to a volunteer_student, shown in the Attendance panel
// for the trainer to resolve.
export interface UnmatchedParticipant {
  id: string;
  timetable_event_id: string;
  zoom_email: string | null;
  zoom_display_name: string;
  suggested_volunteer_student_id: string | null;
  joined_at: string;
}

// for-claude-code-timetable-drag.md -- replaces the time-band grid
// (timetable-grid.tsx) with the day-stack drag-and-drop board. Per Ramy's
// call: replaces the grid entirely (not a second view mode); the spec's
// "shifts a dependency" amber/cascade case is deliberately NOT implemented
// -- no dependency graph exists to compute it from (see project memory).
// Every non-origin day is a "clean" target for v1; the "blocked" visual
// state is wired but never fires yet, since no concrete blocking rule has
// been specified -- flagged rather than invented.

type TileCategory = "ink" | "teal" | "muted";

const TILE_COLOR: Record<TileCategory, string> = {
  ink: "oklch(30% 0.042 58)",
  teal: "oklch(37.5% 0.058 195)",
  muted: "oklch(51% 0.017 70)",
};

const LEGEND: { category: TileCategory; label: string }[] = [
  { category: "ink", label: "TP / room-based teaching sessions" },
  { category: "teal", label: "Whole-group Zoom input sessions" },
  { category: "muted", label: "Individual / bookable -- consultations, tutorials, late starts" },
];

// The spec's 3-bucket model has no separate admin/lunch color -- both fold
// into "muted" here (closest fit: administrative/bookable, not a teaching
// session), same kind of fold the read-only board makes for `cs`.
function tileCategory(event: TimetableEvent): TileCategory {
  const cat = categorize(event);
  if (cat === "wg") return "teal";
  if (cat === "rm" || cat === "cs") return "ink";
  return "muted";
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-2.5 shrink-0" stroke="currentColor" fill="none" strokeWidth={2} aria-hidden="true">
      <path d="M15 10l4.5-2.5v9L15 14" />
      <rect x="3" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

interface DayCellData {
  isoDate: string;
  dayOfMonth: number;
  weekday: string;
  events: TimetableEvent[];
}

interface WeekRow {
  label: string;
  days: DayCellData[];
}

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function mondayOf(d: Date): Date {
  const copy = new Date(d);
  copy.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return copy;
}

/** Every week spanned by the data, Mon-Fri always present as a droppable
 * day even when empty; Sat/Sun only appear if a real event already lands
 * there, so the grid doesn't silently widen for a course that never meets
 * on weekends. */
function buildWeeks(events: TimetableEvent[]): WeekRow[] {
  if (events.length === 0) return [];
  const byDate = new Map<string, TimetableEvent[]>();
  for (const e of events) {
    const list = byDate.get(e.event_date) ?? [];
    list.push(e);
    byDate.set(e.event_date, list);
  }
  const dates = [...byDate.keys()].sort();
  const firstMonday = mondayOf(new Date(`${dates[0]}T00:00:00`));
  const lastDate = new Date(`${dates[dates.length - 1]}T00:00:00`);
  const fmt = (dt: Date) => formatCalendarDateObject(dt, { day: "numeric", month: "long" });

  const weeks: WeekRow[] = [];
  const cursor = new Date(firstMonday);
  while (cursor <= lastDate) {
    const days: DayCellData[] = [];
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(cursor);
      d.setDate(cursor.getDate() + i);
      // Not toLocalIso() -- d was built by pure calendar arithmetic off an
      // already-known event date (no "current real-world moment" or centre
      // timezone involved), so it needs the same local round-trip its own
      // construction used, not a real timezone conversion.
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const dayEvents = byDate.get(iso) ?? [];
      if (i >= 5 && dayEvents.length === 0) continue;
      days.push({ isoDate: iso, dayOfMonth: d.getDate(), weekday: WEEKDAY_NAMES[d.getDay()], events: dayEvents });
    }
    const sunday = new Date(cursor);
    sunday.setDate(cursor.getDate() + 6);
    weeks.push({ label: `${fmt(cursor)} – ${fmt(sunday)}`, days });
    cursor.setDate(cursor.getDate() + 7);
  }
  return weeks;
}

export function DragBoard({
  events,
  locked,
  volunteers,
  attendedByEvent,
  attendanceSourceByEvent,
  unmatchedByEvent,
  mixedMode,
  canEdit,
  timeZone,
  timeBands,
  anchoredAnnouncements = [],
  candidateCount = 0,
}: {
  events: TimetableEvent[];
  /** Broadcasts hanging off a timetable event -- §4's real dependency edge. */
  anchoredAnnouncements?: AnchoredAnnouncement[];
  candidateCount?: number;
  locked: boolean;
  volunteers: Volunteer[];
  attendedByEvent: Map<string, Set<string>>;
  attendanceSourceByEvent: Map<string, Map<string, "manual" | "zoom">>;
  unmatchedByEvent: Map<string, UnmatchedParticipant[]>;
  mixedMode: boolean;
  // Ramy, 2026-08-23: ACT doesn't make changes to the timetable -- drag-move,
  // criteria/mode edits, and delete all need the MCT (or admin). Attendance
  // isn't gated: taking the register is a day-of teaching task, not a
  // timetable edit, and actions.ts' setAttendance was deliberately left open.
  canEdit: boolean;
  timeZone: string;
  timeBands: TimeBand[];
}) {
  const weeks = buildWeeks(events);
  const today = toLocalIso(new Date(), timeZone);
  // for-claude-code-timetable-dragboard-fidelity.md: the day-stack redesign
  // (cd673c0, an approved replacement of the old time-band grid) never
  // carried over live-Zoom-join capability -- event-cell.tsx's JoinChip
  // exists and is correct, DragBoard just never used it. Ticks every 30s so
  // a tile can flip from dormant camera icon to a clickable Join pill
  // without a full page reload while a session is actually live.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const [draggingEventId, setDraggingEventId] = useState<string | null>(null);
  const [draggingOriginDate, setDraggingOriginDate] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<TimetableEvent | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (weeks.length === 0) return null;

  const handleDrop = (isoDate: string) => {
    if (!draggingEventId || draggingOriginDate === isoDate) return;
    // §4: "Drop is refused on a garnet chip, per the existing validation
    // rule." The strip has been saying so the whole time you were dragging.
    const dragged = events.find((e) => e.id === draggingEventId);
    const broken = dragged ? ruleBreak(dragged, isoDate, events) : null;
    if (broken) {
      setDraggingEventId(null);
      setDraggingOriginDate(null);
      setDragOverDate(null);
      setMoveError(`That move breaks the assignment schedule rule -- ${broken}.`);
      return;
    }
    const eventId = draggingEventId;
    setDraggingEventId(null);
    setDraggingOriginDate(null);
    setDragOverDate(null);
    startTransition(async () => {
      const result = await moveTimetableEvent(eventId, isoDate);
      if (result.error) setMoveError(result.error);
    });
  };

  // §4's consequence strip. The selected tile is the one whose dependents are
  // listed; while a drag is in flight the dates follow the day you are hovering
  // over, so you read the consequence before you let go rather than after.
  const stripEvent = draggingEventId ? (events.find((e) => e.id === draggingEventId) ?? selectedEvent) : selectedEvent;
  const stripDate = draggingEventId ? (dragOverDate ?? stripEvent?.event_date ?? "") : (stripEvent?.event_date ?? "");
  const dependents = stripEvent && stripDate
    ? dependentsOf(stripEvent, stripDate, events, anchoredAnnouncements, candidateCount)
    : [];

  return (
    <div className="flex flex-col gap-4">
      {stripEvent ? (
        <div
          className="sticky top-2 z-20 flex flex-col gap-2 rounded-[10px] px-4 py-3"
          style={{ background: "oklch(30% 0.042 58)", color: "oklch(97% 0.008 88)" }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-micro font-bold tracking-[0.12em] uppercase" style={{ color: "oklch(78% 0.03 75)" }}>
                Moving this moves
              </p>
              <p className="mt-0.5 truncate text-body font-semibold">
                {stripEvent.title}
                <span style={{ color: "oklch(78% 0.03 75)" }}>
                  {" · "}
                  {dependents.length === 0
                    ? "nothing else on record"
                    : `${dependents.length} thing${dependents.length === 1 ? "" : "s"}`}
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedEvent(null)}
              aria-label="Clear selection"
              className="shrink-0 rounded px-1.5 text-h3 leading-none"
              style={{ color: "oklch(78% 0.03 75)" }}
            >
              ×
            </button>
          </div>
          {dependents.length === 0 ? (
            /* Honest rather than empty: moveTimetableEvent re-syncs assignment
               due dates and moves anchored announcements, and nothing else in
               this codebase follows a session. Saying "nothing else on record"
               is the truth; inventing chips for a cascade that does not run
               would be the pack's amber problem again. */
            <p className="text-label" style={{ color: "oklch(78% 0.03 75)" }}>
              Nothing in Connect hangs off this session, so moving it moves only the session.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {dependents.map((d) => (
                <span
                  key={d.id}
                  title={d.breaks ? `This move is refused -- ${d.breaks}` : d.detail}
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-label font-semibold"
                  style={
                    d.breaks
                      ? { background: "color-mix(in oklab, var(--color-garnet) 75%, transparent)", color: "oklch(97% 0.008 88)" }
                      : { background: "color-mix(in oklab, oklch(97% 0.008 88) 14%, transparent)", color: "oklch(97% 0.008 88)" }
                  }
                >
                  {d.label}
                  <span style={{ opacity: 0.75 }}>· {d.detail}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {moveError ? (
        <div className="flex items-center justify-between rounded-[6px] border border-destructive/30 bg-destructive/10 px-3 py-2 text-body text-destructive">
          {moveError}
          <button type="button" onClick={() => setMoveError(null)} className="text-label underline">
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="flex flex-col gap-6">
        {weeks.map((week) => (
          <div key={week.label}>
            <p className="mb-2 font-serif text-h3 text-muted">{week.label}</p>
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${week.days.length}, minmax(0, 1fr))` }}>
              {week.days.map((day) => {
                const isOrigin = draggingOriginDate === day.isoDate;
                const isDragActive = draggingEventId !== null;
                const isValidTarget = isDragActive && !isOrigin;
                const isOver = dragOverDate === day.isoDate;
                const isToday = day.isoDate === today;

                return (
                  <div
                    key={day.isoDate}
                    onDragOver={(e) => {
                      if (!isValidTarget) return;
                      e.preventDefault();
                      if (dragOverDate !== day.isoDate) setDragOverDate(day.isoDate);
                    }}
                    onDragLeave={() => {
                      if (dragOverDate === day.isoDate) setDragOverDate(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleDrop(day.isoDate);
                    }}
                    className="flex min-h-[120px] flex-col gap-1.5 rounded-[8px] border p-2 transition-colors"
                    style={{
                      borderColor: isValidTarget && isOver ? "oklch(30% 0.042 58)" : isToday ? "var(--color-primary)" : "var(--color-border-faint)",
                      borderWidth: isToday ? "2px" : "1px",
                      background: isValidTarget && isOver ? "color-mix(in oklab, oklch(30% 0.042 58) 15%, white)" : "var(--color-card)",
                    }}
                  >
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-serif text-h3 text-ink">{day.dayOfMonth}</span>
                      <span className="text-micro font-semibold uppercase tracking-[0.08em] text-muted">{day.weekday}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {day.events.map((event) => {
                        const cat = tileCategory(event);
                        const spine = TILE_COLOR[cat];
                        const live = isEventLive(event, now, timeZone, timeBands);
                        return (
                          <div
                            key={event.id}
                            draggable={!locked && canEdit}
                            onDragStart={(e) => {
                              setDraggingEventId(event.id);
                              setDraggingOriginDate(event.event_date);
                              e.dataTransfer.effectAllowed = "move";
                            }}
                            onDragEnd={() => {
                              setDraggingEventId(null);
                              setDraggingOriginDate(null);
                              setDragOverDate(null);
                            }}
                            // §4: clicking selects (and opens the detail panel
                            // it always opened); clicking the selected tile
                            // again clears the selection.
                            onClick={() => setSelectedEvent(selectedEvent?.id === event.id ? null : event)}
                            // transition-transform ONLY, and the selection
                            // ring is an outline rather than a box-shadow.
                            // Both because of the same thing, found on
                            // production 16 Sep 2026: a tile off-screen in
                            // this horizontally scrolling board sits in a
                            // subtree the browser is not rendering, so a
                            // transition on it never progresses -- it stays
                            // "running" at its start value and that value
                            // beats the inline style, `!important` included.
                            // The ring and the fade were both being computed
                            // away. Nothing that carries STATE is transitioned
                            // here now; only the hover lift is.
                            className={`rounded-[6px] border-l-[3px] px-2 py-1 text-left transition-transform duration-200 ${
                              !locked && canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
                            } hover:-translate-y-0.5 hover:scale-[1.02]`}
                            style={{
                              borderLeftColor: spine,
                              background: `color-mix(in oklab, ${spine} 12%, white)`,
                              // Dragging fades the tile itself; a selection
                              // fades every OTHER tile to 55%, so the one whose
                              // consequences the strip is listing is the one
                              // you are looking at.
                              opacity:
                                draggingEventId === event.id
                                  ? 0.4
                                  : selectedEvent && selectedEvent.id !== event.id
                                    ? 0.55
                                    : 1,
                              outline:
                                selectedEvent?.id === event.id ? "2px solid var(--color-primary)" : undefined,
                              outlineOffset: selectedEvent?.id === event.id ? "-2px" : undefined,
                            }}
                          >
                            <div className="flex items-center gap-1">
                              {event.zoom_url ? <CameraIcon /> : null}
                              <span className="truncate text-label font-medium text-ink">{event.title}</span>
                            </div>
                            {event.event_time ? <span className="text-micro text-muted">{event.event_time.slice(0, 5)}</span> : null}
                            {live && event.zoom_url ? (
                              <a
                                href={event.zoom_url}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="mt-1 inline-flex items-center gap-1 self-start rounded-full bg-primary px-1.5 py-0.5 text-micro font-semibold uppercase tracking-[0.06em] text-primary-foreground"
                              >
                                <span className="size-[4px] shrink-0 rounded-full bg-primary-foreground" />
                                Join
                              </a>
                            ) : live ? (
                              <span className="mt-1 inline-flex w-fit items-center gap-1 self-start rounded-full bg-primary/15 px-1.5 py-0.5 text-micro font-semibold uppercase tracking-[0.06em] text-primary">
                                <span className="size-[4px] shrink-0 rounded-full bg-primary" />
                                Live
                              </span>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-4 text-label text-muted">
        {LEGEND.map((item) => (
          <span key={item.category} className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-[3px]" style={{ background: TILE_COLOR[item.category] }} />
            {item.label}
          </span>
        ))}
      </div>

      {selectedEvent ? (
        <DetailPanel
          event={selectedEvent}
          locked={locked}
          volunteers={volunteers}
          attendedIds={attendedByEvent.get(selectedEvent.id) ?? new Set()}
          attendanceSource={attendanceSourceByEvent.get(selectedEvent.id) ?? new Map()}
          unmatched={unmatchedByEvent.get(selectedEvent.id) ?? []}
          onClose={() => setSelectedEvent(null)}
          mixedMode={mixedMode}
          now={now}
          timeZone={timeZone}
          timeBands={timeBands}
          canEdit={canEdit}
        />
      ) : null}

      {isPending ? <p className="text-label text-muted">Saving...</p> : null}
    </div>
  );
}

function DetailPanel({
  event,
  locked,
  volunteers,
  attendedIds,
  attendanceSource,
  unmatched,
  onClose,
  mixedMode,
  now,
  timeZone,
  timeBands,
  canEdit,
}: {
  event: TimetableEvent;
  locked: boolean;
  volunteers: Volunteer[];
  attendedIds: Set<string>;
  attendanceSource: Map<string, "manual" | "zoom">;
  unmatched: UnmatchedParticipant[];
  onClose: () => void;
  mixedMode: boolean;
  now: Date;
  timeZone: string;
  timeBands: TimeBand[];
  canEdit: boolean;
}) {
  const rows: { label: string; value: string }[] = [
    { label: "Type", value: event.type.replace(/_/g, " ") },
    { label: "Date", value: formatCalendarDate(event.event_date, { day: "numeric", month: "long", weekday: "long" }) },
  ];
  if (event.event_time) rows.push({ label: "Time", value: event.event_time.slice(0, 5) });
  if (event.tag) rows.push({ label: "Tag", value: event.tag });
  if (event.linked_tp_number) rows.push({ label: "TP number", value: `TP${event.linked_tp_number}` });
  if (event.linked_assignment_type) rows.push({ label: "Assignment", value: event.linked_assignment_type });
  const live = isEventLive(event, now, timeZone, timeBands);

  return (
    <div className="sheet flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-serif text-h3 text-ink">{event.title}</h2>
        <button type="button" onClick={onClose} className="text-h3 text-muted hover:text-ink" aria-label="Close">
          &times;
        </button>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-body">
        {rows.map((r) => (
          <div key={r.label} className="contents">
            <span className="text-muted capitalize">{r.label}</span>
            <span className="text-ink">{r.value}</span>
          </div>
        ))}
        {event.zoom_url ? (
          <div className="contents">
            <span className="text-muted">Zoom link</span>
            <span>
              <a href={event.zoom_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                Open Zoom link
              </a>
            </span>
          </div>
        ) : null}
      </div>

      {event.zoom_url ? (
        live ? (
          <a
            href={event.zoom_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 self-start rounded-full bg-primary px-3 py-1.5 text-label font-semibold uppercase tracking-[0.06em] text-primary-foreground"
          >
            <span className="size-[5px] shrink-0 rounded-full bg-primary-foreground" />
            Join now
          </a>
        ) : (
          <p className="text-label text-muted">Opens 10 minutes before the session.</p>
        )
      ) : null}

      {event.type === "milestone" && event.title.startsWith("Filmed observation") ? (
        <Link href={`/trainer/timetable/filmed-observation/${event.id}`} className="text-body font-medium text-primary hover:underline">
          Set up this session
        </Link>
      ) : null}

      {/* The subtitle under a title on every board -- "Room 2 · B1+",
          "Self-evaluations lead", "Written feedback only". It could be typed
          when the event was created and never again: the only editor for it
          lived in event-cell.tsx, which nothing has rendered since the
          day-stack redesign, so setEventDetail had no way in. Walked
          14 Sep 2026. */}
      {canEdit && !locked ? (
        <details className="mt-1" open={Boolean(event.detail)}>
          <summary className="cursor-pointer text-label font-semibold uppercase tracking-[0.1em] text-muted hover:text-ink">
            {event.detail ? `Subtitle: ${event.detail}` : "Set subtitle"}
          </summary>
          <form action={setEventDetail} className="mt-2 flex flex-col gap-1.5">
            <input type="hidden" name="event_id" value={event.id} />
            <input
              name="detail"
              type="text"
              defaultValue={event.detail ?? ""}
              placeholder="Room 2 · B1+, Supervised, Observation task…"
              className="rounded-[6px] border border-border bg-card px-2 py-1 text-label text-ink outline-none focus:border-primary"
            />
            <div className="flex items-center gap-2">
              <button type="submit" className="self-start rounded-[6px] border border-border px-2 py-1 text-label wash">
                Save
              </button>
              <span className="text-label text-muted">Leave it empty to remove the subtitle.</span>
            </div>
          </form>
        </details>
      ) : event.detail ? (
        <p className="text-label font-semibold uppercase tracking-[0.1em] text-muted">Subtitle: {event.detail}</p>
      ) : null}

      {event.type === "input_session" ? (
        canEdit ? (
          <details className="mt-1" open>
            <summary className="cursor-pointer text-label font-semibold uppercase tracking-[0.1em] text-muted hover:text-ink">
              {event.input_session_criteria.length > 0 ? `Criteria: ${event.input_session_criteria.join(", ")}` : "Set criteria"}
            </summary>
            <form action={setInputSessionCriteria} className="mt-2 flex flex-col gap-1.5">
              <input type="hidden" name="event_id" value={event.id} />
              <input
                name="input_session_criteria"
                type="text"
                defaultValue={event.input_session_criteria.join(", ")}
                placeholder="4c, 5f"
                className="rounded-[6px] border border-border bg-card px-2 py-1 text-label text-ink outline-none focus:border-primary"
              />
              <button type="submit" className="self-start rounded-[6px] border border-border px-2 py-1 text-label wash">
                Save
              </button>
            </form>
          </details>
        ) : event.input_session_criteria.length > 0 ? (
          <p className="text-label font-semibold uppercase tracking-[0.1em] text-muted">
            Criteria: {event.input_session_criteria.join(", ")}
          </p>
        ) : null
      ) : null}

      {/* Which interactive session this slot opens, chosen rather than
          guessed off the title (migration 0301). Sits beside the criteria
          because both are "what this session IS", not when it runs. */}
      {event.type === "input_session" ? (
        (() => {
          const matched = inputSessionSlugForTitle(event.title);
          const effective = event.registry_slug ?? matched;
          const chosen = INPUT_SESSIONS.find((s) => s.slug === effective);
          if (!canEdit) {
            return chosen ? (
              <p className="text-label font-semibold uppercase tracking-[0.1em] text-muted">Opens: {chosen.title}</p>
            ) : null;
          }
          return (
            <details className="mt-1">
              <summary className="cursor-pointer text-label font-semibold uppercase tracking-[0.1em] text-muted hover:text-ink">
                {chosen ? `Opens: ${chosen.title}` : "No interactive session"}
              </summary>
              <form action={setEventRegistrySlug} className="mt-2 flex flex-col gap-1.5">
                <input type="hidden" name="event_id" value={event.id} />
                <select
                  name="registry_slug"
                  defaultValue={event.registry_slug ?? ""}
                  className="rounded-[6px] border border-border bg-card px-2 py-1 text-label text-ink outline-none focus:border-primary"
                >
                  <option value="">
                    {matched
                      ? `Match the title -- ${INPUT_SESSIONS.find((s) => s.slug === matched)?.title ?? matched}`
                      : "None -- a plain card"}
                  </option>
                  {INPUT_SESSIONS.map((s) => (
                    <option key={s.slug} value={s.slug}>
                      {s.title}
                    </option>
                  ))}
                </select>
                <p className="text-label leading-snug text-muted">
                  What this slot opens on a candidate&apos;s Resources tab. Leave it on the first option to keep
                  matching by title.
                </p>
                <button type="submit" className="self-start rounded-[6px] border border-border px-2 py-1 text-label wash">
                  Save
                </button>
              </form>
            </details>
          );
        })()
      ) : null}

      {event.type === "tp" && mixedMode ? (
        canEdit ? (
          <details className="mt-1" open>
            <summary className="cursor-pointer text-label font-semibold uppercase tracking-[0.1em] text-muted hover:text-ink">
              {event.mode ? `Mode: ${event.mode === "f2f" ? "Face-to-face" : "Online"}` : "Set mode"}
            </summary>
            <form action={setTpEventMode} className="mt-2 flex flex-col gap-1.5">
              <input type="hidden" name="event_id" value={event.id} />
              <select
                name="mode"
                defaultValue={event.mode ?? ""}
                className="rounded-[6px] border border-border bg-card px-2 py-1 text-label text-ink outline-none focus:border-primary"
              >
                <option value="">Not set</option>
                <option value="f2f">Face-to-face</option>
                <option value="online">Online</option>
              </select>
              <button type="submit" className="self-start rounded-[6px] border border-border px-2 py-1 text-label wash">
                Save
              </button>
            </form>
          </details>
        ) : event.mode ? (
          <p className="text-label font-semibold uppercase tracking-[0.1em] text-muted">
            Mode: {event.mode === "f2f" ? "Face-to-face" : "Online"}
          </p>
        ) : null
      ) : null}

      {event.type === "tp" && volunteers.length > 0 ? (
        <details className="mt-1" open>
          <summary className="cursor-pointer text-label font-semibold uppercase tracking-[0.1em] text-muted hover:text-ink">
            Attendance {attendedIds.size}/{volunteers.length}
          </summary>
          <form action={setAttendance} className="mt-2 flex flex-col gap-1.5">
            <input type="hidden" name="event_id" value={event.id} />
            {volunteers.map((v) => (
              <label key={v.id} className="flex items-center gap-1.5 text-body">
                <input type="checkbox" name="attended_volunteer_id" value={v.id} defaultChecked={attendedIds.has(v.id)} />
                {v.name}
                {attendanceSource.get(v.id) === "zoom" ? (
                  <span className="pill pill-neutral text-micro">via Zoom</span>
                ) : null}
              </label>
            ))}
            <button type="submit" className="self-start rounded-[6px] border border-border px-2 py-1 text-label wash">
              Save
            </button>
          </form>
        </details>
      ) : null}

      {event.type === "tp" && unmatched.length > 0 ? (
        <details className="mt-1" open>
          <summary className="cursor-pointer text-label font-semibold uppercase tracking-[0.1em] text-status-warning-text hover:text-ink">
            Needs review {unmatched.length}
          </summary>
          <p className="mt-1 text-label text-muted">
            Zoom saw these join but couldn&apos;t match them to anyone on the register -- pick who each one was, or
            leave as &quot;not one of ours&quot; to dismiss.
          </p>
          <div className="mt-2 flex flex-col gap-2">
            {unmatched.map((u) => (
              <form key={u.id} action={resolveZoomParticipant} className="flex flex-col gap-1 rounded-[6px] border border-border-faint p-2">
                <input type="hidden" name="unmatched_id" value={u.id} />
                <p className="text-body text-ink">
                  {u.zoom_display_name}
                  {u.zoom_email ? <span className="text-muted"> · {u.zoom_email}</span> : null}
                </p>
                <select
                  name="volunteer_student_id"
                  defaultValue={u.suggested_volunteer_student_id ?? ""}
                  className="rounded-[6px] border border-border bg-card px-2 py-1 text-label text-ink outline-none focus:border-primary"
                >
                  <option value="">Not one of ours</option>
                  {volunteers.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
                <button type="submit" className="self-start rounded-[6px] border border-border px-2 py-1 text-label wash">
                  Confirm
                </button>
              </form>
            ))}
          </div>
        </details>
      ) : null}

      {!locked && canEdit ? <DeleteEventButton eventId={event.id} compact={false} /> : null}
    </div>
  );
}
