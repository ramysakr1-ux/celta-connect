import "server-only";
import { CEFR_LEVELS, extractLevelCode } from "@/lib/levels";

/**
 * A volunteer belongs to a class, and a class is a level.
 *
 * Their level is stored the old way ("Intermediate"); a TP card carries the
 * coursebook's code ("B1+"). Same fact, two spellings -- so both sides come
 * down to a bare code here, and B1+ counts as B1. Anything unrecognised
 * matches everything, which is what every caller did before this existed.
 */
export function levelKey(level: string | null | undefined): string | null {
  if (!level) return null;
  const raw = extractLevelCode(level.trim());
  const byName = CEFR_LEVELS.find((l) => l.name.toLowerCase() === raw.toLowerCase());
  return (byName?.code ?? raw).replace(/\+$/, "").toUpperCase();
}

interface ClassEvent {
  id: string;
  course_id: string;
  event_date: string;
  event_time: string | null;
  detail?: string | null;
}

/**
 * Is this TP event the start of that volunteer's class that day?
 *
 * Two groups teach two levels at the same hours, and each group's day is
 * three lettered lessons back to back. A volunteer sits through their own
 * class, once -- so exactly one event a day should speak for it. Walked
 * 15 Sep 2026: the reminder crons fired per TP row, which on a two-group
 * course is six "your class starts in 30 minutes" a day, three of them for
 * a class the volunteer is not in.
 */
export function isStartOfTheirClass(
  event: ClassEvent,
  allTpEvents: ClassEvent[],
  volunteerLevel: string | null | undefined
): boolean {
  const mine = levelKey(volunteerLevel);
  const its = levelKey(event.detail);
  if (mine && its && mine !== its) return false;
  const sameClassEarlier = allTpEvents.some(
    (e) =>
      e.course_id === event.course_id &&
      e.event_date === event.event_date &&
      e.id !== event.id &&
      (!mine || !levelKey(e.detail) || levelKey(e.detail) === mine) &&
      (e.event_time ?? "") < (event.event_time ?? "")
  );
  return !sameClassEarlier;
}
