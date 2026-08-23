"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { categorize, isEventLive, toLocalIso, type TimetableEvent } from "@/lib/timetable-grid";
import {
  moveTimetableEvent,
  setAttendance,
  setInputSessionCriteria,
  setTpEventMode,
  resolveZoomParticipant,
} from "@/app/trainer/(hub)/timetable/actions";
import type { Volunteer } from "@/app/trainer/(hub)/timetable/event-cell";
import { DeleteEventButton } from "@/app/trainer/(hub)/timetable/delete-event-button";

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
  const fmt = (dt: Date) => dt.toLocaleDateString("en-GB", { day: "numeric", month: "long" });

  const weeks: WeekRow[] = [];
  const cursor = new Date(firstMonday);
  while (cursor <= lastDate) {
    const days: DayCellData[] = [];
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(cursor);
      d.setDate(cursor.getDate() + i);
      const iso = toLocalIso(d);
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
}: {
  events: TimetableEvent[];
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
}) {
  const weeks = buildWeeks(events);
  const today = toLocalIso(new Date());
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
    const eventId = draggingEventId;
    setDraggingEventId(null);
    setDraggingOriginDate(null);
    setDragOverDate(null);
    startTransition(async () => {
      const result = await moveTimetableEvent(eventId, isoDate);
      if (result.error) setMoveError(result.error);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {moveError ? (
        <div className="flex items-center justify-between rounded-[6px] border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {moveError}
          <button type="button" onClick={() => setMoveError(null)} className="text-xs underline">
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="flex flex-col gap-6">
        {weeks.map((week) => (
          <div key={week.label}>
            <p className="mb-2 font-serif text-base text-muted">{week.label}</p>
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
                      <span className="font-serif text-[15px] text-ink">{day.dayOfMonth}</span>
                      <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-muted">{day.weekday}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {day.events.map((event) => {
                        const cat = tileCategory(event);
                        const spine = TILE_COLOR[cat];
                        const live = isEventLive(event, now);
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
                            onClick={() => setSelectedEvent(event)}
                            className="cursor-pointer rounded-[6px] border-l-[3px] px-2 py-1 text-left"
                            style={{
                              borderLeftColor: spine,
                              background: `color-mix(in oklab, ${spine} 12%, white)`,
                              opacity: draggingEventId === event.id ? 0.4 : 1,
                            }}
                          >
                            <div className="flex items-center gap-1">
                              {event.zoom_url ? <CameraIcon /> : null}
                              <span className="truncate text-[11px] font-medium text-ink">{event.title}</span>
                            </div>
                            {event.event_time ? <span className="text-[9px] text-muted">{event.event_time.slice(0, 5)}</span> : null}
                            {live ? (
                              <a
                                href={event.zoom_url ?? undefined}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="mt-1 inline-flex items-center gap-1 self-start rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] text-primary-foreground"
                              >
                                <span className="size-[4px] shrink-0 rounded-full bg-primary-foreground" />
                                Join
                              </a>
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

      <div className="flex flex-wrap gap-4 text-[11px] text-muted">
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
          canEdit={canEdit}
        />
      ) : null}

      {isPending ? <p className="text-xs text-muted">Saving...</p> : null}
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
  canEdit: boolean;
}) {
  const rows: { label: string; value: string }[] = [
    { label: "Type", value: event.type.replace(/_/g, " ") },
    { label: "Date", value: new Date(`${event.event_date}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", weekday: "long" }) },
  ];
  if (event.event_time) rows.push({ label: "Time", value: event.event_time.slice(0, 5) });
  if (event.tag) rows.push({ label: "Tag", value: event.tag });
  if (event.linked_tp_number) rows.push({ label: "TP number", value: `TP${event.linked_tp_number}` });
  if (event.linked_assignment_type) rows.push({ label: "Assignment", value: event.linked_assignment_type });
  const live = isEventLive(event, now);

  return (
    <div className="sheet flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-serif text-lg text-ink">{event.title}</h2>
        <button type="button" onClick={onClose} className="text-lg text-muted hover:text-ink" aria-label="Close">
          &times;
        </button>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
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
                Open Zoom link →
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
            className="inline-flex items-center gap-1.5 self-start rounded-full bg-primary px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-primary-foreground"
          >
            <span className="size-[5px] shrink-0 rounded-full bg-primary-foreground" />
            Join now
          </a>
        ) : (
          <p className="text-xs text-muted">Opens 10 minutes before the session.</p>
        )
      ) : null}

      {event.type === "milestone" && event.title.startsWith("Filmed observation") ? (
        <Link href={`/trainer/timetable/filmed-observation/${event.id}`} className="text-sm font-medium text-primary hover:underline">
          Set up this session →
        </Link>
      ) : null}

      {event.type === "input_session" ? (
        canEdit ? (
          <details className="mt-1" open>
            <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.1em] text-muted hover:text-ink">
              {event.input_session_criteria.length > 0 ? `Criteria: ${event.input_session_criteria.join(", ")}` : "Set criteria"}
            </summary>
            <form action={setInputSessionCriteria} className="mt-2 flex flex-col gap-1.5">
              <input type="hidden" name="event_id" value={event.id} />
              <input
                name="input_session_criteria"
                type="text"
                defaultValue={event.input_session_criteria.join(", ")}
                placeholder="4c, 5f"
                className="rounded-[6px] border border-border bg-card px-2 py-1 text-xs text-ink outline-none focus:border-primary"
              />
              <button type="submit" className="self-start rounded-[6px] border border-border px-2 py-1 text-xs trainer-hover">
                Save
              </button>
            </form>
          </details>
        ) : event.input_session_criteria.length > 0 ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
            Criteria: {event.input_session_criteria.join(", ")}
          </p>
        ) : null
      ) : null}

      {event.type === "tp" && mixedMode ? (
        canEdit ? (
          <details className="mt-1" open>
            <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.1em] text-muted hover:text-ink">
              {event.mode ? `Mode: ${event.mode === "f2f" ? "Face-to-face" : "Online"}` : "Set mode"}
            </summary>
            <form action={setTpEventMode} className="mt-2 flex flex-col gap-1.5">
              <input type="hidden" name="event_id" value={event.id} />
              <select
                name="mode"
                defaultValue={event.mode ?? ""}
                className="rounded-[6px] border border-border bg-card px-2 py-1 text-xs text-ink outline-none focus:border-primary"
              >
                <option value="">Not set</option>
                <option value="f2f">Face-to-face</option>
                <option value="online">Online</option>
              </select>
              <button type="submit" className="self-start rounded-[6px] border border-border px-2 py-1 text-xs trainer-hover">
                Save
              </button>
            </form>
          </details>
        ) : event.mode ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
            Mode: {event.mode === "f2f" ? "Face-to-face" : "Online"}
          </p>
        ) : null
      ) : null}

      {event.type === "tp" && volunteers.length > 0 ? (
        <details className="mt-1" open>
          <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.1em] text-muted hover:text-ink">
            Attendance {attendedIds.size}/{volunteers.length}
          </summary>
          <form action={setAttendance} className="mt-2 flex flex-col gap-1.5">
            <input type="hidden" name="event_id" value={event.id} />
            {volunteers.map((v) => (
              <label key={v.id} className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" name="attended_volunteer_id" value={v.id} defaultChecked={attendedIds.has(v.id)} />
                {v.name}
                {attendanceSource.get(v.id) === "zoom" ? (
                  <span className="pill pill-neutral text-[9px]">via Zoom</span>
                ) : null}
              </label>
            ))}
            <button type="submit" className="self-start rounded-[6px] border border-border px-2 py-1 text-xs trainer-hover">
              Save
            </button>
          </form>
        </details>
      ) : null}

      {event.type === "tp" && unmatched.length > 0 ? (
        <details className="mt-1" open>
          <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.1em] text-status-warning-text hover:text-ink">
            Needs review {unmatched.length}
          </summary>
          <p className="mt-1 text-xs text-muted">
            Zoom saw these join but couldn&apos;t match them to anyone on the register -- pick who each one was, or
            leave as &quot;not one of ours&quot; to dismiss.
          </p>
          <div className="mt-2 flex flex-col gap-2">
            {unmatched.map((u) => (
              <form key={u.id} action={resolveZoomParticipant} className="flex flex-col gap-1 rounded-[6px] border border-border-faint p-2">
                <input type="hidden" name="unmatched_id" value={u.id} />
                <p className="text-sm text-ink">
                  {u.zoom_display_name}
                  {u.zoom_email ? <span className="text-muted"> · {u.zoom_email}</span> : null}
                </p>
                <select
                  name="volunteer_student_id"
                  defaultValue={u.suggested_volunteer_student_id ?? ""}
                  className="rounded-[6px] border border-border bg-card px-2 py-1 text-xs text-ink outline-none focus:border-primary"
                >
                  <option value="">Not one of ours</option>
                  {volunteers.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
                <button type="submit" className="self-start rounded-[6px] border border-border px-2 py-1 text-xs trainer-hover">
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
