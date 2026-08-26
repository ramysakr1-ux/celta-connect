import type { PDFPage } from "pdf-lib";
import { drawAt, drawWrapped, drawOvalAround, type Celta5Fonts } from "@/lib/celta5-replica-pdf/engine";

export type StandardRating = "above_standard" | "to_standard" | "not_to_standard";

export interface Stage2OverallPageData {
  candidateOverall: StandardRating | null;
  candidateNotes: string | null; // "areas you need to work on"
  tutorOverall: StandardRating | null;
  tutorNotes: string | null; // "summary of tutorial and action points"
  tutorSignatureName: string | null;
  tutorSignedAt: string | null; // ISO -- stage2_completed_at
  candidateSignatureName: string | null;
  candidateSignedAt: string | null; // ISO -- trainee_signoff_stage2_at
}

// Page 21 (0-indexed 20) of the master PDF. Each "Circle only one option"
// block has 3 fixed lines; which one gets circled depends on the rating.
const RATING_ORDER: StandardRating[] = ["above_standard", "to_standard", "not_to_standard"];

const CANDIDATE_OPTION_BOXES = [
  { x0: 70, y0: 97.7, x1: 310, y1: 110.0 },
  { x0: 70, y0: 110.4, x1: 292, y1: 122.7 },
  { x0: 70, y0: 123.2, x1: 483, y1: 135.5 },
];
const CANDIDATE_NOTES_BOX = { x0: 62, y0: 178, x1: 525, y1: 316 };

const TUTOR_OPTION_BOXES = [
  { x0: 70, y0: 353.1, x1: 310, y1: 365.4 },
  { x0: 70, y0: 365.7, x1: 292, y1: 378.0 },
  { x0: 70, y0: 378.4, x1: 483, y1: 390.7 },
];
const TUTOR_NOTES_BOX = { x0: 57, y0: 431, x1: 525, y1: 618 };

const TUTOR_SIG_X = 165;
const TUTOR_DATE_X = 440;
const TUTOR_SIG_Y = 657.4;
const CANDIDATE_SIG_X = 190;
const CANDIDATE_DATE_X = 440.5;
const CANDIDATE_SIG_Y = 726.5;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function drawStage2OverallPage(page: PDFPage, fonts: Celta5Fonts, data: Stage2OverallPageData) {
  if (data.candidateOverall) {
    drawOvalAround(page, CANDIDATE_OPTION_BOXES[RATING_ORDER.indexOf(data.candidateOverall)]);
  }
  if (data.candidateNotes) drawWrapped(page, fonts.regular, [data.candidateNotes], CANDIDATE_NOTES_BOX);

  if (data.tutorOverall) {
    drawOvalAround(page, TUTOR_OPTION_BOXES[RATING_ORDER.indexOf(data.tutorOverall)]);
  }
  if (data.tutorNotes) drawWrapped(page, fonts.regular, [data.tutorNotes], TUTOR_NOTES_BOX);

  if (data.tutorSignatureName && data.tutorSignedAt) {
    drawAt(page, fonts.regular, data.tutorSignatureName, TUTOR_SIG_X, TUTOR_SIG_Y);
    drawAt(page, fonts.regular, formatDate(data.tutorSignedAt), TUTOR_DATE_X, TUTOR_SIG_Y);
  }
  if (data.candidateSignatureName && data.candidateSignedAt) {
    drawAt(page, fonts.regular, data.candidateSignatureName, CANDIDATE_SIG_X, CANDIDATE_SIG_Y);
    drawAt(page, fonts.regular, formatDate(data.candidateSignedAt), CANDIDATE_DATE_X, CANDIDATE_SIG_Y);
  }
}
