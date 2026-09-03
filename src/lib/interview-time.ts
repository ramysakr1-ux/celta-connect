import { zonedTimeToUtc } from "@/lib/timetable-grid";

// One interview time, said in both people's zones.
//
// Ramy, 3 Sep 2026: applicants "do it from different countries, different
// time zones... when the interview appointment is sent, then there is
// reference to the time zone. The centre's own time zone and the applicant's
// time zone."
//
// A slot is stored as slot_date + slot_time with no zone attached, and it
// means WALL-CLOCK TIME AT THE CENTRE -- that is what a member of staff typed
// into the rota. So the only correct way to say it in any other zone is to
// resolve it to a real instant in the centre's zone first, then format that
// instant twice.
//
// Three call sites were doing `new Date(`${date}T${time}`).toLocaleString(
// "en-GB", {...})` with no timeZone option at all: the applicant's own booking
// page, the staff notification when a slot is booked, and the notification
// when an applicant books themselves in. That formats in whatever zone the
// server happens to run in (UTC on Vercel) and prints no zone label, so an
// applicant in Lima and an applicant in Seoul were sent the same bare "10:00"
// and left to guess. They all go through here now.

const DEFAULT_TIMEZONE = "Europe/London";

export interface InterviewSlotTime {
  slotDate: string;
  slotTime: string;
}

/** The instant an interview actually happens, from the centre's wall clock. */
export function interviewInstant(slot: InterviewSlotTime, centreTimeZone: string | null): Date {
  return zonedTimeToUtc(slot.slotDate, slot.slotTime, centreTimeZone || DEFAULT_TIMEZONE);
}

/** e.g. "Friday 5 September, 10:00 (GMT+3)" */
export function formatInterviewIn(slot: InterviewSlotTime, centreTimeZone: string | null, displayTimeZone: string): string {
  const instant = interviewInstant(slot, centreTimeZone);
  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone: displayTimeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "shortOffset",
  }).format(instant);
  // Intl gives "Friday 5 September 2026 at 10:00 GMT+3" shapes that vary by
  // runtime; normalising to one readable form rather than trusting the join.
  return formatted.replace(/,?\s+at\s+/, ", ");
}

/** Which zone name to show a reader, falling back to the centre's own. */
export function readerTimeZone(applicantTimeZone: string | null, centreTimeZone: string | null): string {
  return applicantTimeZone || centreTimeZone || DEFAULT_TIMEZONE;
}

/**
 * The line that goes in an email or on a page.
 *
 * When the applicant's zone matches the centre's -- or we never captured one,
 * which is every applicant who applied before this existed -- it says the time
 * once. Saying "10:00 (GMT+3), which is 10:00 (GMT+3) your time" would read as
 * a bug, and a made-up second zone is worse than one honest one.
 */
export function interviewWhen(input: {
  slot: InterviewSlotTime;
  centreTimeZone: string | null;
  applicantTimeZone: string | null;
  centreName?: string;
}): string {
  const centre = input.centreTimeZone || DEFAULT_TIMEZONE;
  const applicant = input.applicantTimeZone;
  const centreLine = formatInterviewIn(input.slot, centre, centre);

  if (!applicant || applicant === centre) return centreLine;

  const applicantLine = formatInterviewIn(input.slot, centre, applicant);
  const centreLabel = input.centreName ? `${input.centreName} time` : "centre time";
  return `${applicantLine} your time — ${centreLine} ${centreLabel}`;
}

/** True when a zone is one this runtime will actually accept. */
export function isSupportedTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
