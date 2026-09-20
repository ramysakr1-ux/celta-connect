import "server-only";
import { doubleMarkingPerAssignment } from "@/lib/assessor-requirements";
import { computeEntryFormDeadline } from "@/lib/entry-form-deadline";
import { TP_LESSON_LENGTH_MINUTES } from "@/lib/tp-plan-content";
import type { Database } from "@/lib/supabase/types";

// "A, B and C", never "A and B and C" (MCT landing, 20 Sep 2026).
function listWords(xs: string[]): string {
  return xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}
import { formatCalendarDate } from "@/lib/format-date";

// What the course cannot satisfy as planned.
//
// Ramy, 4 Sep 2026, settling the rule for Today's banner: "the banner is for
// what the course can't satisfy as planned -- not what you haven't done yet."
// A task belongs in the queue. A contradiction belongs up top. The test is
// whether working through your list would fix it; if it would not, it is one
// of these. Which also means the banner is usually absent, and that is the
// point: if it shows, something is genuinely wrong with the plan.
//
// Everything here is derived from data the course already holds. Nothing is
// stored, nothing is dismissed -- a problem clears itself the moment the
// plan stops contradicting Cambridge.

export interface ComplianceProblem {
  /** Short uppercase tag on the banner chip. */
  tag: string;
  message: string;
  /** The arithmetic or rule, right-aligned. */
  detail: string;
  href: string;
  /** Handbook section, for the reader who wants to check. */
  cite: string;
}

type DeliveryMode = Database["public"]["Tables"]["courses"]["Row"]["delivery_mode"];

/**
 * A candidate who cannot reach six assessed hours on the current timetable.
 *
 * Handbook §9.1.1: six hours of assessed teaching practice per candidate.
 * hoursSoFar comes from the roster (taught TPs x lesson length); the slots
 * left are the distinct TP numbers still ahead on the timetable. If even
 * teaching every one of them leaves the candidate short, no amount of
 * working the queue fixes it -- the timetable has to change.
 */
export function sixHoursProblems(input: {
  candidates: { id: string; name: string; assessedHrs: number; tpStagesTaught: number }[];
  futureTpNumbers: number[];
}): ComplianceProblem[] {
  const REQUIRED_HOURS = 6;
  const slotHours = TP_LESSON_LENGTH_MINUTES / 60;
  const out: ComplianceProblem[] = [];
  for (const c of input.candidates) {
    const slotsLeft = input.futureTpNumbers.filter((n) => n > c.tpStagesTaught).length;
    const reachable = c.assessedHrs + slotsLeft * slotHours;
    if (reachable + 1e-9 < REQUIRED_HOURS) {
      const h = Math.floor(c.assessedHrs);
      const m = Math.round((c.assessedHrs - h) * 60);
      out.push({
        tag: "Cannot reach 6 hrs",
        message: `${c.name} cannot reach six assessed hours on the current timetable`,
        detail: `${h}h ${String(m).padStart(2, "0")}m so far · ${slotsLeft} TP slot${slotsLeft === 1 ? "" : "s"} left`,
        href: "/trainer/timetable?mode=edit",
        cite: "9.1.1",
      });
    }
  }
  return out;
}

/**
 * Stage 2 not given by the time the halfway point has clearly passed.
 *
 * Handbook §10.2: Stage 2 is carried out on ALL candidates, with a one-to-one
 * tutorial, "ordinarily at the halfway point (i.e., after 3 hours' TP and
 * when candidates are swapping tutors/TP groups)". Four assessed lessons is
 * three hours; a candidate on their fifth with no record has passed the
 * point the plan put the tutorial at, and the plan can no longer put it
 * there. Withdrawn candidates are not counted.
 */
export function stage2Problems(input: {
  candidates: { id: string; name: string; tpStagesTaught: number; stage2Filed: boolean }[];
}): ComplianceProblem[] {
  const overdue = input.candidates.filter((c) => !c.stage2Filed && c.tpStagesTaught >= 5);
  if (overdue.length === 0) return [];
  return [
    {
      tag: "Stage 2",
      message: `${overdue.length} candidate${overdue.length === 1 ? " is" : "s are"} past the halfway point with no Stage 2 record`,
      detail: overdue.map((c) => `${c.name} · TP${c.tpStagesTaught}`).join(" · "),
      href: "/trainer/roster",
      cite: "10.2",
    },
  ];
}

