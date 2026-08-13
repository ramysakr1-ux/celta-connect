// build-spec.md "Grade query -- the reply before an appeal" /
// running-a-course.md "A candidate queries their grade". This file owns the
// pure evidence-assembly logic -- given already-fetched rows for one
// trainee, produce the frozen `GradeQueryEvidenceSnapshot` that gets stored
// verbatim in grade_query_replies.evidence_snapshot (migration 0064). Kept
// separate from the page/server action so it's testable without a live DB
// (same split as course-progress.ts/celta-criteria.ts vs roster.ts).
//
// Deliberately has NO import from "@/lib/supabase/types" -- that file
// imports GradeQueryEvidenceSnapshot FROM here for the grade_query_replies
// table row type, so a value-level import back would be a real runtime
// circular dependency. Same reason tp-plan-content.ts/tp-density.ts define
// their own primitive unions instead of importing Database types --
// followed here for the same rating/grade unions.
//
// Rules this module exists to keep honest (build-spec.md, verbatim):
// "It quotes the record rather than re-arguing the grade -- a candidate is
// entitled to see the evidence, not to a second assessment." So every field
// here is either a straight read of a stored column, or an arithmetic
// tally (counts, percentages) over stored columns -- never a trainer-style
// judgement call. The only estimate this codebase has (computeTrajectory)
// is deliberately NOT included: it is a forward-looking, trainer-only
// guess, not settled evidence of what happened.

import {
  CELTA_CRITERIA_CODES,
  CRITERIA_LABELS,
  GRADE_DESCRIPTORS,
  computeCriteriaPct,
} from "@/lib/celta-criteria";
import { TP_LESSON_LENGTH_MINUTES } from "@/lib/tp-plan-content";

export type GQStandardRating = "above_standard" | "to_standard" | "not_to_standard";
export type GQCriteriaRating = "S+" | "S" | "N" | "X";
export type GQFinalGrade = "Pass" | "Pass B" | "Pass A" | "Fail" | "Withdrawn";

const GRADE_LADDER: readonly GQFinalGrade[] = ["Fail", "Pass", "Pass B", "Pass A"];

function gradeAbove(grade: GQFinalGrade | null): GQFinalGrade | null {
  if (!grade) return null;
  const idx = GRADE_LADDER.indexOf(grade);
  if (idx === -1 || idx === GRADE_LADDER.length - 1) return null; // Withdrawn, or already Pass A
  return GRADE_LADDER[idx + 1];
}

export interface GradeQueryDescriptorSet {
  grade: GQFinalGrade;
  // Pass/Pass B/Pass A: one line per GRADE_DESCRIPTORS dimension. Fail: a
  // single descriptor, no per-dimension breakdown (matches the booklet).
  // Withdrawn: no descriptor exists at all (not a performance grade).
  dimensions: { name: string; text: string }[] | null;
  failText: string | null;
}

function descriptorsFor(grade: GQFinalGrade | null): GradeQueryDescriptorSet | null {
  if (!grade || grade === "Withdrawn") return null;
  if (grade === "Fail") return { grade, dimensions: null, failText: GRADE_DESCRIPTORS.fail };
  return {
    grade,
    dimensions: GRADE_DESCRIPTORS.dimensions.map((d) => ({ name: d.name, text: d[grade] })),
    failText: null,
  };
}

export interface GradeQueryTpOutcome {
  tpNumber: number;
  taughtAt: string | null;
  hoursAssessed: number;
  outcome: GQStandardRating | null; // null = taught but feedback not yet submitted
  outcomeSubmittedAt: string | null;
}

export interface GradeQueryCriterionNote {
  code: string;
  label: string;
}

export interface GradeQueryAssignmentOutcome {
  assignmentType: string;
  firstStatus: string;
  firstSubmittedAt: string | null;
  resubmissionStatus: string;
  resubmissionSubmittedAt: string | null;
  neededResubmission: boolean;
  finalGrade: string | null;
}

export interface GradeQueryTutorialStage {
  stage: 1 | 2 | 3;
  applicable: boolean; // stage 3 only: false when stage3_required is false
  tutorialGiven: boolean;
  hoursTaught: number | null;
  completedAt: string | null;
  tutorOverall: GQStandardRating | null;
  notes: string | null;
}

export interface GradeQueryEvidenceSnapshot {
  generatedAtCourseTotalHours: number;

  gradeAwarded: GQFinalGrade | null;
  gradeSource: "final" | "provisional" | "none";
  gradeAboveAwarded: GQFinalGrade | null;
  descriptorsForGradeAwarded: GradeQueryDescriptorSet | null;
  descriptorsForGradeAbove: GradeQueryDescriptorSet | null;
  eligibilityNotes: readonly string[];

  tpOutcomes: GradeQueryTpOutcome[];
  hoursAssessedTotal: number;
  tpsTaughtCount: number;
  tpsPassedCount: number;

