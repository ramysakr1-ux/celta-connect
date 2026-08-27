import { categorize, isEventLive, type TimetableEvent } from "@/lib/timetable-grid";
import { setAttendance, setEventDetail, setInputSessionCriteria, setTpEventMode } from "@/app/trainer/(hub)/timetable/actions";
import { DeleteEventButton } from "@/app/trainer/(hub)/timetable/delete-event-button";

export type Volunteer = { id: string; name: string };

// apply-to-app.md §2.4 -- category is now a 3px left rule + dot, not a
// background fill. `lu` (lunch) gets no rule at all, it should recede.
export const CATEGORY_ACCENT: Record<string, string> = {
  admin: "var(--color-status-warning-text)",
  wg: "var(--color-primary)",
  rm: "var(--color-ink)",
  iw: "var(--color-muted)",
  lu: "transparent",
  cs: "var(--color-bronze)",
};

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
  const live = isEventLive(event, now);
  // apply-to-app.md §2.5 -- live gets a real pill (with a leading dot so it
  // catches the eye across a busy grid); not-live is icon-only, no
  // pill/border/label, so a whole column of un-joinable Zoom links doesn't
  // read as the loudest thing on the page. Dot re-pointed off gold per the
  // color audit (2026-08-21) -- primary-foreground (a plain light dot on
  // the teal pill), matching the identical "Live · join" dot on the trainer
  // home page rather than inventing a second treatment.
  if (!live) {
    return (
      <span
        className="mt-1 inline-flex items-center text-muted/70"
        title="Zoom link -- opens 10 minutes before the session"
        aria-disabled="true"
      >
        <CameraIcon />
      </span>
    );
  }
  return (
    <a
      href={event.zoom_url}
      target="_blank"
      rel="noreferrer"
      className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-primary-foreground"
    >
      <span className="size-[5px] shrink-0 rounded-full bg-primary-foreground" />
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
  mixedMode,
}: {
  event: TimetableEvent;
  locked: boolean;
  now: Date;
  showTime: (event: TimetableEvent) => boolean;
  volunteers: Volunteer[];
  attendedIds: Set<string>;
  divider: boolean;
  mixedMode: boolean;
}) {
  const category = categorize(event);
  return (
    <div className={divider ? "mt-1.5 border-t border-border-faint pt-1.5" : ""}>
      <div className="flex items-start justify-between gap-1">
        <span className="text-[12px] font-medium text-ink">{event.title}</span>
        {!locked ? <DeleteEventButton eventId={event.id} compact /> : null}
      </div>
      {showTime(event) && event.event_time ? (
        <span className="mt-0.5 block text-[10px] text-muted">{event.event_time.slice(0, 5)}</span>
      ) : null}
      {event.tag && category === "rm" ? (
        <span className="mt-0.5 block text-[10px] text-muted">{event.tag}</span>
      ) : null}
      <JoinChip event={event} now={now} />
      {!locked ? (
        <details className="mt-1">
          <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[0.12em] text-muted hover:text-ink">
            {event.detail ? `Subtitle: ${event.detail}` : "Set subtitle"}
          </summary>
          <form action={setEventDetail} className="sheet mt-1 flex flex-col gap-1 p-2.5 text-xs">
            <input type="hidden" name="event_id" value={event.id} />
            <input
              name="detail"
              type="text"
              defaultValue={event.detail ?? ""}
              placeholder="Supervised, Observation task…"
              className="rounded-[6px] border border-border bg-card px-2 py-1 text-xs text-ink outline-none focus:border-primary"
            />
            <button type="submit" className="mt-0.5 self-start rounded-[6px] border border-border px-2 py-0.5 trainer-hover-fill">
              Save
            </button>
          </form>
        </details>
      ) : event.detail ? (
        <span className="mt-0.5 block text-[10px] text-muted">{event.detail}</span>
      ) : null}
      {event.type === "input_session" ? (
        <details className="mt-1">
          <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[0.12em] text-muted hover:text-ink">
            {event.input_session_criteria.length > 0 ? `Criteria: ${event.input_session_criteria.join(", ")}` : "Set criteria"}
          </summary>
          <form action={setInputSessionCriteria} className="sheet mt-1 flex flex-col gap-1 p-2.5 text-xs">
            <input type="hidden" name="event_id" value={event.id} />
            <input
              name="input_session_criteria"
              type="text"
              defaultValue={event.input_session_criteria.join(", ")}
              placeholder="4c, 5f"
              className="rounded-[6px] border border-border bg-card px-2 py-1 text-xs text-ink outline-none focus:border-primary"
            />
            <button type="submit" className="mt-0.5 self-start rounded-[6px] border border-border px-2 py-0.5 trainer-hover-fill">
              Save
            </button>
          </form>
        </details>
      ) : null}
      {event.type === "tp" && mixedMode ? (
        <details className="mt-1">
          <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[0.12em] text-muted hover:text-ink">
            {event.mode ? `Mode: ${event.mode === "f2f" ? "Face-to-face" : "Online"}` : "Set mode"}
          </summary>
          <form action={setTpEventMode} className="sheet mt-1 flex flex-col gap-1 p-2.5 text-xs">
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
            <button type="submit" className="mt-0.5 self-start rounded-[6px] border border-border px-2 py-0.5 trainer-hover-fill">
              Save
            </button>
          </form>
        </details>
      ) : null}
      {event.type === "tp" && volunteers.length > 0 ? (
        <details className="mt-1">
          <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[0.12em] text-muted hover:text-ink">
            Attendance {attendedIds.size}/{volunteers.length}
          </summary>
          <form action={setAttendance} className="sheet mt-1 flex flex-col gap-1 p-2.5 text-xs">
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
            <button type="submit" className="mt-0.5 self-start rounded-[6px] border border-border px-2 py-0.5 trainer-hover-fill">
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
  mixedMode,
}: {
  events: TimetableEvent[];
  locked: boolean;
  now: Date;
  showTime: (event: TimetableEvent) => boolean;
  volunteers: Volunteer[];
  attendedByEvent: Map<string, Set<string>>;
  mixedMode: boolean;
}) {
  if (events.length === 0) return null;
  const category = categorize(events[0]);
  const emptySet = new Set<string>();
  const accent = CATEGORY_ACCENT[category];
  return (
    <div
      className={`group bg-transparent text-xs leading-snug ${
        category === "lu" ? "pl-0 text-muted" : "border-l-[3px] pl-2.5"
      }`}
      style={category === "lu" ? undefined : { borderLeftColor: accent }}
    >
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
          mixedMode={mixedMode}
        />
      ))}
    </div>
  );
}
