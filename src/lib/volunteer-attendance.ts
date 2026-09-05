// for-claude-code-trainer-remaining-screens.md's volunteer tick rule: "90
// minutes earns a tick, and the tick credits the whole session (e.g. 2¼
// hours) regardless of the exact time logged." migration 0200 (zoom-auto-
// attendance.md) added a real Zoom join/leave webhook, but it only fills in
// the same present/absent row this always read -- volunteer_attendance's
// new joined_at/left_at are informational display fields, not a new input
// to this calculation. Minute-level credit was deliberately not built: each
// TP timetable event is still just a fixed-length block a volunteer is
// marked present/absent for; grouping a day's blocks into one "session" and
// multiplying attended-block-count by the fixed block length reproduces the
// same threshold/whole-session-credit behaviour without needing exact
// per-minute attendance data.
export const TICK_THRESHOLD_MINUTES = 90;

// design_handoff_volunteer_students_v2 generalises the present rule to the
// day's own lesson count: present means the round(2N/3) of a session's N
// lessons -- 2 of 3 (identical to the 90-minute rule the constant above
// encodes), and 1 of 2 on a two-lesson day, which the flat 90 minutes got
// wrong (1 x 45 min read as "one lesson" and banked nothing).
export function blocksNeededForPresent(totalBlocks: number): number {
  return Math.max(1, Math.round((totalBlocks * 2) / 3));
}

// build-spec.md's volunteer hours model, third tier: "45 to 89 minutes -> one
// lesson. Recorded on the register as a distinct mark, but credits no hours
// toward the certificate. It exists because a tutor seeing someone who
// repeatedly arrives for one lesson has a different problem from someone who
// never comes, and the register should show the difference." Under this is
// "absent"; TICK_THRESHOLD_MINUTES and above is "present" (unchanged, still
// the only tier that credits hours -- "nothing part-credits").
export const PARTIAL_THRESHOLD_MINUTES = 45;

export interface AttendanceEventLite {
  id: string;
  event_date: string;
}

export type AttendanceTier = "absent" | "partial" | "present";

export interface SessionTick {
  date: string;
  attendedBlocks: number;
  totalBlocks: number;
  minutesAttended: number;
  ticked: boolean;
  tier: AttendanceTier;
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
      const ticked = attendedBlocks >= blocksNeededForPresent(totalBlocks);
      const tier: AttendanceTier = ticked ? "present" : minutesAttended >= PARTIAL_THRESHOLD_MINUTES ? "partial" : "absent";
      return {
        date,
        attendedBlocks,
        totalBlocks,
        minutesAttended,
        ticked,
        tier,
        creditedMinutes: ticked ? totalBlocks * lessonLengthMinutes : 0,
      };
    });
}

export function creditedHours(sessionTicks: SessionTick[]): number {
  return sessionTicks.reduce((sum, s) => sum + s.creditedMinutes, 0) / 60;
}

// migration 0146 -- was a plain constant with no centre setting behind it;
// now centers.volunteer_certificate_hours_threshold is the real source and
// this is only the fallback for a row that predates the column somehow.
export const CERTIFICATE_HOURS_THRESHOLD = 160;

// Ramy, 25 Aug 2026: the reminder emails naming "TP4" meant nothing to a
// volunteer -- internal trainer jargon, and a course with three TPs a day
// makes it worse (TP10, TP11, TP12 could all be the same day). "Day 4"
// instead -- "since everything comes from the timetable, this will also
// come from the timetable" -- one course-day's worth of TP events all
// collapse to the same day number, counted from the course's own real
// timetable rather than any fixed assumption about how many TPs run per
// day.
export function teachingDayNumber(courseTpDates: string[], targetDate: string): number {
  const sorted = [...new Set(courseTpDates)].sort();
  return sorted.indexOf(targetDate) + 1;
}
