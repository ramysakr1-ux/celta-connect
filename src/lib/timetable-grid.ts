import type { Database, TimeBand } from "@/lib/supabase/types";

export type TimetableEvent = Database["public"]["Tables"]["course_timetable_events"]["Row"];

export type { TimeBand };

// §1.1a v2 (transposed orientation, settled 5 Aug 2026) -- the real slot
// structure from the sanctioned C14-2026 reference. A day runs 10:00-18:00
// across these six bands; "Admin & deadlines" is a separate leading column,
// not a band. This is now just the DEFAULT shape a new course starts with --
// three real historical timetables (full-time, afternoon, online) each ran a
// genuinely different daily structure, so it's editable per course
// (courses.time_bands) via the timetable settings form; every function below
// takes the active bands as a parameter instead of reading this constant
// directly, and callers fall back to this default when a course hasn't
// customised it (time_bands is null).
export const DEFAULT_TIME_BANDS: TimeBand[] = [
  { start: "10:00", end: "12:30", label: "10:00–12:30" },
  { start: "12:45", end: "13:30", label: "12:45–13:30" },
  { start: "13:45", end: "14:30", label: "13:45–14:30" },
  { start: "14:30", end: "15:30", label: "14:30–15:30" },
  { start: "15:30", end: "17:00", label: "15:30–17:00" },
  { start: "17:00", end: "18:00", label: "17:00–18:00" },
];

/** A course's active time bands -- its own customised shape, or the default. */
export function resolveTimeBands(courseTimeBands: TimeBand[] | null | undefined): TimeBand[] {
  return courseTimeBands && courseTimeBands.length > 0 ? courseTimeBands : DEFAULT_TIME_BANDS;
}

export type CellCategory = "admin" | "wg" | "rm" | "iw" | "lu" | "cs";

// Moved from event-cell.tsx (checkpoint 2) -- the Today dashboard needs the
// exact same "is this Zoom event live right now" calc for its own schedule
// card, so both places read from one definition instead of two that could
// drift. Join opens ~10 min before the band's start and stays open through
// a generous window after -- exact lead time/duration rules are reserved to
// the content spec, this is a reasonable default. Computed from local date
// components, not a UTC round-trip (see the addWeekdays bug note in
// timetable-skeleton.ts -- same trap applies to any date math here).
export function isEventLive(event: TimetableEvent, now: Date): boolean {
  if (!event.zoom_url || !event.event_time) return false;
  const [h, m] = event.event_time.split(":").map(Number);
  const start = new Date(`${event.event_date}T00:00:00`);
  start.setHours(h, m - 10, 0, 0);
  const end = new Date(`${event.event_date}T00:00:00`);
  end.setHours(h + 3, m, 0, 0);
  return now >= start && now <= end;
}

// §1.1a v2 colour legend, category derived from the event's own type/tag,
// never hand-painted: assignment/resubmission due dates always live in the
// Admin column regardless of time; a "lunch" tag gets its own pale style
// (matches the sanctioned C14-timetable-A-floating.html reference, where
// lunch is a normal timetable entry occupying whatever band its time lands
// in that day, not a fixed gap -- lunch genuinely moves day to day);
// everything else is time-slotted and then styled by tag -- "whole_group" =
// teal (join Zoom), "individual" = grey (off-Zoom solo work), anything else
// (a TP group code or tutor name, or no tag at all on a TP-type event) =
// "your group's room" (white + border).
export function categorize(event: TimetableEvent): CellCategory {
  if (event.type === "assignment_due" || event.type === "resubmission_due") return "admin";
  if (event.tag === "lunch") return "lu";
  if (event.tag === "whole_group") return "wg";
  if (event.tag === "individual") return "iw";
  // remaining-compliance.md item 2: consultation time is one of the
  // syllabus's own named 120-hour categories (alongside input, planning,
  // TP, feedback, peer observation, observation of experienced teachers) --
  // renamed into a real tag here, not a new kind of slot. Tutorials,
  // resubmission clinics and planning support were already being run as
  // ordinary tagged events; this just gives them the syllabus's own word.
  if (event.tag === "consultation") return "cs";
  if (event.tag) return "rm";
  return event.type === "tp" ? "rm" : "iw";
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m ?? 0);
}

/** Finds which of the course's time bands an event's time falls in -- defaults to
 * the nearest band (first if earlier than the day starts, last if later) so nothing
 * generated outside the day's span silently disappears from the grid. */