  criteriaTotal: number;
  criteriaMetCount: number;
  criteriaPct: number;
  criteriaAboveStandardCount: number;
  criteriaToStandardCount: number;
  criteriaNotYetAssessedCount: number;
  criteriaNotMet: GradeQueryCriterionNote[];

  assignments: GradeQueryAssignmentOutcome[];
  assignmentsNeedingResubmissionCount: number;

  tutorials: GradeQueryTutorialStage[];

  // No letters-issued table/feature exists in this codebase (checked
  // src/lib/supabase/types.ts and every supabase/migrations/*.sql --
  // nothing tracks a warning letter as structured data). Left explicit
  // and null rather than fabricated so this reads as "not tracked" and not
  // as "none were issued".
  lettersIssued: null;
  lettersIssuedNote: string;

  provisionalGrade: GQFinalGrade | null;
  provisionalGradeUpper: GQFinalGrade | null;
  provisionalIsSlashed: boolean;
  provisionalSetAt: string | null;
  provisionalJustification: string | null;

  finalRecommendedGrade: GQFinalGrade | null;
  finalReportReleasedAt: string | null;
}

export interface AssembleGradeQueryEvidenceInput {
  courseTotalHours: number;
  celta5Record: {
    stage1_tutorial_given: boolean;
    stage1_hours_taught: number | null;
    stage1_completed_at: string | null;
    stage1_strengths: string | null;
    stage1_action_plan: string | null;
    stage2_tutorial_given: boolean;
    stage2_hours_taught: number | null;
    stage2_completed_at: string | null;
    stage2_tutor_overall: GQStandardRating | null;
    stage2_tutor_notes: string | null;
    stage3_required: boolean;
    stage3_tutorial_given: boolean;
    stage3_hours_taught: number | null;
    stage3_finalized_at: string | null;
    stage3_tutor_overall: GQStandardRating | null;
    stage3_tutor_notes: string | null;
    provisional_grade: GQFinalGrade | null;
    provisional_grade_upper: GQFinalGrade | null;
    provisional_set_at: string | null;
    provisional_upgrade_conditions: string | null;
    final_recommended_grade: GQFinalGrade | null;
    final_report_released_at: string | null;
  } | null;
  matrixRows: {
    criteria_code: string;
    tutor_status_stage2: GQCriteriaRating | null;
    tutor_status_stage3: GQCriteriaRating | null;
  }[];
  taughtPlanAssignments: { tp_number: number; taught_at: string | null }[]; // already filtered to taught_at is not null
  tpFeedbackRows: { tp_number: number; grade: GQStandardRating | null; submitted_at: string | null }[];
  assignments: {
    assignment_type: string;
    first_status: string;
    first_submitted_at: string | null;
    resubmission_status: string;
    resubmission_submitted_at: string | null;
    final_grade: string | null;
  }[];
}

