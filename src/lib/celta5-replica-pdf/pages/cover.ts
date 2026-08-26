import type { PDFPage } from "pdf-lib";
import { drawAt, drawCellGrid, type Celta5Fonts } from "@/lib/celta5-replica-pdf/engine";

export interface CoverPageData {
  traineeName: string;
  centerName: string;
  centerNumber: string; // e.g. "UK205" -- exactly 5 characters, fills the boxed grid one-per-cell
  courseCode: string | null; // e.g. "C3/2024" -- split on "/" into the two dotted segments
  courseDates: string; // pre-formatted, e.g. "6 Nov 2026 - 1 Dec 2026"
  tutorNames: string[]; // up to 4 fit the printed lines; extra names run onto a continuation note
  // Cambridge's own field, filled in by Cambridge when relevant -- centres
  // never populate this. Left blank on every generated booklet regardless
  // of whether the app happens to hold a ULN for the candidate.
}

// Coordinates measured directly off page 1 of the real master PDF (fitz
// word/drawing bboxes, top-left origin) -- see engine.ts's fitzY for the
// bottom-left conversion. Re-measure if the master PDF is ever swapped for
// a newer Cambridge revision with a different cover layout.
const CENTRE_NUMBER_CELL_X_MIDS = [160.6, 186.35, 211.9, 237.4, 262.9];
const CENTRE_NUMBER_CELL_BASELINE_Y = 485.8 - 6.5;

const COURSE_NUMBER_FIRST_X = 152;
const COURSE_NUMBER_SECOND_X = 186;
const COURSE_NUMBER_Y = 550.6;

const TUTOR_LINE_X = 102;
const TUTOR_LINE_Y = [610.0, 633.5, 656.9, 680.4];

export function drawCoverPage(page: PDFPage, fonts: Celta5Fonts, data: CoverPageData) {
  drawAt(page, fonts.regular, data.traineeName, 148, 443.2);

  drawCellGrid(page, fonts.regular, data.centerNumber.toUpperCase(), CENTRE_NUMBER_CELL_X_MIDS, CENTRE_NUMBER_CELL_BASELINE_Y);

  drawAt(page, fonts.regular, data.centerName, 131, 521.0);

  if (data.courseCode) {
    const [first, second] = data.courseCode.split("/").map((s) => s.trim());
    drawAt(page, fonts.regular, first ?? "", COURSE_NUMBER_FIRST_X, COURSE_NUMBER_Y);
    if (second) drawAt(page, fonts.regular, second, COURSE_NUMBER_SECOND_X, COURSE_NUMBER_Y);
  }

  drawAt(page, fonts.regular, data.courseDates, 145, 580.4);

  // Only 4 printed lines on the real page -- a 5th+ tutor is a genuine
  // overflow case, not expected in practice for a CELTA course team, so
  // it's dropped rather than built out with no real form to test against.
  data.tutorNames.slice(0, 4).forEach((name, i) => drawAt(page, fonts.regular, name, TUTOR_LINE_X, TUTOR_LINE_Y[i]));

  // ULN grid intentionally left blank -- Ramy's call: it's Cambridge's own
  // field to complete, not the centre's, regardless of any ULN on file.
}
