import type { TimeBand } from "@/lib/supabase/types";
import { bandIndexFor, categorize, resolveTimeBands, zonedTimeToUtc, type TimetableEvent } from "@/lib/timetable-grid";
import { toDisplayCategory, type DisplayCategory } from "@/lib/timetable-category-style";

// The trainee's day, as the Course Stream landing draws it.
//
// design_handoff_trainee_landing: a horizontal track where "empty columns are
// real gaps in the day -- the shape of the day is legible without reading a
// single label."
//
// Two departures from that handoff, both because this codebase already knows
// better than the prototype did:
//
// 1. The handoff hardcodes 09:00-17:00 in sixteen half-hour columns. This app
//    has courses.time_bands -- the real daily structure, editable per course,
//    nine 45-minute bands from 10:00 to 18:00 by default. So the window is the
//    first band's start to the last band's end, and the gaps between bands
//    (11:30-11:45, 12:30-12:45, ...) are the day's real breaks rather than an
//    invented grid's rounding.
//
// 2. Those half-hour columns also collided: a TP is 45 minutes, so a 09:30 and
//    a 10:15 lesson both claimed the 10:00-10:30 column and rendered on top of
//    each other. Blocks are placed by percentage instead of by column, which is
//    exact for any band shape and cannot collide.
//
// Events carry a start but no end, so a session ends when its band ends. That
// is the same bridge the timetable grid itself uses to decide which band an
// event belongs to, read in the other direction.

/** Minutes past midnight, centre-local, from "HH:MM" or "HH:MM:SS". */
function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m ?? 0);
}

/** The floor a session gets when its band somehow ends before it starts -- an
 *  override placed after the last band, most likely. Matches today-tab's own
 *  TP_LESSON_LENGTH_MINUTES rather than inventing a second number. */
const MIN_SLOT_MINUTES = 45;

export interface StreamSlot {
  id: string;
  /** "10:00" -- the centre's wall clock, as timetabled. */
  time: string;
  title: string;
  sub: string | null;
  /** Minutes past midnight, centre-local. Placement only. */
  fromMin: number;
  toMin: number;
  /** UTC ms, resolved in the centre's zone on the server. State only. */
  startsAtMs: number;
  endsAtMs: number;
  /** This trainee is the one teaching -- the block that carries the gold. */
  mine: boolean;
  zoomUrl: string | null;
  /** The timetable's own category for this event, so the Your-day card can
   *  wear the same glass tint as the same session on the 4-week grid. */
  category: DisplayCategory;
}

export interface StreamDay {
  slots: StreamSlot[];
  /** Minutes past midnight; the track's left and right edges. */
  windowStart: number;
  windowEnd: number;
  /** The axis labels, evenly spaced across the window. */
  axis: string[];
}

/** A deadline is not a session -- it has no duration and nothing happens at a
 *  time. Those belong in Catch up, so they never reach the track. */
const TRACK_TYPES = new Set<TimetableEvent["type"]>(["tp", "input_session", "milestone", "supervised_session"]);

function hhmm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function buildStreamDay({
  events,
  timeBands,
  dateIso,
  timeZone,
  mineEventIds,
  tpGroupId,
}: {
  events: TimetableEvent[];
  timeBands: TimeBand[] | null | undefined;
  dateIso: string;
  timeZone: string;
  /** Timetable event ids this trainee is teaching. */
  mineEventIds: Set<string>;
  /** The trainee's TP group, so another group's lessons stay off their day. */
  tpGroupId: string | null;
}): StreamDay {
  const bands = resolveTimeBands(timeBands);
  const windowStart = toMinutes(bands[0].start);
  const windowEnd = toMinutes(bands[bands.length - 1].end);

  const slots: StreamSlot[] = [];
  for (const event of events) {
    if (!TRACK_TYPES.has(event.type)) continue;
    if (!event.event_time) continue;
    // A TP scoped to a group that isn't this trainee's is somebody else's day.
    if (event.tp_group_scope_id && tpGroupId && event.tp_group_scope_id !== tpGroupId) continue;

    const fromMin = toMinutes(event.event_time);
    const band = bands[bandIndexFor(event.event_time, bands)];
    const bandEnd = toMinutes(band.end);
    const toMin = bandEnd > fromMin ? bandEnd : fromMin + MIN_SLOT_MINUTES;

    slots.push({
      id: event.id,
      time: event.event_time.slice(0, 5),
      title: event.title,
      sub: event.detail,
      fromMin,
      toMin,
      startsAtMs: zonedTimeToUtc(dateIso, event.event_time, timeZone).getTime(),
      endsAtMs: zonedTimeToUtc(dateIso, hhmm(toMin), timeZone).getTime(),
      mine: mineEventIds.has(event.id),
      zoomUrl: event.zoom_url,
      category: toDisplayCategory(categorize(event)),
    });
  }
  slots.sort((a, b) => a.fromMin - b.fromMin || a.title.localeCompare(b.title));

  // An override can sit outside every band (bandIndexFor clamps to the nearest
  // rather than dropping it). Widen rather than clip -- a session the trainee
  // cannot see is worse than an axis that doesn't match the bands exactly.
  const earliest = slots.length > 0 ? Math.min(windowStart, slots[0].fromMin) : windowStart;
  const latest = slots.length > 0 ? Math.max(windowEnd, ...slots.map((s) => s.toMin)) : windowEnd;

  const span = latest - earliest;
  const axis = [hhmm(earliest), hhmm(earliest + Math.round(span / 2 / 15) * 15), hhmm(latest)];

  return { slots, windowStart: earliest, windowEnd: latest, axis };
}
