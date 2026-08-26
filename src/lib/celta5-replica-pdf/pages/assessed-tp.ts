import type { PDFPage } from "pdf-lib";
import { drawTableRow, type Celta5Fonts, type TableColumn } from "@/lib/celta5-replica-pdf/engine";

export interface AssessedTpRow {
  date: string; // pre-formatted, e.g. "6 Nov 2026"
  lengthMinutes: number | null;
  level: string | null;
  learnerCount: number | null;
  lessonFocus: string | null;
  tutorAssessment: string | null; // S+/S/N/X, tp_lessons.tutor_assessment
  tutorInitials: string | null; // derived from tp_lessons.trainer_id -> profiles.full_name
}

// Page 13 (0-indexed 12) of the master PDF, landscape. 12 rows printed;
// ROWS_PER_PAGE governs how many copies of this page get spliced in when a
// candidate has more assessed TP sessions than that.
export const ASSESSED_TP_ROWS_PER_PAGE = 12;

// The header text (Date/Length/Level/... labels) runs from fitz y=130.7 to
// 155.7 -- the first dividers array entry used to be 130.0, which is the
// header's own TOP edge, not the header/row1 boundary, and caused row 1's
// data to render on top of the header labels. Dropped.
const ROW_DIVIDERS = [156.0, 182.8, 209.6, 236.2, 263.0, 289.9, 316.5, 343.3, 370.0, 396.9, 423.7, 450.3, 477.2];

const COLUMNS: TableColumn[] = [
  { x0: 66.2, x1: 123.9 }, // Date
  { x0: 123.9, x1: 174.3 }, // Length
  { x0: 174.3, x1: 217.5 }, // Level
  { x0: 217.5, x1: 275.1 }, // No. of learners
  { x0: 275.1, x1: 620.9, wrap: true }, // Lesson focus
  { x0: 620.9, x1: 737.9 }, // Tutor assessment*
  { x0: 737.9, x1: 791.9 }, // Tutor initials
];

export function drawAssessedTpPage(page: PDFPage, fonts: Celta5Fonts, rows: AssessedTpRow[], pageOffset: number) {
  const startRow = pageOffset * ASSESSED_TP_ROWS_PER_PAGE;
  const pageRows = rows.slice(startRow, startRow + ASSESSED_TP_ROWS_PER_PAGE);
  pageRows.forEach((row, i) => {
    drawTableRow(
      page,
      fonts.regular,
      [
        row.date,
        row.lengthMinutes !== null ? String(row.lengthMinutes) : "",
        row.level ?? "",
        row.learnerCount !== null ? String(row.learnerCount) : "",
        row.lessonFocus ?? "",
        row.tutorAssessment ?? "",
        row.tutorInitials ?? "",
      ],
      COLUMNS,
      ROW_DIVIDERS,
      i
    );
  });
}