/**
 * Stage 3 outstanding in the final third.
 *
 * Handbook §10.2: for every triggered candidate "a tutorial must be given and
 * the whole tutorial record completed" in the final third of the course.
 * Six of eight assessed lessons taught is the final third; a flagged
 * candidate past it with no finalized record is what this names.
 */
export function stage3Problems(input: {
  candidates: { id: string; name: string; tpStagesTaught: number; stage3Required: boolean; stage3Done: boolean }[];
}): ComplianceProblem[] {
  const overdue = input.candidates.filter((c) => c.stage3Required && !c.stage3Done && c.tpStagesTaught >= 6);
  if (overdue.length === 0) return [];
  return [
    {
      tag: "Stage 3",
      message: `${overdue.length} candidate${overdue.length === 1 ? "" : "s"} in the final third with a Stage 3 tutorial owed and no record`,
      detail: overdue.map((c) => `${c.name} · TP${c.tpStagesTaught}`).join(" · "),
      href: "/trainer/roster",
      cite: "10.2",
    },
  ];
}

/**
 * A potential Fail with no fail letter and the window closing.
 *
 * Handbook §10.2: "Potential Fail candidates should also be issued with a
 * Fail letter... sufficiently in advance of the end of the course, ideally
 * with at least two lessons left to teach." Two lessons left is the last
 * moment the ideal can still be met; one left is past it.
 */
export function failLetterProblems(input: {
  candidates: { id: string; name: string; potentialFail: boolean; failLetterIssued: boolean; lessonsLeft: number }[];
}): ComplianceProblem[] {
  const due = input.candidates.filter((c) => c.potentialFail && !c.failLetterIssued && c.lessonsLeft <= 2);
  if (due.length === 0) return [];
  return [
    {
      tag: "Fail letter",
      message: `${due.length} potential Fail candidate${due.length === 1 ? " has" : "s have"} no fail letter with two or fewer lessons left`,
      detail: due.map((c) => `${c.name} · ${c.lessonsLeft} left`).join(" · "),
      href: "/trainer/roster",
      cite: "10.2",
    },
  ];
}

/**
 * Double-marking quota unmet, once the course is in its final week.
 *
 * Handbook §9.2.3: three of each assignment for up to nine candidates, four
 * for 10-16, five for 17-24, and the sample must include any fails. Only
 * raised in the last seven days -- earlier there is still time, and this is
 * the banner for things time no longer fixes.
 */
export function doubleMarkingProblems(input: {
  candidateCount: number;
  today: string;
  endDate: string | null;
  /** Per assignment type: how many have a second marker recorded. */
  doubleMarkedByType: Map<string, number>;
  assignmentTypes: string[];
}): ComplianceProblem[] {
  if (!input.endDate) return [];
  const daysLeft = Math.ceil((Date.parse(`${input.endDate}T00:00:00Z`) - Date.parse(`${input.today}T00:00:00Z`)) / 86400000);
  if (daysLeft > 7) return [];
  const quota = doubleMarkingPerAssignment(input.candidateCount);
  if (quota === null) return [];
  const short = input.assignmentTypes
    .map((t) => ({ t, done: input.doubleMarkedByType.get(t) ?? 0 }))
    .filter((x) => x.done < quota);
  if (short.length === 0) return [];
  return [
    {
      tag: "Double-marking",
      // `short` is a list of assignment TYPES, so "2 assignments short" read
      // as two scripts when it meant two of the four assignments were under
      // quota -- with LfC 0/4 and Skills 0/4 beside it, eight short (tutor
      // walk, 20 Sep 2026). Name them instead.
      message: `${listWords(short.map((x) => x.t))} below the double-marking quota with ${daysLeft <= 0 ? "no" : daysLeft} day${daysLeft === 1 ? "" : "s"} left`,
      detail: short.map((x) => `${x.t} ${x.done}/${quota}`).join(" · "),
      href: "/trainer/roster",
      cite: "9.2.3",
    },
  ];
}

/**
 * Entry form deadline passed with the form unsent.
 *
 * Handbook §4.1: 28 days before an online course, 14 before any other.
 */
