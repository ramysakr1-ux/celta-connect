import { DEFAULT_TIMEZONE } from "@/lib/timetable-grid";

// One place that turns a stored instant into words.
//
// Two things went wrong repeatedly before this existed (audit, 6 Sep 2026 --
// 38 call sites across 21 files):
//
//   1. No timeZone. Vercel's Node runs at UTC, so a timestamptz formatted
//      without one is rendered in UTC, not at the centre. A note captured at
//      14:30 in Istanbul read 11:30; anything after 21:00 there, or before
//      05:00 in New York, showed the wrong DAY.
//   2. No locale. toLocaleDateString() with no arguments takes the runtime's
//      own locale -- en-US on Vercel -- so "9/6/2026" appeared among en-GB
//      dates everywhere else, and toLocaleString() added "5:12:33 PM".
//
// Both are silent: nothing throws, the page just says something untrue. So
// the zone is a required argument here rather than an option with a default
// -- a caller that has not thought about it cannot accidentally skip it, the
// same rule the timetable helpers already follow.
//
// Date-only columns (courses.start_date and friends) do NOT belong in
// formatDate. They are calendar dates, not instants: "2026-09-14" parses as
// UTC midnight, and formatting THAT in New York lands on the 13th. Use
// formatCalendarDate below, which is that pattern with a name.
//
// It had no name until 10 Sep 2026, only a paragraph telling you to write it
// out yourself, and the result was predictable: five files carry their own
// private copy of the same three lines, one live call site had reached for
// formatDate anyway and was rendering assignment due dates a day early for
// any centre west of UTC, and I made the same mistake within a minute of
// writing a new one. A rule you have to remember is a rule that gets missed;
// this is the same rule as a function you can call.

type Nullable = string | null | undefined;

/** "Sat 5 Sep" by default; pass opts for anything else. */
export function formatDate(iso: Nullable, timeZone: string, opts?: Intl.DateTimeFormatOptions): string {
  if (!iso) return "--";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...opts,
    timeZone: timeZone || DEFAULT_TIMEZONE,
  });
}

/** "Mon 14 Sep" -- for a DATE-ONLY value (courses.start_date, due_date and
 *  friends). No timeZone argument, deliberately: a calendar date does not
 *  have one, and accepting a zone here is what turns the 14th into the 13th. */
export function formatCalendarDate(iso: Nullable, opts?: Intl.DateTimeFormatOptions): string {
  if (!iso) return "--";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...opts,
  });
}

/** "14:30" -- 24-hour, the format the rest of the app uses. */
export function formatTime(iso: Nullable, timeZone: string, opts?: Intl.DateTimeFormatOptions): string {
  if (!iso) return "--";
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    ...opts,
    timeZone: timeZone || DEFAULT_TIMEZONE,
  });
}

/** "5 Sep 2026, 14:30". */
export function formatDateTime(iso: Nullable, timeZone: string): string {
  if (!iso) return "--";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timeZone || DEFAULT_TIMEZONE,
  });
}
