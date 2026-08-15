// for-claude-code-trainer-remaining-screens.md's volunteer tick rule: "90
// minutes earns a tick, and the tick credits the whole session (e.g. 2¼
// hours) regardless of the exact time logged." There's no Zoom join/leave
// webhook feeding this app (confirmed -- the only join/leave-shaped
// columns anywhere are course_tutors', an unrelated roster concept), so
// there's nothing to literally sum minutes from. This is the honest
// approximation available from data the app actually has: each TP
// timetable event is already a fixed-length block a volunteer is marked
// present/absent for (setAttendance, timetable/actions.ts); grouping a
// day's blocks into one "session" and multiplying attended-block-count by
// the fixed block length reproduces the same threshold/whole-session-credit
// behaviour without inventing attendance data that was never captured.
export const TICK_THRESHOLD_MINUTES = 90;

export interface AttendanceEventLite {
  id: string;
  event_date: string;
}

export interface SessionTick {
  date: string;
  attendedBlocks: number;
  totalBlocks: number;
  minutesAttended: number;
  ticked: boolean;
  creditedMinutes: number;
}

export function computeSessionTicks(
  events: AttendanceEventLite[],
  attendedEventIds: Set<string>,
  lessonLengthMinutes: number
): SessionTick[] {
  const byDate = new Map<string, AttendanceEventLite[]>();
  for (const e of events) {
    const list = byDate.get(e.event_date) ?? [];
    list.push(e);
    byDate.set(e.event_date, list);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayEvents]) => {
      const attendedBlocks = dayEvents.filter((e) => attendedEventIds.has(e.id)).length;
      const totalBlocks = dayEvents.length;
      const minutesAttended = attendedBlocks * lessonLengthMinutes;
      const ticked = minutesAttended >= TICK_THRESHOLD_MINUTES;
      return {
        date,
        attendedBlocks,
        totalBlocks,
        minutesAttended,
        ticked,
        creditedMinutes: ticked ? totalBlocks * lessonLengthMinutes : 0,
      };
    });
}

export function creditedHours(sessionTicks: SessionTick[]): number {
  return sessionTicks.reduce((sum, s) => sum + s.creditedMinutes, 0) / 60;
}

// Spec's own illustrative figure ("e.g. 160 hrs") -- there's no centre
// setting for this yet, so it's a plain constant, not a fabricated one.
export const CERTIFICATE_HOURS_THRESHOLD = 160;