export function entryFormProblems(input: {
  today: string;
  startDate: string | null;
  deliveryMode: DeliveryMode | null;
  entryFormSentAt: string | null;
}): ComplianceProblem[] {
  if (!input.startDate || input.entryFormSentAt) return [];
  const deadline = computeEntryFormDeadline(input.startDate, input.deliveryMode ?? "f2f");
  if (input.today <= deadline) return [];
  const daysLate = Math.ceil((Date.parse(`${input.today}T00:00:00Z`) - Date.parse(`${deadline}T00:00:00Z`)) / 86400000);
  return [
    {
      tag: "Entry form",
      message: "The entry form has not been sent to Cambridge and its deadline has passed",
      detail: `Due ${formatCalendarDate(deadline, { day: "numeric", month: "short" })} · ${daysLate} day${daysLate === 1 ? "" : "s"} late`,
      href: "/dashboard/admin",
      cite: "4.1",
    },
  ];
}

/**
 * A TP group outside four to six candidates.
 *
 * Handbook §9.1.1: teaching practice groups of four to six. A group here is
 * course_tp_groups with both halves counted -- the six candidates who share
 * one class on alternate days. Judged on active candidates only; a
 * withdrawn one has already left the group.
 */
export function tpGroupSizeProblems(input: { groups: { id: string; name: string; size: number }[] }): ComplianceProblem[] {
  return input.groups
    .filter((g) => g.size > 0 && (g.size < 4 || g.size > 6))
    .map((g) => ({
      tag: "TP group size",
      message: `${g.name} has ${g.size} candidate${g.size === 1 ? "" : "s"} -- a TP group is four to six`,
      detail: g.size < 4 ? `${4 - g.size} short` : `${g.size - 6} over`,
      href: "/trainer/rotation",
      cite: "9.1.1",
    }));
}

/**
 * A cohort outside the size Cambridge allows a course to run at.
 *
 * Handbook §7.1: "The minimum number of candidates to run a course is
 * four... The maximum number of candidates on a course is 24 with 4
 * teaching practice groups." And, for the low end, an explicit instruction
 * the centre has to act on rather than merely notice: "If a centre has
 * either a course or a TP group with fewer than four candidates, they must
 * notify CELTA Admin and consult their JCA for guidance to ensure that
 * course requirements are met."
 *
 * TP GROUP size is already checked (four to six, tpGroupSizeProblems); the
 * COURSE total was not, so a course of three or of twenty-six passed every
 * check in this file. Counted on active candidates: a withdrawal can take a
 * cohort under four mid-course, which is exactly when the centre needs to
 * be told, and the detail says what §7.1 asks them to do about it.
 */
export function cohortSizeProblems(input: { activeCandidates: number }): ComplianceProblem[] {
  const MIN = 4;
  const MAX = 24;
  const n = input.activeCandidates;
  if (n === 0 || (n >= MIN && n <= MAX)) return [];
  return [
    {
      tag: "Cohort size",
      message:
        n < MIN
          ? `${n} active candidate${n === 1 ? "" : "s"} -- a course runs on a minimum of four`
          : `${n} active candidates -- the maximum on a course is ${MAX}`,
      detail:
        n < MIN
          ? "Notify CELTA Admin and consult your Joint Chief Assessor for guidance (Handbook 7.1)"
          : `${n - MAX} over, across a maximum of four teaching practice groups`,
      href: "/trainer/roster",
      cite: "7.1",
    },
  ];
}

/**
 * A teaching practice class too small to be assessed.
 *
 * Handbook §9.1.3: "a minimum of 50% of teaching practice must be with
 * classes of an average of eight students. Classes of fewer than five
 * students are not normally valid for assessment purposes."
 *
 * Only the second sentence is checked here. It is unambiguous, it is about
 * a class as it stands rather than a proportion across the course, and it
 * is the one an assessor raises -- "assessors check records of student
 * attendance and the level of the classes taught" (same section). The
 * average-of-eight half is stated in the detail rather than computed,
 * because "50% of teaching practice" needs a judgement about what is being
 * halved that the Handbook does not make for us.
 *
 * A class is one level: two levels run in parallel and a volunteer belongs
 * to one of them, so five volunteers on the course split three and two is
 * two classes that are both too small, not one that is fine.
 *
 * Counted from the roster, not from attendance -- this is about whether the
 * class exists at a valid size, which a centre can still act on by
 * recruiting. Who turned up on a given day is the register's business.
 */
