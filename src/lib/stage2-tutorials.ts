// Stage 2 tutorial booking sheet (for-claude-code-trainer-remaining-
// screens.md §3a). "No slot count is entered; the tutor just makes the
// block long enough to fit the group" -- slot count is always derived from
// duration, never stored/edited directly.
export const STAGE2_SLOT_LENGTH_MINUTES = 15;

export function slotCountFromDuration(durationMinutes: number): number {
  return Math.max(0, Math.floor(durationMinutes / STAGE2_SLOT_LENGTH_MINUTES));
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}
