import "server-only";
import type { CandidateCardData } from "@/lib/assessor-pack";
import type { TeachingSlot } from "@/lib/assessor-wall";

// What Connect suggests the assessor does with this cohort, and why.
//
// Ramy, 6 Sep 2026, set the order of priority: "in danger of failing first,
// must. Then [concerns raised during the course]. Then the grades." Only the
// first of those three is a Cambridge rule -- the rest is the custom an
// experienced MCT works to -- so each line carries its own provenance and the
// screen says which is which. A recommendation that dresses custom up as
// regulation is worse than no recommendation.
//
// Two Handbook facts shape the whole thing:
//
//   Reading is the constrained decision. Administration Handbook 14.2: for a
//   regular assessment, two portfolios are reviewed in full, and where there
//   are more than two Fail candidates the assessor focuses on the borderline
//   cases. 15.1 repeats it. Two-yearly assessments read a minimum of four AND
//   every portfolio provisionally graded Fail or potential Fail.
//
//   Observation is barely constrained at all. 14.2 asks for two candidates
//   and one and a half hours, and says nothing about which two -- except that
//   the portfolio of at least one observed candidate should be read, "unless
//   the number of Pass/Fail candidates does not allow this to take place."
//
// So reading is settled first and observation is chosen to fit around it,
// not the other way round. And when the borderline cases fill both reading
// slots and none of them teaches on the visit day, the overlap is what gives
// way -- that is the Handbook's own escape clause, not a compromise of ours.

export type Provenance = "handbook" | "custom";

export interface RecommendedCandidate {
  traineeId: string;
  name: string;
  groupName: string | null;
  provisionalLabel: string | null;
  /** Why this one, in a sentence. */
  why: string;
  provenance: Provenance;
  /** Set for a candidate teaching on the visit day. */
  slot: string | null;
}

export interface AssessorRecommendation {
  /** Portfolios to read in full. */
  read: RecommendedCandidate[];
  /** Worth a look beyond the required two, where the required two are all borderline. */
  alsoWorthReading: RecommendedCandidate | null;
  /** Candidates to watch teach, drawn only from the visit day's pool. */
  observe: RecommendedCandidate[];
  /** Everyone teaching that day who is not suggested. */
  alsoTeaching: RecommendedCandidate[];
  /** How many portfolios the Handbook asks for on this kind of assessment. */
  readTarget: number;
  /** Names shared by both lists -- 14.2 wants at least one. */
  overlapCount: number;
  /** True when 14.2's escape clause applies: no borderline candidate teaches that day. */
  overlapWaived: boolean;
  /** Nobody teaches on the visit day, so there is nothing to recommend observing. */
  noPool: boolean;
}

function isBorderline(c: CandidateCardData): boolean {
  return Boolean(c.provisionalLabel?.includes("Fail"));
}

// Highest grade first. Deliberately crude -- it only has to order the labels
// the provisional slots can actually hold.
const GRADE_RANK: Record<string, number> = { "Pass A": 0, "Pass B": 1, Pass: 2 };
function gradeRank(c: CandidateCardData): number {
  return GRADE_RANK[c.provisionalLabel ?? ""] ?? 3;
}

/** Ramy's order: in danger of failing, then by grade, highest first. */
function byPriority(a: CandidateCardData, b: CandidateCardData): number {
  const border = Number(isBorderline(b)) - Number(isBorderline(a));
  if (border !== 0) return border;
  const grade = gradeRank(a) - gradeRank(b);
  if (grade !== 0) return grade;
  return a.name.localeCompare(b.name);
}

function toRecommended(c: CandidateCardData, why: string, provenance: Provenance, slot: string | null): RecommendedCandidate {
  return {
    traineeId: c.traineeId,
    name: c.name,
    groupName: c.groupName,
    provisionalLabel: c.provisionalLabel,
    why,
    provenance,
    slot,
  };
}