export function tpClassSizeProblems(input: {
  classes: { level: string; volunteers: number }[];
}): ComplianceProblem[] {
  const MINIMUM = 5;
  const tooSmall = input.classes.filter((c) => c.volunteers > 0 && c.volunteers < MINIMUM);
  if (tooSmall.length === 0) return [];
  return [
    {
      tag: "TP class size",
      message:
        tooSmall.length === 1
          ? `The ${tooSmall[0].level} class has ${tooSmall[0].volunteers} student${tooSmall[0].volunteers === 1 ? "" : "s"} -- fewer than five is not normally valid for assessment`
          : `${tooSmall.length} TP classes have fewer than five students -- not normally valid for assessment`,
      detail: `${tooSmall
        .map((c) => `${c.level}: ${c.volunteers}`)
        .join(" · ")} · half of all TP should be with classes averaging eight`,
      href: "/trainer/volunteers",
      cite: "9.1.3",
    },
  ];
}

/**
 * The coursebook schedule cannot give candidates two significantly different
 * levels with one below intermediate.
 *
 * Handbook §9.1.2. Below intermediate = an A-level coursebook (A1, A2, A2+);
 * significantly different = an A-level and a B-or-above level, not two
 * shades of the same band. Only judged once every rotation-assigned TP (1-6)
 * has a coursebook -- until then the schedule is unfinished, not wrong.
 */
export function tpLevelProblems(input: { schedule: { tpNumber: number; level: string | null }[]; requiredTps?: number[] }): ComplianceProblem[] {
  const required = input.requiredTps ?? [1, 2, 3, 4, 5, 6];
  const byTp = new Map(input.schedule.map((s) => [s.tpNumber, s.level]));
  if (!required.every((n) => byTp.get(n))) return [];
  const levels = required.map((n) => (byTp.get(n) as string).trim().toUpperCase());
  const below = levels.filter((l) => l.startsWith("A"));
  const atOrAbove = levels.filter((l) => !l.startsWith("A"));
  if (below.length > 0 && atOrAbove.length > 0) return [];
  const distinct = [...new Set(levels)].join(", ");
  return [
    {
      tag: "TP levels",
      message:
        below.length === 0
          ? "No TP is scheduled below intermediate level"
          : "Every TP is scheduled below intermediate -- candidates need two significantly different levels",
      detail: `TP1-6: ${distinct}`,
      href: "/trainer/rotation",
      cite: "9.1.2",
    },
  ];
}

/**
 * A locked timetable under 120 contact hours.
 *
 * Handbook §3.1. Judged only once the timetable is locked -- before that it
 * is a draft. Hours come from the timetable's own bands: each input or
 * supervised session is its band's length, each TP session is the three
 * lessons plus feedback the rest of the app already treats it as.
 */
/**
 * The course's contact hours, counted as ONE CANDIDATE experiences them.
 *
 * The syllabus (p3) says what the 120 hours are made of: input, supervised
 * lesson planning, teaching practice, feedback on teaching, peer observation,
 * observation of experienced teachers, consultation time -- and separately
 * "a minimum of 80 hours" of the candidate's OWN reading, assignments and
 * lesson preparation, which is not contact time.
 *
 * Two things this used to get wrong, both from counting timetable ROWS
 * instead of a candidate's hours (walked 14 Sep 2026, when the walkthrough
 * course read 348.8 hours against a 120-hour minimum -- an overcount big
 * enough to silence the check completely):
 *
 *   - Every TP row counted a full three-hour block. Six lettered rows a day
 *     across two parallel groups is one three-hour block for the candidate
 *     who sits in it, not eighteen hours.
 *   - Two groups running the same session at the same hour counted twice.
 *     A candidate attends it once.
 *
 * And two it never counted at all: consultation time and observation of
 * experienced teachers, both named in the syllabus, both carried on
 * `milestone` rows here.
 */