export function bandIndexFor(eventTime: string | null, timeBands: TimeBand[] = DEFAULT_TIME_BANDS): number {
  if (!eventTime) return 0;
  const minutes = toMinutes(eventTime);
  for (let i = 0; i < timeBands.length; i += 1) {
    if (minutes < toMinutes(timeBands[i].end)) return i;
  }
  return timeBands.length - 1;
}

// remaining-compliance.md "Changed by decision": quiet hours derive from
// the real timetable rather than a fixed clock -- a part-time course
// teaching until 21:30 shouldn't go quiet at the same hour a full-time
// course does. "An hour after the last timetabled session that day" is the
// rule; events only carry a start time, so "last session" is the latest
// event_time on the day, not a computed end. Informational only -- no
// message queueing/blocking infrastructure exists to actually hold
// anything until morning, this just tells a trainee messaging late that a
// reply won't come until then.
export function computeQuietHoursNote(
  todaysEventTimes: (string | null)[],
  now: Date
): string | null {
  const times = todaysEventTimes.filter((t): t is string => !!t).sort();
  if (times.length === 0) return null;
  const lastEventTime = times[times.length - 1];
  const [h, m] = lastEventTime.split(":").map(Number);
  const quietFrom = new Date(now);
  quietFrom.setHours(h + 1, m, 0, 0);
  if (now < quietFrom) return null;
  return `Quiet hours -- today's last session ended a while ago, so your tutor likely won't reply until morning.`;
}

/** True when an event's own time doesn't match its band's default start --
 * the grid must print the real time inside the cell in that case (§1.1a v2 rule 4). */
export function overridesband(event: TimetableEvent, timeBands: TimeBand[] = DEFAULT_TIME_BANDS): boolean {
  if (!event.event_time) return false;
  const band = timeBands[bandIndexFor(event.event_time, timeBands)];
  return event.event_time.slice(0, 5) !== band.start;
}

export interface DayRow {
  /** Raw ISO date, e.g. "2026-09-07" -- stable React key, unlike the display label. */
  isoDate: string;
  /** Display label, e.g. "Mon 7". */
  date: string;
  weekday: string;
  weekLabel: string | null;
  admin: TimetableEvent[];
  bands: TimetableEvent[][];
}

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Formats a Date from its local components, not `toISOString()`, which
 * round-trips through UTC and silently shifts the date by a day whenever the
 * server's timezone is ahead of UTC (e.g. Europe/Istanbul -- see the same
 * trap already caught and fixed in timetable-skeleton.ts). */
/**
 * Formats a Date from its local components, not `toISOString()`, which
 * round-trips through UTC and silently shifts the date by a day whenever the
 * server's timezone is ahead of UTC (e.g. Europe/Istanbul -- confirmed live
 * this session). Exported so any "today" comparison elsewhere in the app
 * uses the same safe pattern instead of repeating the bug.
 */
export function toLocalIso(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Groups events into one row per distinct date that actually has an event
 * (so a part-time course's non-meeting days don't render as empty rows),
 * inserting a week-label break whenever the ISO week changes. */
export function buildDayRows(events: TimetableEvent[], timeBands: TimeBand[] = DEFAULT_TIME_BANDS): DayRow[] {
  const byDate = new Map<string, TimetableEvent[]>();
  for (const event of events) {
    const list = byDate.get(event.event_date) ?? [];
    list.push(event);
    byDate.set(event.event_date, list);
  }

  const dates = [...byDate.keys()].sort();
  let currentWeekStart: string | null = null;

  return dates.map((isoDate) => {
    const dayEvents = byDate.get(isoDate)!;
    const d = new Date(`${isoDate}T00:00:00`);
    const weekday = WEEKDAY_NAMES[d.getDay()];
    const dayOfMonth = d.getDate();

    const mondayOffset = (d.getDay() + 6) % 7;
    const monday = new Date(d);
    monday.setDate(d.getDate() - mondayOffset);
    const weekKey = toLocalIso(monday);

    let weekLabel: string | null = null;
    if (weekKey !== currentWeekStart) {
      currentWeekStart = weekKey;
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const fmt = (dt: Date) => dt.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
      weekLabel = `${fmt(monday)} – ${fmt(sunday)}`;
    }

    const admin = dayEvents.filter((e) => categorize(e) === "admin");
    const bands: TimetableEvent[][] = timeBands.map(() => []);
    for (const event of dayEvents) {
      if (categorize(event) === "admin") continue;
      bands[bandIndexFor(event.event_time, timeBands)].push(event);
    }

    return { isoDate, date: `${weekday} ${dayOfMonth}`, weekday, weekLabel, admin, bands };
  });
}
