// When the pre-course task's answer key opens to the cohort.
//
// Ramy, 28 Aug 2026: "the Friday date rule is more like two days before the
// beginning of the course. Maybe the course will start on a Wednesday or
// something. Usually it's a Monday, but keep it 48 hours before instead."
//
// Was mostRecentFridayBefore(), which only lands two days out for a course
// that happens to start on a Monday -- a Wednesday start got its key the
// previous Friday, five days early. This is anchored to the course's own
// start date instead, so every course gets the same 48 hours regardless of
// which weekday it begins.
//
// Deliberately NOT reusing mostRecentFridayBefore: that function still
// anchors the welcome-email cron in starts-monday-cron.ts, which is a
// genuinely Friday-shaped job ("the Friday-before email") and not the same
// rule. Two separate dates that merely coincided on Monday-start courses.
//
// Date-only arithmetic, matching how every caller compares it -- against a
// centre-local ISO date from toLocalIso(), never a timestamp.
export function answerKeyOpensOn(startDateIso: string): string {
  const d = new Date(`${startDateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 2);
  return d.toISOString().slice(0, 10);
}