export function contactMinutesFromTimetable(
  events: { type: string; title: string; detail: string | null; event_date: string; event_time: string | null; tag: string | null }[],
  bandMinutes: (time: string | null) => number
): number {
  const tpDates = new Set(events.filter((e) => e.type === "tp").map((e) => e.event_date));
  let minutes = tpDates.size * 180;
  const counted = new Set<string>();
  for (const e of events) {
    if (e.type === "tp" || e.tag === "lunch") continue;
    // A deadline is not a session.
    if (e.type === "assignment_due" || e.type === "resubmission_due") continue;
    // "Own time" is the syllabus's other 80 hours, not contact time.
    if (/own time/i.test(e.detail ?? "") || /own time/i.test(e.title)) continue;
    const key = `${e.event_date}|${e.event_time}|${e.title}`;
    if (counted.has(key)) continue;
    counted.add(key);
    minutes += bandMinutes(e.event_time);
  }
  return minutes;
}

export function contactHoursProblems(input: { locked: boolean; contactHours: number }): ComplianceProblem[] {
  if (!input.locked) return [];
  if (input.contactHours + 1e-9 >= 120) return [];
  const short = 120 - input.contactHours;
  return [
    {
      tag: "Contact hours",
      message: `The locked timetable gives ${input.contactHours.toFixed(1).replace(/\.0$/, "")} contact hours, under the 120 minimum`,
      detail: `${short.toFixed(1).replace(/\.0$/, "")} h short`,
      href: "/trainer/timetable?mode=edit",
      cite: "3.1",
    },
  ];
}

/**
 * A candidate given more than one one-to-one/small-group lesson.
 *
 * Handbook §9.1.2 / §26: five of the six assessed hours must be whole-class
 * teaching. At most one assessed lesson may be to a single or paired student.
 * The "not one of the two final lessons" half of that rule is already a
 * database constraint (migration 0182: class_grouping cannot be
 * one_to_one_or_small_group at TP7 or TP8), so the only part left to catch is
 * a candidate with two or more one-to-one lessons -- which the plan allows and
 * the Handbook does not.
 */
export function wholeClassProblems(input: {
  candidates: { id: string; name: string; oneToOneCount: number }[];
}): ComplianceProblem[] {
  return input.candidates
    .filter((c) => c.oneToOneCount > 1)
    .map((c) => ({
      tag: "Whole-class TP",
      message: `${c.name} has ${c.oneToOneCount} one-to-one lessons planned -- only one of the six assessed hours may be`,
      detail: `${c.oneToOneCount} one-to-one · max 1`,
      href: "/trainer/rotation",
      cite: "9.1.2",
    }));
}

/**
 * A mixed-mode course whose teaching practice is not actually split across
 * the two modes.
 *
 * Handbook §3.5 / §9.1.2: on a mixed-mode course candidates must teach in both
 * modes -- one level face-to-face and the other online -- with a minimum of
 * two hours in each mode. Face-to-face-only and online-only courses have a
 * single mode by definition and are never flagged here; this fires only when
 * the course is declared mixed but the TP timetable does not carry both modes
 * (or leaves a TP lesson's mode unset, which the split can't be checked
 * without).
 */
export function mixedModeProblems(input: {
  deliveryMode: DeliveryMode;
  tpModes: (string | null)[];
}): ComplianceProblem[] {
  if (input.deliveryMode !== "mixed") return [];
  if (input.tpModes.length === 0) return [];
  const missing = input.tpModes.filter((m) => !m).length;
  if (missing > 0) {
    return [
      {
        tag: "Mixed-mode TP",
        message: `${missing} TP lesson${missing === 1 ? " has" : "s have"} no mode set -- a mixed-mode course needs each TP marked face-to-face or online`,
        detail: `${missing} unset`,
        href: "/trainer/timetable?mode=edit",
        cite: "9.1.2",
      },
    ];
  }
  const modes = new Set(input.tpModes);
  if (modes.size < 2) {
    const only = modes.has("online") ? "online" : "face-to-face";
    return [
      {
        tag: "Mixed-mode TP",
        message: `This course is mixed-mode but all teaching practice is ${only} -- candidates must teach in both modes`,
        detail: `${only} only`,
        href: "/trainer/timetable?mode=edit",
        cite: "9.1.2",
      },
    ];
  }
  return [];
}
