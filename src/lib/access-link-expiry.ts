import { zonedTimeToUtc, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";

/**
 * When a course-scoped access link stops working: the end of the last day
 * of the course, on the centre's own clock.
 *
 * Every call site wrote `new Date(`${end_date}T23:59:59Z`)`, which is the
 * end of that day in UTC and therefore not the end of that day anywhere
 * else. At the Los Angeles branch (GMT-7) a volunteer's link died at 16:59
 * local ON the last day, before that evening's class; at Istanbul (GMT+3)
 * it outlived the course by three hours. Same class of bug as the date-only
 * columns -- a zone turns the 14th into the 13th (walked 15 Sep 2026).
 */
export function endOfCourseDay(endDate: string, timeZone: string | null | undefined): string {
  return zonedTimeToUtc(endDate, "23:59:59", timeZone || DEFAULT_TIMEZONE).toISOString();
}
