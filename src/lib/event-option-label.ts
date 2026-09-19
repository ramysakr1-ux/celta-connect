import { formatCalendarDate } from "@/lib/format-date";
// How a timetable event reads in a picker: "Mon 7 Sep · 10:00 · TP7 · A".
//
// Ramy, 5 Sep 2026, on the announcement composer's event list: "I don't
// really understand the numbers, like t seven eight two two six nine
// seven -- is that a date? time?" It was the raw database form,
// "TP7 · A — 2026-09-07 10:00:00". Dates are date-only strings, so the
// local-midnight parse is the same on server and browser.
export function eventOptionLabel(event: { title: string; event_date: string; event_time: string | null; detail?: string | null }): string {
  const day = formatCalendarDate(event.event_date, { weekday: "short", day: "numeric", month: "short" });
  const time = event.event_time ? event.event_time.slice(0, 5) : null;
  // Two groups teach in parallel, so a TP day lists "TP7 · A" twice at
  // 10:00 with nothing to tell them apart; the level (the row's detail) is
  // what does (19 Sep 2026).
  const level = /^TP\d/.test(event.title) && event.detail ? event.detail : null;
  return [day, time, event.title, level].filter(Boolean).join(" · ");
}
