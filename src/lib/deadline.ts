// Live urgency banding for a due date, so the trainee dashboard can tighten
// visually (muted -> amber -> red) as a deadline approaches instead of
// showing the date as flat, static text no matter how close it is.

export type DeadlineUrgency = "normal" | "soon" | "overdue";

const SOON_THRESHOLD_DAYS = 3;

// Ramy, 28 Aug 2026: "the logic behind everything" -- due_date is a
// date-only column; comparing new Date(dueDate) (UTC midnight) against
// Date.now() (the real instant) meant a centre away from UTC could see
// "overdue" styling hours before, or after, its own real local due date.
// `today` is the caller's own centre-local date string (toLocalIso), so
// both sides of the subtraction are date-only and the day-count is exact.
export function getDeadlineUrgency(
  dueDate: string | null,
  submittedAt: string | null,
  today: string
): DeadlineUrgency {
  if (!dueDate || submittedAt) return "normal";

  const msPerDay = 24 * 60 * 60 * 1000;
  const daysRemaining = Math.round((new Date(`${dueDate}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / msPerDay);

  if (daysRemaining < 0) return "overdue";
  if (daysRemaining <= SOON_THRESHOLD_DAYS) return "soon";
  return "normal";
}

export const DEADLINE_URGENCY_CLASS: Record<DeadlineUrgency, string> = {
  normal: "text-muted",
  soon: "text-status-pending-text font-medium",
  overdue: "text-destructive font-medium",
};