export function assembleGradeQueryEvidence(
  input: AssembleGradeQueryEvidenceInput
): GradeQueryEvidenceSnapshot {
  const { celta5Record: r, matrixRows, taughtPlanAssignments, tpFeedbackRows, assignments } = input;

  // ---- grade + descriptors ----
  const finalGrade = r?.final_recommended_grade ?? null;
  const provisionalGrade = r?.provisional_grade ?? null;
  const gradeAwarded: GQFinalGrade | null = finalGrade ?? provisionalGrade;
  const gradeSource: "final" | "provisional" | "none" = finalGrade ? "final" : provisionalGrade ? "provisional" : "none";
  const above = gradeAbove(gradeAwarded);

  // ---- TP outcomes ----
  const tpNumbers = Array.from(
    new Set([...taughtPlanAssignments.map((p) => p.tp_number), ...tpFeedbackRows.map((f) => f.tp_number)])
  ).sort((a, b) => a - b);

  const taughtByTp = new Map(taughtPlanAssignments.map((p) => [p.tp_number, p.taught_at]));
  const feedbackByTp = new Map(
    tpFeedbackRows.filter((f) => f.submitted_at).map((f) => [f.tp_number, f])
  );

  const tpOutcomes: GradeQueryTpOutcome[] = tpNumbers.map((tpNumber) => {
    const taughtAt = taughtByTp.get(tpNumber) ?? null;
    const feedback = feedbackByTp.get(tpNumber);
    return {
      tpNumber,
      taughtAt,
      hoursAssessed: taughtAt ? TP_LESSON_LENGTH_MINUTES / 60 : 0,
      outcome: feedback?.grade ?? null,
      outcomeSubmittedAt: feedback?.submitted_at ?? null,
    };
  });

  const tpsTaughtCount = taughtPlanAssignments.length;
  const hoursAssessedTotal = (tpsTaughtCount * TP_LESSON_LENGTH_MINUTES) / 60;
  const tpsPassedCount = tpOutcomes.filter((t) => t.outcomeSubmittedAt && t.outcome !== "not_to_standard").length;

  // ---- criteria ----
  // Stage 3 rating wins where set (the later, more settled assessment);
  // falls back to Stage 2. Same "latest decided rating" idea the celta5
  // record page's own stage forms progress through.
  const matrixByCode = new Map(matrixRows.map((m) => [m.criteria_code, m]));
  const effectiveByCode = new Map<string, GQCriteriaRating | null>();
  for (const code of CELTA_CRITERIA_CODES) {
    const row = matrixByCode.get(code);
    const rating = row?.tutor_status_stage3 ?? row?.tutor_status_stage2 ?? null;
    effectiveByCode.set(code, rating);
  }

  const criteriaPct = computeCriteriaPct(effectiveByCode);
  let criteriaAboveStandardCount = 0;
  let criteriaToStandardCount = 0;
  let criteriaNotYetAssessedCount = 0;
  const criteriaNotMet: GradeQueryCriterionNote[] = [];
  for (const code of CELTA_CRITERIA_CODES) {
    const rating = effectiveByCode.get(code);
    if (rating === "S+") criteriaAboveStandardCount++;
    else if (rating === "S") criteriaToStandardCount++;
    else if (rating === "N") criteriaNotMet.push({ code, label: CRITERIA_LABELS[code] ?? code });
    else criteriaNotYetAssessedCount++; // "X" or null
  }
  const criteriaMetCount = criteriaAboveStandardCount + criteriaToStandardCount;

  // ---- assignments ----
  const assignmentOutcomes: GradeQueryAssignmentOutcome[] = assignments.map((a) => ({
    assignmentType: a.assignment_type,
    firstStatus: a.first_status,
    firstSubmittedAt: a.first_submitted_at,
    resubmissionStatus: a.resubmission_status,
    resubmissionSubmittedAt: a.resubmission_submitted_at,
    // A resubmission slot with anything in it (submitted or still awaited
    // after being required) means a resubmission was needed -- distinct
    // from "resubmission_status still 'not_submitted' because no
    // resubmission was ever required in the first place".
    neededResubmission: a.resubmission_status !== "not_submitted",
    finalGrade: a.final_grade,
  }));
  const assignmentsNeedingResubmissionCount = assignmentOutcomes.filter((a) => a.neededResubmission).length;

  // ---- tutorials ----
  const tutorials: GradeQueryTutorialStage[] = [
    {
      stage: 1,
      applicable: true,
      tutorialGiven: r?.stage1_tutorial_given ?? false,
      hoursTaught: r?.stage1_hours_taught ?? null,
      completedAt: r?.stage1_completed_at ?? null,
      tutorOverall: null, // Stage 1 has no overall rating column (strengths/action plan only)
      notes: [r?.stage1_strengths, r?.stage1_action_plan].filter(Boolean).join("\n\n") || null,
    },
    {
      stage: 2,
      applicable: true,
      tutorialGiven: r?.stage2_tutorial_given ?? false,
      hoursTaught: r?.stage2_hours_taught ?? null,
      completedAt: r?.stage2_completed_at ?? null,
      tutorOverall: r?.stage2_tutor_overall ?? null,
      notes: r?.stage2_tutor_notes ?? null,
    },
    {
      stage: 3,
      applicable: r?.stage3_required ?? false,
      tutorialGiven: r?.stage3_tutorial_given ?? false,
      hoursTaught: r?.stage3_hours_taught ?? null,
      completedAt: r?.stage3_finalized_at ?? null,
      tutorOverall: r?.stage3_tutor_overall ?? null,
      notes: r?.stage3_tutor_notes ?? null,
    },
  ];

  return {
    generatedAtCourseTotalHours: input.courseTotalHours,

    gradeAwarded,
    gradeSource,
    gradeAboveAwarded: above,
    descriptorsForGradeAwarded: descriptorsFor(gradeAwarded),
    descriptorsForGradeAbove: descriptorsFor(above),
    eligibilityNotes: GRADE_DESCRIPTORS.eligibility,

    tpOutcomes,
    hoursAssessedTotal,
    tpsTaughtCount,
    tpsPassedCount,

    criteriaTotal: CELTA_CRITERIA_CODES.length,
    criteriaMetCount,
    criteriaPct,
    criteriaAboveStandardCount,
    criteriaToStandardCount,
    criteriaNotYetAssessedCount,
    criteriaNotMet,

    assignments: assignmentOutcomes,
    assignmentsNeedingResubmissionCount,

    tutorials,

    lettersIssued: null,
    lettersIssuedNote:
      "No letters-issued record exists in this system yet -- there is no warning-letter table or feature in this codebase to read from. Confirm manually with the trainee's file before stating whether/when a letter was issued.",

    provisionalGrade,
    provisionalGradeUpper: r?.provisional_grade_upper ?? null,
    provisionalIsSlashed: Boolean(r?.provisional_grade_upper),
    provisionalSetAt: r?.provisional_set_at ?? null,
    provisionalJustification: r?.provisional_upgrade_conditions ?? null,

    finalRecommendedGrade: finalGrade,
    finalReportReleasedAt: r?.final_report_released_at ?? null,
  };
}
