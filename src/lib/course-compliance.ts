import "server-only";
import { doubleMarkingPerAssignment } from "@/lib/assessor-requirements";
import { computeEntryFormDeadline } from "@/lib/entry-form-deadline";
import { TP_LESSON_LENGTH_MINUTES } from "@/lib/tp-plan-content";
import type { Database } from "@/lib/supabase/types";

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
      message: `${short.length} assignment${short.length === 1 ? "" : "s"} short of the double-marking quota with ${daysLeft <= 0 ? "no" : daysLeft} day${daysLeft === 1 ? "" : "s"} left`,
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
      detail: `Due ${new Date(`${deadline}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · ${daysLate} day${daysLate === 1 ? "" : "s"} late`,
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
