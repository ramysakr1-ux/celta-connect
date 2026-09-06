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
// Date-only columns (courses.start_date and friends) do NOT belong here.
// They are calendar dates, not instants; the established pattern for those
// is new Date(`${iso}T00:00:00`), which parses and formats in one zone and
// so preserves the day.

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
