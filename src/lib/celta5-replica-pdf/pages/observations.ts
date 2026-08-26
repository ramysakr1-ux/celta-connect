import type { PDFPage } from "pdf-lib";
import { drawTableRow, type Celta5Fonts, type TableColumn } from "@/lib/celta5-replica-pdf/engine";

export interface ObservationRow {
  date: string; // pre-formatted, e.g. "6 Nov 2026"
  lengthMinutes: number | null;
  level: string | null;
  learnersPresent: number | null;
  lessonFocus: string | null;
  // No "signature of observed teacher" data exists anywhere in Connect --
  // matches the real form's own "where required by centre" framing, an
  // optional per-observation extra most centres don't use. Always blank.
}

// Page 12 (0-indexed 11) of the master PDF, landscape. 10 rows printed;
// ROWS_PER_PAGE governs how many copies of this page get spliced in when a
// candidate has more observations than that (see engine.ts's
// computeCopiesNeeded/buildPageList, and index.ts's use of them).
export const OBSERVATIONS_ROWS_PER_PAGE = 10;

const ROW_DIVIDERS = [129.0, 157.8, 186.5, 215.3, 244.0, 272.8, 301.6, 330.3, 359.1, 387.8, 416.7];

const COLUMNS: TableColumn[] = [
  { x0: 66.2, x1: 152.7 }, // Date
  { x0: 152.7, x1: 239.1 }, // Lesson length (minutes)
  { x0: 239.1, x1: 347.1 }, // Level of class
  { x0: 347.1, x1: 419.1 }, // No. of learners present
  { x0: 419.1, x1: 692.9, wrap: true }, // Lesson focus
  // 692.9-800.9: signature of observed teacher -- left blank, see above.
];

export function drawObservationsPage(page: PDFPage, fonts: Celta5Fonts, rows: ObservationRow[], pageOffset: number) {
  const startRow = pageOffset * OBSERVATIONS_ROWS_PER_PAGE;
  const pageRows = rows.slice(startRow, startRow + OBSERVATIONS_ROWS_PER_PAGE);
  pageRows.forEach((row, i) => {
    drawTableRow(
      page,
      fonts.regular,
      [row.date, row.lengthMinutes !== null ? String(row.lengthMinutes) : "", row.level ?? "", row.learnersPresent !== null ? String(row.learnersPresent) : "", row.lessonFocus ?? ""],
      COLUMNS,
      ROW_DIVIDERS,
      i
    );
  });
}
