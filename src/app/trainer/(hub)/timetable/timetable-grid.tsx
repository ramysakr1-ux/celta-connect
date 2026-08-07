import { Fragment } from "react";
import { buildDayRows, overridesband, toLocalIso, resolveTimeBands } from "@/lib/timetable-grid";
import { EventCell, type Volunteer } from "@/app/trainer/(hub)/timetable/event-cell";
import { ScrollToToday } from "@/app/trainer/(hub)/timetable/scroll-to-today";
import { MobileDayView } from "@/app/trainer/(hub)/timetable/mobile-day-view";
import type { Database, TimeBand } from "@/lib/supabase/types";

type TimetableEvent = Database["public"]["Tables"]["course_timetable_events"]["Row"];

export function TimetableGrid({
  events,
  locked,
  volunteers,
  attendedByEvent,
  timeBands: courseTimeBands,
}: {
  events: TimetableEvent[];
  locked: boolean;
  volunteers: Volunteer[];
  attendedByEvent: Map<string, Set<string>>;
  timeBands?: TimeBand[] | null;
}) {
  const TIME_BANDS = resolveTimeBands(courseTimeBands);
  const rows = buildDayRows(events, TIME_BANDS);
  const now = new Date();
  const today = toLocalIso(now);

  if (rows.length === 0) return null;

  // Every box the entire grid the same size, no exceptions -- confirmed
  // explicitly, twice (6 Aug 2026): "not just height, the entire
  // dimensions should be identical." An earlier attempt matched the
  // reference file's OWN hand-tuned per-column pixel values (120/170/130/
  // 150/130/160/140, narrow but not equal) and its own row heights (which
  // measured 51-92px, also not equal) -- both rejected. Admin & deadlines
  // and every time band now share one identical width; every day row
  // shares one identical height. A cell with more content than fits
  // scrolls internally (overflow-y-auto on the cell content, see the <td>
  // rendering below) rather than growing that one row or silently
  // clipping data. The day-name gutter (leftmost, just "Mon 10" labels)
  // stays its own narrow fixed 64px -- it isn't one of "the boxes", it's
  // the row header.
  const COLUMN_WIDTH_PX = 147;
  const ROW_HEIGHT_PX = 96;
  const adminWidthPx = COLUMN_WIDTH_PX;
  const bandWidthPx = () => COLUMN_WIDTH_PX;
  const totalBandAreaPx = TIME_BANDS.length * COLUMN_WIDTH_PX;

  // Hairline chrome (apply-to-app.md §2.1): border-collapse instead of
  // border-spacing, so the grid reads as one continuous surface with
  // dividers rather than rounded boxes floating inside a sheet. Every cell
  // still needs its own border-b/border-r since border-collapse dedupes
  // adjacent borders automatically -- we only suppress the outer edge
  // (last column's right border, last row's bottom border) so the grid
  // doesn't double up against the .sheet wrapper's own border.
  const isLastRow = (rowIndex: number) => rowIndex === rows.length - 1;
  const cellBorder = (isLastCol: boolean, isLastRowHere: boolean) =>
    `${isLastCol ? "" : "border-r"} ${isLastRowHere ? "" : "border-b"} border-border-faint`;

  return (
    <>
      {/* §1.1a v2 rule 10 -- desktop keeps the full transposed grid; mobile
          collapses to one day at a time rather than shrinking the table. */}
      <div className="hidden md:block max-[1240px]:overflow-x-auto pb-24">
        <ScrollToToday />
        <table
          className="w-full table-fixed border-collapse"
          style={{ minWidth: `${64 + adminWidthPx + totalBandAreaPx}px` }}
        >
          {/* table-layout:fixed sizes every column off THIS colgroup, never
              content -- without it the browser auto-sizes each column to
              its widest cell across the whole table (confirmed live: some
              columns 69px, others 219px, next to each other, purely from
              one long event title anywhere in that column). Day-name stays
              its own narrow fixed 64px; Admin and every band share the one
              identical COLUMN_WIDTH_PX (not calc()/percentage -- confirmed
              live, twice now, that <col style="width: calc(...)"> silently
              does NOT differentiate columns under table-layout:fixed in
              this browser -- a concrete px number is required). */}
          <colgroup>
            <col className="w-16" />
            <col style={{ width: `${adminWidthPx}px` }} />
            {TIME_BANDS.map((band) => (
              <col key={band.label} style={{ width: `${bandWidthPx()}px` }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="sticky top-0 left-0 z-20 w-16 bg-background p-0 border-b border-border" />
              <th className="sticky top-0 z-10 bg-background px-2.5 pb-2.5 text-left align-bottom border-b border-border">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gold">
                  Admin &amp; deadlines
                </span>
              </th>
              {TIME_BANDS.map((band) => (
                <th
                  key={band.label}
                  className="sticky top-0 z-10 bg-background px-2.5 pb-2.5 text-left align-bottom border-b border-border"
                >
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                    {band.start}
                  </span>
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                    {band.end}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => {
              const isToday = row.isoDate === today;
              const lastRowHere = isLastRow(rowIndex);
              const [weekday, dayOfMonth] = row.date.split(" ");
              return (
                <Fragment key={row.isoDate}>
                  {row.weekLabel ? (
                    <tr key={`${row.isoDate}-week`}>
                      <td colSpan={TIME_BANDS.length + 2} className="pt-6 pb-2 font-serif text-base text-muted">
                        {row.weekLabel}
                      </td>
                    </tr>
                  ) : null}
                  <tr key={row.isoDate} data-today={isToday ? "" : undefined} style={{ height: ROW_HEIGHT_PX }}>
                    <td
                      className={`sticky left-0 z-10 w-16 bg-card p-2 align-top ${cellBorder(false, lastRowHere)} ${
                        isToday ? "border-l-[3px] border-primary" : ""
                      }`}
                      style={{ height: ROW_HEIGHT_PX }}
                    >
                      <span className={`block font-serif text-[20px] leading-none ${isToday ? "text-primary" : "text-ink"}`}>
                        {dayOfMonth}
                      </span>
                      <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                        {weekday}
                      </span>
                    </td>
                    <td className={`align-top p-0 ${cellBorder(false, lastRowHere)}`} style={{ height: ROW_HEIGHT_PX }}>
                      <div className="h-full overflow-y-auto p-2.5" style={{ height: ROW_HEIGHT_PX }}>
                        <EventCell
                          events={row.admin}
                          locked={locked}
                          now={now}
                          showTime={() => false}
                          volunteers={volunteers}
                          attendedByEvent={attendedByEvent}
                        />
                      </div>
                    </td>
                    {row.bands.map((bandEvents, i) => (
                      <td
                        key={TIME_BANDS[i].label}
                        className={`align-top p-0 ${cellBorder(i === TIME_BANDS.length - 1, lastRowHere)}`}
                        style={{ height: ROW_HEIGHT_PX }}
                      >
                        <div className="h-full overflow-y-auto p-2.5" style={{ height: ROW_HEIGHT_PX }}>
                          <EventCell
                            events={bandEvents}
                            locked={locked}
                            now={now}
                            showTime={(event) => overridesband(event, TIME_BANDS)}
                            volunteers={volunteers}
                            attendedByEvent={attendedByEvent}
                          />
                        </div>
                      </td>
                    ))}
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="md:hidden">
        <MobileDayView
          rows={rows}
          today={today}
          locked={locked}
          volunteers={volunteers}
          timeBands={TIME_BANDS}
          attendedByEvent={Object.fromEntries(
            [...attendedByEvent.entries()].map(([eventId, ids]) => [eventId, [...ids]])
          )}
        />
      </div>
    </>
  );
}
