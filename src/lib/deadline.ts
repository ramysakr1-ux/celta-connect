// Live urgency banding for a due date, so the trainee dashboard can tighten
// visually (muted -> amber -> red) as a deadline approaches instead of
// showing the date as flat, static text no matter how close it is.

export type DeadlineUrgency = "normal" | "soon" | "overdue";

const SOON_THRESHOLD_DAYS = 3;

export function getDeadlineUrgency(
  dueDate: string | null,
  submittedAt: string | null
): DeadlineUrgency {
  if (!dueDate || submittedAt) return "normal";

  const msPerDay = 24 * 60 * 60 * 1000;
  const daysRemaining = Math.ceil((new Date(dueDate).getTime() - Date.now()) / msPerDay);

  if (daysRemaining < 0) return "overdue";
  if (daysRemaining <= SOON_THRESHOLD_DAYS) return "soon";
  return "normal";
}

export const DEADLINE_URGENCY_CLASS: Record<DeadlineUrgency, string> = {
  normal: "text-muted",
  soon: "text-status-pending-text font-medium",
  overdue: "text-destructive font-medium",
};
