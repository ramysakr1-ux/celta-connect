import type { Database } from "@/lib/supabase/types";

type EventType = Database["public"]["Tables"]["course_timetable_events"]["Row"]["type"];
type AssignmentType = Database["public"]["Tables"]["assignments"]["Row"]["assignment_type"];

export interface SkeletonEventDraft {
  type: EventType;
  title: string;
  /**
   * Position in the course as a fraction of the total teaching days (0 =
   * first day, 1 = last day), not a fixed day count -- lets the same shape
   * stretch or compress to fit any course length/meeting pattern rather
   * than being locked to one specific week count.
   */
  position: number;
  time?: string;
  tag?: string;
  linkedAssignmentType?: AssignmentType;
  linkedTpNumber?: number;
}

export const DEFAULT_TEACHING_DAYS = 20; // standard full-time CELTA: 4 weeks, Mon-Fri
export const DEFAULT_MEETING_DAYS = [1, 2, 3, 4, 5]; // Mon-Fri (0 = Sun ... 6 = Sat)

// §1.1a-skel -- the standard CELTA course shape trainers duplicate and
// anchor to a real start date, rather than building a timetable from a
// blank list. Deliberately a reasonable, editable STARTING POINT (matches
// the doc's "flexible while building, trainer tweaks exceptions" framing) --
// not a claim of exact pedagogical timing, which the architecture-plan.md
// explicitly reserves to CELTA-Connect-content-architecture.md. Resubmission
// windows are intentionally left out of the generated skeleton for the same
// reason (their length is a reserved rule, not a fixed offset) -- a trainer
// adds those individually once real submissions come in.
//
// Positions are fractions of DEFAULT_TEACHING_DAYS (20) so the doc's "4-week
// / 5-week / part-time all supported" requirement is a scaling operation,
// not three separate hand-authored skeletons -- see buildSkeletonEvents.
function pos(day: number): number {
  return day / (DEFAULT_TEACHING_DAYS - 1);
}

