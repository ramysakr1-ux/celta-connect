// How a timetable event reads in a picker: "Mon 7 Sep · 10:00 · TP7 · A".
//
// Ramy, 5 Sep 2026, on the announcement composer's event list: "I don't
// really understand the numbers, like t seven eight two two six nine
// seven -- is that a date? time?" It was the raw database form,
// "TP7 · A — 2026-09-07 10:00:00". Dates are date-only strings, so the
// local-midnight parse is the same on server and browser.
export function eventOptionLabel(event: { title: string; event_date: string; event_time: string | null }): string {
  const day = new Date(`${event.event_date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const time = event.event_time ? event.event_time.slice(0, 5) : null;
  return [day, time, event.title].filter(Boolean).join(" · ");
}
