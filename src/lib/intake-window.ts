import { toLocalIso, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";

/**
 * Whether a course is still a thing a member of the public can apply to.
 *
 * `courses.accepting_applications` is the centre's own switch and stays the
 * only way to CLOSE an intake early. What it cannot do is notice that the
 * course has finished: nothing turns it off at the end date, and the seed
 * deliberately leaves it true mid-course ("nobody has closed it",
 * scripts/seed-demo.mjs:372). So a centre that forgets the tick-box goes on
 * advertising a course that is over.
 *
 * Walked 23 Sep 2026 and it was not hypothetical. celtaconnect.com/apply
 * offered exactly one intake to the public -- "CELTA Walkthrough (Ramy)",
 * which ended on 18 Sept -- under the label "places available". It was the
 * only course at the only real centre with the flag on.
 *
 * The line is the END date, not the start. A centre may legitimately take a
 * late applicant after a course has begun, and which day that stops being
 * true is the centre's policy, not ours -- that is what the flag is for.
 * A course that has already finished is not a policy question.
 *
 * The date is read in the CENTRE's zone: these are date-only columns, and a
 * zone turns the 18th into the 17th (see the date-only-columns rule).
 */
export function intakeHasFinished(
  endDate: string,
  timeZone: string | null | undefined,
): boolean {
  return endDate < centreToday(timeZone);
}

/** Today's calendar date at the centre, as a date-only string. */
export function centreToday(timeZone: string | null | undefined): string {
  return toLocalIso(new Date(), timeZone ?? DEFAULT_TIMEZONE);
}
