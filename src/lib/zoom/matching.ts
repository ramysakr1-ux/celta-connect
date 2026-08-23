// zoom-auto-attendance.md §4 -- matching a Zoom participant to a
// volunteer_student. Email is the only match that ever auto-writes to
// volunteer_attendance; this name-based suggestion is advisory only, used
// to pre-fill the trainer's review dropdown for a participant that had no
// email (anonymous/phone join) or whose email didn't match anyone on file.

export interface VolunteerCandidate {
  id: string;
  name: string;
  email: string | null;
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function findExactEmailMatch(email: string | null, candidates: VolunteerCandidate[]): VolunteerCandidate | null {
  if (!email) return null;
  const target = normalize(email);
  return candidates.find((c) => c.email && normalize(c.email) === target) ?? null;
}

// Exact name match first; otherwise, a shared token of more than two
// letters (skips "de", "al", etc.) -- loose on purpose, since this only
// pre-fills a dropdown a human still has to confirm, never writes
// attendance on its own.
export function suggestVolunteerMatch(displayName: string, candidates: VolunteerCandidate[]): VolunteerCandidate | null {
  const norm = normalize(displayName);
  if (!norm) return null;
  const exact = candidates.find((c) => normalize(c.name) === norm);
  if (exact) return exact;
  const tokens = norm.split(" ").filter((t) => t.length > 2);
  return candidates.find((c) => tokens.some((t) => normalize(c.name).includes(t))) ?? null;
}
