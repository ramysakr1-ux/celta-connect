import type { PDFPage } from "pdf-lib";
import { drawAt, drawCheck, type Celta5Fonts } from "@/lib/celta5-replica-pdf/engine";

export interface FinalDeclarationPageData {
  checklistTp: boolean;
  checklistObservations: boolean;
  checklistAssignments: boolean;
  checklistOwnWork: boolean;
  checklistAllRecords: boolean;
  candidateSignatureName: string | null;
  candidateSignedAt: string | null; // ISO -- trainee_signoff_final_at
  tutorSignatureName: string | null;
  tutorSignedAt: string | null; // ISO -- trainer_signoff_final_at
}

// Page 27 (0-indexed 26) of the master PDF -- "TO BE COMPLETED ON THE
// FINAL DAY OF THE COURSE". 5 real tick-box rects (not the printed "□"
// glyph's own oversized bbox -- these are the actual small drawn boxes),
// in the same order as the printed checklist.
const CHECKBOXES: [number, number, number, number][] = [
  [61.8, 167.6, 72.2, 178.6], // six hours of assessed teaching practice at at least two levels
  [61.8, 195.9, 72.2, 206.2], // six hours of observation of experienced teachers
  [61.8, 223.5, 72.2, 232.7], // four written assignments
  [62.5, 251.7, 72.8, 262.6], // written assignments are my own work
  [62.5, 275.4, 72.8, 286.3], // completed all records
];

const CANDIDATE_SIG_X = 192;
const CANDIDATE_DATE_X = 412;
const CANDIDATE_SIG_Y = 340.3;

const TUTOR_SIG_X = 174;
const TUTOR_DATE_X = 412;
const TUTOR_SIG_Y = 435.8;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function drawFinalDeclarationPage(page: PDFPage, fonts: Celta5Fonts, data: FinalDeclarationPageData) {
  const checks = [data.checklistTp, data.checklistObservations, data.checklistAssignments, data.checklistOwnWork, data.checklistAllRecords];
  checks.forEach((checked, i) => {
    if (checked) drawCheck(page, fonts.bold, CHECKBOXES[i]);
  });

  if (data.candidateSignatureName && data.candidateSignedAt) {
    drawAt(page, fonts.regular, data.candidateSignatureName, CANDIDATE_SIG_X, CANDIDATE_SIG_Y);
    drawAt(page, fonts.regular, formatDate(data.candidateSignedAt), CANDIDATE_DATE_X, CANDIDATE_SIG_Y);
  }
  // "Accepted by Tutor" -- the final grade-review acceptance, a distinct
  // signature from the Stage 1/2/3 ones (see migration 0221).
  if (data.tutorSignatureName && data.tutorSignedAt) {
    drawAt(page, fonts.regular, data.tutorSignatureName, TUTOR_SIG_X, TUTOR_SIG_Y);
    drawAt(page, fonts.regular, formatDate(data.tutorSignedAt), TUTOR_DATE_X, TUTOR_SIG_Y);
  }
}
