import { halfOwningDate, type TpTimetableEvent } from "@/lib/rotation";
import type { TimetableEvent } from "@/lib/timetable-grid";

// What moves when you move a session -- polish pass §4's "Moving this moves"
// strip, computed from the real graph.
//
// "Real graph" is doing load-bearing work in that sentence. The handoff lists
// four categories of dependent (criteria scope, resource-hub session cards,
// close-out gates and so on), and most of them describe a cascade this
// codebase does not have: moveTimetableEvent re-syncs assignment due dates and
// nothing else. A chip promising that something will move, beside a tool that
// will not move it, is worse than no chip -- so this reports only the edges
// that genuinely exist, and the strip says so when there are none.
//
// The two that do exist:
//   - assignment_due carrying a linked_assignment_type drives every
//     candidate's due date for that assignment (assignment-due-dates.ts, and
//     moveTimetableEvent calls syncAssignmentDueDates on exactly this type).
//   - a broadcast anchored to an event fires at that event's date plus its
//     offset (announcements-cron.ts only looks at anchored rows), so moving
//     the event moves the announcement.

/**
 * Which TP group a deadline's title addresses. A copy of the same four-line
 * rule assignment-due-dates.ts applies server-side -- that module is
 * `server-only` and this one has to run in the drag board while you drag.
 * If the group naming ever changes, both move together.
 */
function halfFromTitle(title: string): 1 | 2 | null {
  if (/\bABC\b/i.test(title) || /\bDay A\b/i.test(title)) return 1;
  if (/\bDEF\b/i.test(title) || /\bDay B\b/i.test(title)) return 2;
  return null;
}

export interface AnchoredAnnouncement {
  eventId: string;
  title: string;
  offsetDays: number;
}

export interface Dependent {
  id: string;
  label: string;
  /** Where it lands, once the move is applied. */
  detail: string;
  /** Set when this drop would break a rule -- the chip goes garnet and the drop is refused. */
  breaks?: string;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function pretty(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/**
 * The rule a deadline has to keep: "A group's submission or resubmission date
 * must always fall on a day that group is not teaching TP" (the assignment
 * schedule rule). Returns the reason it breaks, or null.
 *
 * A WARNING, not a veto, and deliberately so. Which group a deadline belongs
 * to is read from its title, and on the demo course those titles still say
 * "ABC"/"DEF" while the subgroups were renamed to "Day A"/"Day B" on 11 Sep
 * 2026 -- so the check can be reading a label that no longer names anything.
 * Blocking a drop on a reading that stale would take the timetable away from
 * the MCT over a guess; saying "this looks wrong" costs nothing if it is.
 */
export function ruleBreak(event: TimetableEvent, dropDate: string, events: TimetableEvent[]): string | null {
  if (event.type !== "assignment_due" && event.type !== "resubmission_due") return null;
  const half = halfFromTitle(event.title ?? "");
  if (!half) return null;
  const tpEvents: TpTimetableEvent[] = events
    .filter((e) => e.type === "tp")
    .map((e) => ({ event_date: e.event_date }));
  const owner = halfOwningDate(tpEvents, dropDate);
  if (owner === half) return "that group is teaching that day";
  return null;
}

/**
 * Everything that moves with `event` if it lands on `dropDate` -- or on its own
 * date, when nothing is being dragged yet.
 */
export function dependentsOf(
  event: TimetableEvent,
  dropDate: string,
  events: TimetableEvent[],
  announcements: AnchoredAnnouncement[],
  candidateCount: number
): Dependent[] {
  const out: Dependent[] = [];

  if (event.type === "assignment_due" || event.type === "resubmission_due") {
    // The rule is only ever asked about a MOVE. At rest the answer would be
    // "would land on its own date", which is either noise or, worse, a
    // standing accusation against a deadline nobody is touching -- and the
    // demo course has two of those (see the note on ruleBreak).
    const moving = dropDate !== event.event_date;
    const broken = moving ? ruleBreak(event, dropDate, events) : null;
    out.push({
      id: "due-dates",
      label: event.linked_assignment_type ?? "Assignment deadline",
      detail: broken
        ? `Would land ${pretty(dropDate)} — ${broken}`
        : `${candidateCount} candidate${candidateCount === 1 ? "" : "s"}' due date → ${pretty(dropDate)}`,
      breaks: broken ?? undefined,
    });
  }

  for (const a of announcements.filter((a) => a.eventId === event.id)) {
    const fires = addDays(dropDate, a.offsetDays);
    out.push({
      id: `announcement-${a.title}-${a.offsetDays}`,
      label: a.title,
      detail: `Sends ${pretty(fires)}${a.offsetDays === 0 ? "" : ` (${a.offsetDays > 0 ? "+" : ""}${a.offsetDays}d)`}`,
    });
  }

  return out;
}
