// When provisional grades are due to the assessor.
//
// Ramy's Grades Report design file states the rule outright:
//
//   "Provisional grades due to the assessor — Friday 28 Nov, end of day.
//    Two days before the 30 Nov visit (the prior Friday when that lands on a
//    weekend). Each TP tutor proposes for their own group, the MCT proposes
//    for theirs, then the MCT approves all before it's sent and recorded on
//    the Assessor Visit page. Reminders start 4 days out."
//
// The app had no rule at all: provisional_grades_due_at is a date the MCT
// types, and migration 0127 says so explicitly -- "MCT-set deadline... Not
// computed from assessor_visit_date." The result is that most courses have
// none. The demo pack reads "no provisional grades deadline set", and
// Elmswood's real November course has none either.
//
// This does not take the field away from the MCT: an explicitly set date
// always wins, because a centre may have agreed something else with its
// assessor. It fills the far more common case where nobody has set one and a
// date is derivable from the visit.
//
// Grounded in the Handbook as well as the design -- 14.1: "2-3 days before
// the assessment, the centre must... complete the centre grade form in
// Appian", and assessors "will access course documentation via the link...
// once the provisional grade form has been submitted", which is why 13.1 says
// it "ideally needs to be submitted two or more days before the assessment".

/** Days before the visit the provisional grades are due. Handbook 13.1/14.1. */
const DUE_DAYS_BEFORE_VISIT = 2;

/** How early the reminders start. The design's own figure. */
export const REMINDER_DAYS_BEFORE_DUE = 4;

function isoOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Two days before the visit, pulled back to the Friday when that lands on a
 * weekend -- a deadline nobody is at work for is not a deadline.
 *
 * Returns null when there is no visit date to count back from.
 */
export function derivedProvisionalDueDate(assessorVisitDate: string | null): string | null {
  if (!assessorVisitDate) return null;
  const [y, m, d] = assessorVisitDate.split("-").map(Number);
  if (!y || !m || !d) return null;

  const due = new Date(Date.UTC(y, m - 1, d));
  due.setUTCDate(due.getUTCDate() - DUE_DAYS_BEFORE_VISIT);

  // 0 = Sunday, 6 = Saturday. Both step back to the Friday before.
  const day = due.getUTCDay();
  if (day === 6) due.setUTCDate(due.getUTCDate() - 1);
  else if (day === 0) due.setUTCDate(due.getUTCDate() - 2);

  return isoOf(due);
}

export interface ProvisionalDeadline {
  /** The date to work to, whether set by hand or derived. */
  dueDate: string | null;
  /** True when nobody set one and this is the rule's answer. */
  derived: boolean;
  /** When reminders begin. Null if there is no deadline at all. */
  remindFrom: string | null;
}

/**
 * The deadline a course is actually working to. An MCT-set date always wins;
 * otherwise the rule fills in from the visit date.
 */
export function resolveProvisionalDeadline(
  explicitDueAt: string | null,
  assessorVisitDate: string | null
): ProvisionalDeadline {
  const explicit = explicitDueAt ? explicitDueAt.slice(0, 10) : null;
  const dueDate = explicit ?? derivedProvisionalDueDate(assessorVisitDate);
  if (!dueDate) return { dueDate: null, derived: false, remindFrom: null };

  const [y, m, d] = dueDate.split("-").map(Number);
  const remind = new Date(Date.UTC(y, m - 1, d));
  remind.setUTCDate(remind.getUTCDate() - REMINDER_DAYS_BEFORE_DUE);

  return { dueDate, derived: !explicit, remindFrom: isoOf(remind) };
}
