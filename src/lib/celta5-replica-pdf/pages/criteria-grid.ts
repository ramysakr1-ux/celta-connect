import type { PDFPage } from "pdf-lib";
import { drawAt, type Celta5Fonts } from "@/lib/celta5-replica-pdf/engine";

export type CriteriaRating = "S+" | "S" | "N" | "X";
export type CriteriaMarks = Record<string, CriteriaRating | null>;

interface CodeRow {
  code: string;
  y: number; // fitz y1 of the code's own label -- first line of its (possibly wrapped) guidance text
}

interface GridPage {
  sourcePageIndex: number;
  youXMid: number | null; // null on Stage 3 pages -- tutor-only
  tutorXMid: number;
  codes: CodeRow[];
}

// Coordinates measured directly off the master PDF: each criteria code
// ("4a", "1a", ...) is its own left-margin word, and its bbox marks the
// first line of that code's row -- rows have no fixed height (the
// guidance text below each code wraps to a different number of lines), so
// unlike the table pages there's no evenly spaced divider array here, just
// one measured y per code. "You"/"Tutor" column x-centers shift slightly
// page to page (re-measured per page, not assumed constant).
export const STAGE2_PAGES: GridPage[] = [
  {
    sourcePageIndex: 16, // page 17 -- TOPIC 4, planning
    youXMid: 617.5,
    tutorXMid: 693.5,
    codes: [
      { code: "4a", y: 169.6 },
      { code: "4b", y: 192.2 },
      { code: "4c", y: 214.6 },
      { code: "4d", y: 246.4 },
      { code: "4e", y: 278.2 },
      { code: "4f", y: 300.9 },
      { code: "4g", y: 323.4 },
      { code: "4h", y: 345.9 },
      { code: "4i", y: 368.4 },
      { code: "4j", y: 390.9 },
      { code: "4k", y: 413.4 },
      { code: "4l", y: 436.0 },
      { code: "4m", y: 458.4 },
      { code: "4n", y: 481.0 },
    ],
  },
  {
    sourcePageIndex: 17, // page 18 -- TOPIC 1, TOPIC 2, TOPIC 3
    youXMid: 617.5,
    tutorXMid: 693.5,
    codes: [
      { code: "1a", y: 135.4 },
      { code: "1b", y: 157.9 },
      { code: "1c", y: 189.7 },
      { code: "1d", y: 212.2 },
      { code: "2a", y: 257.2 },
      { code: "2b", y: 279.7 },
      { code: "2c", y: 302.4 },
      { code: "2d", y: 324.8 },
      { code: "2e", y: 347.4 },
      { code: "2f", y: 379.2 },
      { code: "2g", y: 401.7 },
      { code: "3a", y: 446.7 },
      { code: "3b", y: 469.2 },
    ],
  },
  {
    sourcePageIndex: 18, // page 19 -- TOPIC 5
    youXMid: 620.5,
    tutorXMid: 695.3,
    codes: [
      { code: "5a", y: 121.3 },
      { code: "5b", y: 153.1 },
      { code: "5c", y: 175.5 },
      { code: "5d", y: 198.1 },
      { code: "5e", y: 220.6 },
      { code: "5f", y: 243.1 },
      { code: "5g", y: 265.6 },
      { code: "5h", y: 288.1 },
      { code: "5i", y: 310.7 },
      { code: "5j", y: 333.1 },
      { code: "5k", y: 355.7 },
      { code: "5l", y: 387.5 },
      { code: "5m", y: 410.1 },
      { code: "5n", y: 441.9 },
    ],
  },
];

// Stage 3 only re-assesses "Teaching Practice" (Topics 1, 2, 3, 5) -- NOT
// Topic 4 (Planning), confirmed by the real page layout having no Topic 4
// section at all on either Stage 3 page. 27 codes, not 41.
export const STAGE3_PAGES: GridPage[] = [
  {
    sourcePageIndex: 22, // page 23 -- TOPIC 1, TOPIC 2, TOPIC 3
    youXMid: null,
    tutorXMid: 621.5,
    codes: [
      { code: "1a", y: 131.6 },
      { code: "1b", y: 159.1 },
      { code: "1c", y: 186.2 },
      { code: "1d", y: 208.5 },
      { code: "2a", y: 253.5 },
      { code: "2b", y: 276.2 },
      { code: "2c", y: 298.5 },
      { code: "2d", y: 321.3 },
      { code: "2e", y: 348.2 },
      { code: "2f", y: 375.3 },
      { code: "2g", y: 398.2 },
      { code: "3a", y: 443.2 },
      { code: "3b", y: 470.2 },
    ],
  },
  {
    sourcePageIndex: 23, // page 24 -- TOPIC 5
    youXMid: null,
    tutorXMid: 617.5,
    codes: [
      { code: "5a", y: 114.4 },
      { code: "5b", y: 146.2 },
      { code: "5c", y: 169.0 },
      { code: "5d", y: 191.2 },
      { code: "5e", y: 214.0 },
      { code: "5f", y: 236.2 },
      { code: "5g", y: 259.0 },
      { code: "5h", y: 281.3 },
      { code: "5i", y: 304.1 },
      { code: "5j", y: 326.3 },
      { code: "5k", y: 349.1 },
      { code: "5l", y: 380.9 },
      { code: "5m", y: 403.1 },
      { code: "5n", y: 434.9 },
    ],
  },
];

export function drawCriteriaGridPage(page: PDFPage, fonts: Celta5Fonts, gridPage: GridPage, candidateMarks: CriteriaMarks | null, tutorMarks: CriteriaMarks) {
  for (const { code, y } of gridPage.codes) {
    if (gridPage.youXMid !== null && candidateMarks) {
      const mark = candidateMarks[code];
      if (mark) drawAt(page, fonts.regular, mark, 0, y, 9, { align: "center", xMid: gridPage.youXMid });
    }
    const tutorMark = tutorMarks[code];
    if (tutorMark) drawAt(page, fonts.regular, tutorMark, 0, y, 9, { align: "center", xMid: gridPage.tutorXMid });
  }
}
