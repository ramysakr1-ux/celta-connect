import type { PDFPage } from "pdf-lib";
import { drawAt, drawWrapped, drawOvalAround, type Celta5Fonts } from "@/lib/celta5-replica-pdf/engine";
import type { StandardRating } from "@/lib/celta5-replica-pdf/pages/stage2-overall";

export interface Stage3OverallPageData {
  tutorOverall: StandardRating | null;
  tutorNotes: string | null;
  tutorSignatureName: string | null;
  tutorSignedAt: string | null; // ISO -- stage3_finalized_at
  candidateSignatureName: string | null;
  candidateSignedAt: string | null; // ISO -- stage3_candidate_signed_at
}

// Page 26 (0-indexed 25) of the master PDF. Tutor-only assessment, same as
// the Stage 3 notes page -- no candidate self-assessment section here.
const RATING_ORDER: StandardRating[] = ["above_standard", "to_standard", "not_to_standard"];

const TUTOR_OPTION_BOXES = [
  { x0: 78, y0: 89.1, x1: 318, y1: 101.5 },
  { x0: 78, y0: 101.9, x1: 300, y1: 114.2 },
  { x0: 78, y0: 114.5, x1: 492, y1: 126.8 },
];
const TUTOR_NOTES_BOX = { x0: 65, y0: 168, x1: 530, y1: 568 };

const TUTOR_SIG_X = 170;
const TUTOR_DATE_X = 448;
const TUTOR_SIG_Y = 608.5;
const CANDIDATE_SIG_X = 195;
const CANDIDATE_DATE_X = 449;
const CANDIDATE_SIG_Y = 665.2;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function drawStage3OverallPage(page: PDFPage, fonts: Celta5Fonts, data: Stage3OverallPageData) {
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
