import type { PDFPage } from "pdf-lib";
import { drawCheck, drawSignature, type Celta5Fonts } from "@/lib/celta5-replica-pdf/engine";

export type AssignmentTypeValue = "Focus on Learner" | "LRT" | "Skills" | "LfC";

export interface AssignmentRow {
  assignmentType: AssignmentTypeValue;
  finalGrade: string | null; // "Pass" | "Fail" | null
  passedOnResubmission: boolean; // true if the pass came from the 2nd submission, not the 1st
  candidateSignatureName: string | null; // no typed-name column exists for this confirmation yet -- see note below
}

export interface WrittenAssignmentsPageData {
  assignments: AssignmentRow[];
}

// Page 14 (0-indexed 13) of the master PDF. Fixed 4-row grid, one row per
// assignment type in the real form's own printed order -- NOT driven by
// whatever order the trainee's assignments happen to come back in.
const ROW_ORDER: AssignmentTypeValue[] = ["Focus on Learner", "LRT", "Skills", "LfC"];
const ROW_Y = [494.1, 544.2, 594.2, 644.1].map((y0, i) => ({ y0, y1: [543.4, 593.5, 643.4, 693.5][i] }));

const PASS_1ST_X = [194.7, 275.7];
const PASS_2ND_X = [275.7, 347.7];
const FAIL_X = [347.7, 408.7];
const SIGNATURE_X = 413;
// The row's own right-hand edge is unmeasured (no column boundary printed
// after the signature) -- 538 matches this document's consistent portrait
// right margin elsewhere (Stage 1's STRENGTHS_BOX/ACTION_PLAN_BOX both end
// at x1=538). Ramy, 2026-08-27, reviewing a real export: "the writing
// doesn't wrap around, so it went outside the page border" -- a long
// candidate name drawn with the old unbounded drawAt() ran straight off
// the printable page.
const SIGNATURE_MAX_WIDTH = 538 - SIGNATURE_X;

export function drawWrittenAssignmentsPage(page: PDFPage, fonts: Celta5Fonts, data: WrittenAssignmentsPageData) {
  const byType = new Map(data.assignments.map((a) => [a.assignmentType, a]));

  ROW_ORDER.forEach((type, i) => {
    const a = byType.get(type);
    if (!a || !a.finalGrade) return;
    const { y0, y1 } = ROW_Y[i];
    const yMid = (y0 + y1) / 2;

    if (a.finalGrade === "Fail") {
      drawCheck(page, fonts.bold, [FAIL_X[0], y0 + 6, FAIL_X[1], y0 + 20]);
    } else if (a.passedOnResubmission) {
      drawCheck(page, fonts.bold, [PASS_2ND_X[0], y0 + 6, PASS_2ND_X[1], y0 + 20]);
    } else {
      drawCheck(page, fonts.bold, [PASS_1ST_X[0], y0 + 6, PASS_1ST_X[1], y0 + 20]);
    }

    if (a.candidateSignatureName) {
      drawSignature(page, fonts.regular, a.candidateSignatureName, SIGNATURE_X, yMid + 3, SIGNATURE_MAX_WIDTH);
    }
  });
}