export function buildAssessorRecommendation({
  candidates,
  teachingSlots,
  slotTimeById,
  twoYearly,
}: {
  candidates: CandidateCardData[];
  /** Who teaches on the visit day, in teaching order. */
  teachingSlots: TeachingSlot[];
  /** Trainee id -> the time their lesson starts, where the timetable has one. */
  slotTimeById: Map<string, string>;
  twoYearly: boolean;
}): AssessorRecommendation {
  // A withdrawn candidate is not read as a portfolio and not observed; the
  // Handbook handles them separately (14.2, their withdrawal letter).
  const active = candidates.filter((c) => c.courseStatus !== "withdrawn");
  const teachingIds = new Set(teachingSlots.map((s) => s.traineeId));
  const slotLabel = (id: string) => slotTimeById.get(id) ?? null;

  const ranked = [...active].sort(byPriority);
  const borderline = ranked.filter(isBorderline);

  // 14.2: two in full for a regular assessment; a two-yearly reads at least
  // four, and every borderline portfolio on top.
  const readTarget = twoYearly ? Math.max(4, borderline.length) : 2;

  // The best grade actually proposed on this course, so "the top of the range"
  // is only ever said about the candidate who is genuinely at the top of it.
  const topLabel = ranked.find((c) => !isBorderline(c) && c.provisionalLabel)?.provisionalLabel ?? null;

  const whyRead = (c: CandidateCardData): string => {
    if (isBorderline(c)) return "In danger of failing. The Handbook puts the borderline cases ahead of everything else.";
    // Nothing has been proposed yet. Saying "tutors expect a pass" here would
    // invent a judgement the grading meeting has not made.
    if (!c.provisionalLabel) {
      return "No provisional grade yet, so there is nothing to rank this one on. It is here because the course has fewer than two borderline cases.";
    }
    return c.provisionalLabel === topLabel
      ? `Tutors expect ${c.provisionalLabel} — the top of the range on this course. An assessor moderates the top as well as the bottom.`
      : `Tutors expect ${c.provisionalLabel}.`;
  };

  const read = ranked.slice(0, readTarget).map((c) => toRecommended(c, whyRead(c), isBorderline(c) ? "handbook" : "custom", slotLabel(c.traineeId)));
  const readIds = new Set(read.map((r) => r.traineeId));

  // Where the required reading is entirely borderline, the strongest
  // candidate is offered as a third rather than displacing one of them --
  // custom, and the Handbook fixes the number at two, so it is never
  // presented as required.
  const topByGrade = ranked.find((c) => !isBorderline(c) && !readIds.has(c.traineeId)) ?? null;
  const alsoWorthReading =
    read.length > 0 && read.every((r) => borderline.some((b) => b.traineeId === r.traineeId)) && topByGrade
      ? toRecommended(
          topByGrade,
          `Not required — the Handbook's two are taken by the borderline cases. But an assessor moderates the whole range, and ${topByGrade.provisionalLabel ?? "this"} is the top of it on this course.`,
          "custom",
          slotLabel(topByGrade.traineeId)
        )
      : null;

  // Observation. The pool is the visit day's teaching list and nothing else.
  const pool = ranked.filter((c) => teachingIds.has(c.traineeId));
  const noPool = pool.length === 0;

  // 14.2 wants at least one observed candidate's portfolio read in full, so
  // anyone already on the reading list leads. Its escape clause applies when
  // no borderline candidate teaches that day.
  const onBothFirst = [...pool].sort((a, b) => {
    const overlap = Number(readIds.has(b.traineeId)) - Number(readIds.has(a.traineeId));
    return overlap !== 0 ? overlap : byPriority(a, b);
  });

  // The §14.2 overlap sentence is said once, on the first candidate who
  // carries it -- repeating it on a second is noise, since one is all the
  // Handbook asks for.
  let overlapClaimed = false;
  const observe = onBothFirst.slice(0, 2).map((c) => {
    const alsoRead = readIds.has(c.traineeId);
    let why: string;
    if (alsoRead && !overlapClaimed) {
      overlapClaimed = true;
      why =
        "On the reading list and teaching, so this one satisfies the Handbook's requirement that at least one portfolio read in full belongs to someone observed.";
    } else if (alsoRead) {
      why = "Also on the reading list, and teaching that day.";
    } else if (isBorderline(c)) {
      why = "In danger of failing, and teaching on the day.";
    } else if (!c.provisionalLabel) {
      why = "Teaching on the day. No provisional grade proposed yet, so this is the pool rather than a judgement.";
    } else {
      why = `Tutors expect ${c.provisionalLabel} — the top of the range among those teaching. The Handbook does not say who to watch, so this is Connect's opinion rather than a rule.`;
    }
    return toRecommended(c, why, alsoRead || isBorderline(c) ? "handbook" : "custom", slotLabel(c.traineeId));
  });
  const observeIds = new Set(observe.map((o) => o.traineeId));

  const alsoTeaching = onBothFirst
    .filter((c) => !observeIds.has(c.traineeId))
    .map((c) =>
      toRecommended(
        c,
        "Teaching, and their plan is in the pack either way. Neither in danger nor the top of the range.",
        "custom",
        slotLabel(c.traineeId)
      )
    );

  const overlapCount = observe.filter((o) => readIds.has(o.traineeId)).length;

  return {
    read,
    alsoWorthReading,
    observe,
    alsoTeaching,
    readTarget,
    overlapCount,
    // Only a waiver if there was a pool at all -- an empty visit day is a
    // different problem, and the existing "nothing to observe" banner says so.
    overlapWaived: !noPool && overlapCount === 0,
    noPool,
  };
}
