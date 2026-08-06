import { categorize } from "@/lib/timetable-grid";
import { deleteTimetableEvent, setAttendance } from "@/app/trainer/(hub)/timetable/actions";
import type { Database } from "@/lib/supabase/types";

type TimetableEvent = Database["public"]["Tables"]["course_timetable_events"]["Row"];
export type Volunteer = { id: string; name: string };

export const CATEGORY_CLASS: Record<string, string> = {
  admin: "bg-gold/12 text-ink",
  wg: "bg-accent text-accent-foreground",
  rm: "bg-card text-ink border border-border",
  iw: "bg-surface-muted text-muted",
  lu: "bg-background text-muted",
};

// Join opens ~10 min before the band's start and stays open through a
// generous window after -- exact lead time/duration rules are reserved to
// the content spec, this is a reasonable default. Computed from local date
// components, not a UTC round-trip (see the addWeekdays bug note in
// timetable-skeleton.ts -- same trap applies to any date math here).
function isLive(event: TimetableEvent, now: Date): boolean {
  if (!event.zoom_url || !event.event_time) return false;
  const [h, m] = event.event_time.split(":").map(Number);
  const start = new Date(`${event.event_date}T00:00:00`);
  start.setHours(h, m - 10, 0, 0);
  const end = new Date(`${event.event_date}T00:00:00`);
  end.setHours(h + 3, m, 0, 0);
  return now >= start && now <= end;
}

// Camera icon, traced from the sanctioned C14-timetable-A-floating.html
// reference's .join svg (a camera/video-call glyph, not a generic link icon).
function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-3" stroke="currentColor" fill="none" strokeWidth={2} aria-hidden="true">
      <path d="M15 10l4.5-2.5v9L15 14" />
      <rect x="3" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function JoinChip({ event, now }: { event: TimetableEvent; now: Date }) {
  if (!event.zoom_url) return null;
  const live = isLive(event, now);
  return (
    <a
      href={live ? event.zoom_url : undefined}
      target={live ? "_blank" : undefined}
      rel={live ? "noreferrer" : undefined}
      aria-disabled={!live}
      className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        live
          ? "border-primary bg-primary text-card"
          : "cursor-default border-border text-muted"
      }`}
    >
      <CameraIcon />
      Join
    </a>
  );
}

function EventRow({
  event,
  locked,
  now,
  showTime,
  volunteers,
  attendedIds,
  divider,
}: {
  event: TimetableEvent;
  locked: boolean;
  now: Date;
  showTime: (event: TimetableEvent) => boolean;
  volunteers: Volunteer[];
  attendedIds: Set<string>;
  divider: boolean;
}) {
  const category = categorize(event);
  return (
    <div className={divider ? "mt-1.5 border-t border-current/15 pt-1.5" : ""}>
      <div className="flex items-start justify-between gap-1">
        <span className="font-medium">{event.title}</span>
        {!locked ? (
          <form action={deleteTimetableEvent}>
            <input type="hidden" name="event_id" value={event.id} />
            <button type="submit" className="shrink-0 text-[10px] text-destructive hover:underline">
              ×
            </button>
          </form>
        ) : null}
      </div>
      {showTime(event) && event.event_time ? (
        <span className="mt-0.5 block opacity-80">{event.event_time.slice(0, 5)}</span>
      ) : null}
      {event.tag && category === "rm" ? <span className="mt-0.5 block opacity-70">{event.tag}</span> : null}
      <JoinChip event={event} now={now} />
      {event.type === "tp" && volunteers.length > 0 ? (
        <details className="mt-1">
          <summary className="cursor-pointer text-[10px] opacity-70 hover:opacity-100">
            Attendance ({attendedIds.size}/{volunteers.length})
          </summary>
          <form
            action={setAttendance}
            className="mt-1 flex flex-col gap-1 rounded-[6px] border border-border-faint bg-card p-2 text-ink"
          >
            <input type="hidden" name="event_id" value={event.id} />
            {volunteers.map((v) => (
              <label key={v.id} className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  name="attended_volunteer_id"
                  value={v.id}
                  defaultChecked={attendedIds.has(v.id)}
                />
                {v.name}
              </label>
            ))}
            <button type="submit" className="mt-0.5 self-start rounded-[6px] border border-border px-2 py-0.5 hover:border-primary">
              Save
            </button>
          </form>
        </details>
      ) : null}
    </div>
  );
}

// One cell can hold several events at the same time/band (e.g. a plenary
// "GTKY" immediately followed by "Course Orientation") -- these render as
// ONE shared coloured box with the events stacked as internal rows/dividers,
// not as separate bordered/padded cards. Rendering each as its own full
// EventCell (the original design) made any cell with >1 event balloon in
// height relative to its neighbours in the same row -- table rows share a
// height, so that one tall cell dragged the whole row tall and left the
// other (1-event) cells in it looking like mostly-empty padding around a
// small pill: "not symmetrical" (confirmed live, 6 Aug 2026, off a real
// ITI-Istanbul demo where Mon 10:00 had two plenary items). One shared box
// with internal dividers matches how the real paper timetable shows it too
// (a single merged cell, multi-line), not a stack of separate cards.
export function EventCell({
  events,
  locked,
  now,
  showTime,
  volunteers,
  attendedByEvent,
}: {
  events: TimetableEvent[];
  locked: boolean;
  now: Date;
  showTime: (event: TimetableEvent) => boolean;
  volunteers: Volunteer[];
  attendedByEvent: Map<string, Set<string>>;
}) {
  if (events.length === 0) return null;
  const category = categorize(events[0]);
  const emptySet = new Set<string>();
  return (
    <div className={`rounded-[6px] p-2 text-xs leading-snug ${CATEGORY_CLASS[category]}`}>
      {events.map((event, i) => (
        <EventRow
          key={event.id}
          event={event}
          locked={locked}
          now={now}
          showTime={showTime}
          volunteers={volunteers}
          attendedIds={attendedByEvent.get(event.id) ?? emptySet}
          divider={i > 0}
        />
      ))}
    </div>
  );
}
