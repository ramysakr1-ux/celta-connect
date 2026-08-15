// Section 5 requirement: 6 hours total, but filmed observations only ever
// count for up to 3 of those 6 -- the remaining hours must be live.
// Extracted from portfolio/[traineeId]/celta5/page.tsx (built earlier this
// session) so the Roster's unified-tracking column (specs/for-claude-code-
// unified-tracking.md item 4) can't drift from the CELTA5 record's own
// count -- both read the same real `observations` rows through this one
// function.
export const OBSERVATION_HOURS_REQUIRED = 6;
export const OBSERVATION_FILMED_CAP_MINUTES = 3 * 60;

export interface ObservationHoursSummary {
  hoursCounted: number;
  liveHours: number;
  filmedHours: number;
}

export function computeObservationHours(observations: { filmed: boolean; length_minutes: number | null }[]): ObservationHoursSummary {
  const liveMinutes = observations.filter((o) => !o.filmed).reduce((sum, o) => sum + (o.length_minutes ?? 0), 0);
  const filmedMinutes = observations.filter((o) => o.filmed).reduce((sum, o) => sum + (o.length_minutes ?? 0), 0);
  const filmedCountedMinutes = Math.min(filmedMinutes, OBSERVATION_FILMED_CAP_MINUTES);
  return {
    hoursCounted: (liveMinutes + filmedCountedMinutes) / 60,
    liveHours: liveMinutes / 60,
    filmedHours: filmedMinutes / 60,
  };
}
