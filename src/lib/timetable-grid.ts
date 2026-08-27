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
  // Ramy, 27 Aug 2026: the live-now bar should fire for an in-person
  // session too (its own design reference's worked example is a TP, not a
  // Zoom session) -- "live" is purely a time-window fact now. Callers that
  // render a Join action still gate that separately on event.zoom_url
  // existing (unchanged) -- only the status/indicator side stops requiring
  // a link to exist.
  if (!event.event_time) return false;
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

// centers.time_zone's own column default (migration 0223) -- the one place
// this value is allowed to be implicit, for code with genuinely no centre
// in scope yet (seed/demo data). Every real call site should have a real
// centre's timeZone in hand instead of reaching for this.
export const DEFAULT_TIMEZONE = "Europe/Istanbul";

/**
 * Formats a Date as the calendar date it is at a given centre, regardless of
 * what timezone the server process itself is running in. `timeZone` is a
 * required IANA identifier (centers.time_zone) rather than a hardcoded
 * constant -- multi-centre support (2026-08-26) means "today" depends on
 * which centre is asking, not one app-wide value. The old version used the
 * Date object's own local components (getFullYear/getMonth/getDate), which
 * are only correct when the server's OS timezone happens to match the
 * centre's -- it doesn't: Vercel's Node runtime has no TZ set (defaults to
 * UTC), and the "confirmed live" note that used to justify that approach was
 * actually testing against a dev sandbox, not real production.
 * Intl.DateTimeFormat with an explicit timeZone sidesteps the question of
 * what zone the process is in entirely -- correct on any host, and rolls
 * over at the centre's own midnight rather than the process's.
 */
export function toLocalIso(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(d);
}

/** Minutes since midnight at a given centre -- same reasoning as toLocalIso,
 * for code comparing against an "HH:MM" wall-clock time (e.g. matching a
 * Zoom join event to the closest scheduled TP slot) instead of a calendar
 * date. */
export function toLocalMinutes(d: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

/**
 * Converts an event's wall-clock date/time (as stored -- "2026-08-26" +
 * "14:00:00", meaning 2pm at the centre) into the real UTC instant it
 * represents. `new Date(`${event_date}T${event_time}`)` -- used in a few
 * places to compute "is this event starting soon" -- parses that string in
 * the SERVER's own local timezone, not the centre's, so it silently
 * computes the wrong real-world moment whenever they differ (which is most
 * of the time: Vercel's Node runtime defaults to UTC). This finds the
 * target timezone's actual UTC offset at that date (DST-aware) via a
 * round-trip through Intl, rather than assuming a fixed offset.
 */
export function zonedTimeToUtc(dateIso: string, timeStr: string, timeZone: string): Date {
  const naiveUtc = new Date(`${dateIso}T${timeStr.slice(0, 5)}:00Z`);
  const asTz = new Date(naiveUtc.toLocaleString("en-US", { timeZone }));
  const asUtc = new Date(naiveUtc.toLocaleString("en-US", { timeZone: "UTC" }));
  const offsetMs = asUtc.getTime() - asTz.getTime();
  return new Date(naiveUtc.getTime() + offsetMs);
}

/** Groups events into one row per day, Mon-Fri always present across the
 * whole event-date span even when empty -- same rule the trainer's own
 * editable grid uses (drag-board.tsx's buildWeeks), so the trainee/staff-
 * preview read-only board doesn't silently drop days that just haven't been
 * populated yet. Weekends only get a row if a real event already lands
 * there, so the grid doesn't widen for a course that never meets on
 * weekends. Was previously events-only ("so a part-time course's
 * non-meeting days don't render as empty rows") -- corrected 2026-08-27
 * after Ramy flagged the read-only trainee timetable looking incomplete
 * next to the trainer's own full-skeleton grid; drag-board.tsx doesn't
 * special-case part-time courses either, so this doesn't need to. */
export function buildDayRows(events: TimetableEvent[], timeBands: TimeBand[] = DEFAULT_TIME_BANDS): DayRow[] {
  const byDate = new Map<string, TimetableEvent[]>();
  for (const event of events) {
    const list = byDate.get(event.event_date) ?? [];
    list.push(event);
    byDate.set(event.event_date, list);
  }

  const eventDates = [...byDate.keys()].sort();
  const dates: string[] = [];
  if (eventDates.length > 0) {
    const cursor = new Date(`${eventDates[0]}T00:00:00`);
    const last = new Date(`${eventDates[eventDates.length - 1]}T00:00:00`);
    while (cursor <= last) {
      const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
      const isWeekday = cursor.getDay() >= 1 && cursor.getDay() <= 5;
      if (isWeekday || byDate.has(iso)) dates.push(iso);
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  let currentWeekStart: string | null = null;

  return dates.map((isoDate) => {
    const dayEvents = byDate.get(isoDate) ?? [];
    const d = new Date(`${isoDate}T00:00:00`);
    const weekday = WEEKDAY_NAMES[d.getDay()];
    const dayOfMonth = d.getDate();

    const mondayOffset = (d.getDay() + 6) % 7;
    const monday = new Date(d);
    monday.setDate(d.getDate() - mondayOffset);
    // Not toLocalIso() -- monday was built by pure calendar arithmetic off
    // an already-known date string (no "current real-world moment" or
    // centre timezone involved), so it needs the same local round-trip its
    // own construction used, not a real timezone conversion.
    const weekKey = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;

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
