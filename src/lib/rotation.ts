// Rotation position within a subgroup for a given TP round, computed from a
// trainer-editable base order rather than a stored per-TP array. Verified
// against the spec's worked example: base A,B,C (slots 0,1,2) -> TP1 A,B,C;
// TP2 C,A,B; TP3 B,C,A.
export function rotationPosition(baseSlot: number, subgroupSize: number, tpNumber: number): number {
  return (baseSlot + (tpNumber - 1)) % subgroupSize;
}

// checkpoint 3 (Rotation.dc.html) -- a TP group's two halves alternate which
// real calendar TP day they teach on. Deliberately derived from the actual
// timetable (course_timetable_events where type='tp'), not a stored
// day-of-week setting -- confirmed with Ramy this stays in sync
// automatically with whatever's really scheduled, and handles a course's
// day pattern varying without needing a separate per-course setting.
//
// half_order 1 gets the 1st, 3rd, 5th... distinct TP date; half_order 2
// gets the 2nd, 4th, 6th.... The 1-based index within a half's own list IS
// the tpNumber to feed into rotationPosition() / that matches
// plan_assignments.tp_number for that half's members -- this is the bridge
// between "a real calendar date" and "this half's internal round count".
// Only indices 0-5 (tpNumber 1-6) are inside the rotation/plan_assignments
// system; a half's 7th+ date is TP7/8 self-select territory and must never
// be fed into rotationPosition or assign_tp_round.

export interface TpTimetableEvent {
  event_date: string; // YYYY-MM-DD, matches course_timetable_events.event_date
}

/** Sorted, deduplicated TP-day dates across the whole course. */
export function distinctTpDates(tpEvents: TpTimetableEvent[]): string[] {
  return [...new Set(tpEvents.map((e) => e.event_date))].sort();
}

/** This half's own ordered TP dates -- every other distinct date, starting from its half_order. */
export function halfTpDates(tpEvents: TpTimetableEvent[], halfOrder: 1 | 2): string[] {
  return distinctTpDates(tpEvents).filter((_, i) => i % 2 === halfOrder - 1);
}

/** Which half (1 | 2) owns a given date, or null if it isn't a distinct TP date at all. */
export function halfOwningDate(tpEvents: TpTimetableEvent[], date: string): 1 | 2 | null {
  const dates = distinctTpDates(tpEvents);
  const index = dates.indexOf(date);
  if (index === -1) return null;
  return index % 2 === 0 ? 1 : 2;
}

/** First date in this half's list that is today or later, or null if none scheduled yet. */
export function nextTpDateForHalf(tpEvents: TpTimetableEvent[], halfOrder: 1 | 2, today: string): string | null {
  return halfTpDates(tpEvents, halfOrder).find((d) => d >= today) ?? null;
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / msPerDay);
}

export interface IntensiveTpBreakCheck {
  longestConsecutiveRun: number;
  exceedsMaxConsecutive: boolean;
  hasTwoDayBreak: boolean;
}

// Handbook 8.1.4: "two-day minimum break midway, no more than six
// consecutive TP days." Advisory only, same pattern as the tutor
// double-booking warning -- computed straight from the real timetable
// (course_timetable_events, type='tp'), never a stored setting. The
// spec's third clause ("the block should not end on the final day") isn't
// checked here: "final day" is ambiguous between the TP block's own end
// and the whole course's, and this is advisory, not worth guessing at.
export function checkIntensiveTpBreaks(tpDates: string[]): IntensiveTpBreakCheck {
  const MAX_CONSECUTIVE = 6;
  const MIN_BREAK_DAYS = 2;

  let longestRun = tpDates.length > 0 ? 1 : 0;
  let currentRun = tpDates.length > 0 ? 1 : 0;
  let hasTwoDayBreak = false;

  for (let i = 1; i < tpDates.length; i++) {
    const gap = daysBetween(tpDates[i - 1], tpDates[i]);
    if (gap === 1) {
      currentRun += 1;
      longestRun = Math.max(longestRun, currentRun);
    } else {
      currentRun = 1;
    }
    if (gap - 1 >= MIN_BREAK_DAYS) hasTwoDayBreak = true;
  }

  return {
    longestConsecutiveRun: longestRun,
    exceedsMaxConsecutive: longestRun > MAX_CONSECUTIVE,
    hasTwoDayBreak,
  };
}