export const STANDARD_CELTA_SKELETON: SkeletonEventDraft[] = [
  // Week 1
  { type: "milestone", title: "Course begins -- orientation", position: pos(0), time: "10:00", tag: "whole_group" },
  { type: "input_session", title: "Introduction to CELTA & Learner Needs", position: pos(0), time: "10:00", tag: "whole_group" },
  { type: "input_session", title: "Lesson Planning Fundamentals", position: pos(1), time: "10:00", tag: "whole_group" },
  { type: "milestone", title: "Demo lesson (trainer-led)", position: pos(2), time: "10:00", tag: "whole_group" },
  { type: "input_session", title: "Language Analysis", position: pos(2), time: "12:45", tag: "whole_group" },
  { type: "tp", title: "TP1", position: pos(3), time: "10:00", tag: "individual", linkedTpNumber: 1 },
  { type: "input_session", title: "Assisted Lesson Planning", position: pos(3), time: "14:30", tag: "whole_group" },
  { type: "tp", title: "TP2", position: pos(4), time: "10:00", tag: "individual", linkedTpNumber: 2 },
  { type: "milestone", title: "Stage 1 tutorials begin", position: pos(4), time: "14:30", tag: "individual" },

  // Week 2
  {
    type: "assignment_due",
    title: "Focus on the Learner -- due 9am",
    position: pos(5),
    time: "09:00",
    tag: "individual",
    linkedAssignmentType: "Focus on Learner",
  },
  { type: "tp", title: "TP3", position: pos(6), time: "10:00", tag: "individual", linkedTpNumber: 3 },
  { type: "tp", title: "TP4", position: pos(7), time: "10:00", tag: "individual", linkedTpNumber: 4 },
  { type: "milestone", title: "Video Observation 1 (VO1) due", position: pos(7), time: "17:00", tag: "individual" },
  { type: "input_session", title: "Teaching Language Skills", position: pos(8), time: "10:00", tag: "whole_group" },
  {
    type: "assignment_due",
    title: "Language Related Tasks -- due 9am",
    position: pos(9),
    time: "09:00",
    tag: "individual",
    linkedAssignmentType: "LRT",
  },

  // Week 3
  { type: "tp", title: "TP5", position: pos(10), time: "10:00", tag: "individual", linkedTpNumber: 5 },
  { type: "tp", title: "TP6", position: pos(11), time: "10:00", tag: "individual", linkedTpNumber: 6 },
  { type: "milestone", title: "Video Observation 2 (VO2) due", position: pos(11), time: "17:00", tag: "individual" },
  { type: "input_session", title: "Teaching Receptive Skills", position: pos(12), time: "10:00", tag: "whole_group" },
  {
    type: "assignment_due",
    title: "Language Skills Related Tasks -- due 9am",
    position: pos(13),
    time: "09:00",
    tag: "individual",
    linkedAssignmentType: "Skills",
  },
  { type: "milestone", title: "Stage 2 tutorials begin", position: pos(14), time: "14:30", tag: "individual" },

  // Week 4
  { type: "tp", title: "TP7", position: pos(15), time: "10:00", tag: "individual", linkedTpNumber: 7 },
  { type: "tp", title: "TP8", position: pos(16), time: "10:00", tag: "individual", linkedTpNumber: 8 },
  { type: "milestone", title: "Video Observation 3 (VO3) due", position: pos(16), time: "17:00", tag: "individual" },
  { type: "milestone", title: "Filmed observation", position: pos(17), time: "10:00", tag: "individual" },
  { type: "input_session", title: "Reflective Practice & Professional Development", position: pos(17), time: "14:30", tag: "whole_group" },
  {
    type: "assignment_due",
    title: "Lessons from the Classroom -- due 9am",
    position: pos(18),
    time: "09:00",
    tag: "individual",
    linkedAssignmentType: "LfC",
  },
  { type: "milestone", title: "Course ends -- final feedback", position: pos(19), time: "15:30", tag: "whole_group" },
];

/**
 * Adds `sessionOffset` course-meeting-days to an ISO date string, counting
 * only days whose weekday is in `meetingDays` (0 = Sun ... 6 = Sat). Covers
 * both full-time (Mon-Fri) and part-time (e.g. Tue/Thu/Sat evenings)
 * patterns with the same function. Formats the result from local date
 * components rather than `toISOString()`, which round-trips through UTC
 * and silently shifts the date by a day whenever the server's timezone is
 * ahead of UTC (e.g. Europe/Istanbul -- caught this live).
 */
export function addSessionDays(isoDate: string, sessionOffset: number, meetingDays: number[]): string {
  const date = new Date(`${isoDate}T00:00:00`);
  let remaining = sessionOffset;
  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    if (meetingDays.includes(date.getDay())) remaining -= 1;
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Scales the standard skeleton to any total teaching-day count and any set
 * of meeting weekdays -- a 5-week or part-time course is the same relative
 * shape (TP1 still lands early, VO3/Stage 2/final assignment still cluster
 * near the end) stretched over more/different session days, not a
 * different hand-authored skeleton.
 */
export function buildSkeletonEvents(
  startDate: string,
  totalTeachingDays: number = DEFAULT_TEACHING_DAYS,
  meetingDays: number[] = DEFAULT_MEETING_DAYS
) {
  const lastIndex = Math.max(totalTeachingDays - 1, 1);
  return STANDARD_CELTA_SKELETON.map((draft) => {
    const sessionOffset = Math.round(draft.position * lastIndex);
    return {
      type: draft.type,
      title: draft.title,
      event_date: addSessionDays(startDate, sessionOffset, meetingDays),
      event_time: draft.time ?? null,
      tag: draft.tag ?? null,
      linked_assignment_type: draft.linkedAssignmentType ?? null,
      linked_tp_number: draft.linkedTpNumber ?? null,
    };
  });
}
