import type { PDFPage } from "pdf-lib";
import { drawAt, drawTableRow, type Celta5Fonts, type TableColumn } from "@/lib/celta5-replica-pdf/engine";

export interface AbsenceRow {
  date: string; // pre-formatted
  sessionMissed: string | null;
  reason: string | null;
  workMadeUp: string | null;
  candidateComment: string | null; // "other absences" sub-table only
  tutorComment: string | null; // signature (unavoidable) / comment + signature (other)
}

export interface AttendancePageData {
  totalCourseHours: number | null;
  totalHoursAttended: number | null;
  unavoidableAbsences: AbsenceRow[];
  otherAbsences: AbsenceRow[];
}

// Page 11 (0-indexed 10) of the master PDF, landscape. Two sub-tables --
// "unavoidable absences" (5 printed rows) and "other absences/late
// arrivals" (3 printed rows). Real absences are rare enough on a CELTA
// course that overflow isn't wired up here the way it is for Observations/
// Assessed TP (see engine.ts's computeCopiesNeeded) -- if a candidate ever
// genuinely has more than 5/3, extra rows are silently dropped. Revisit if
// that turns out to happen in practice.
//
// "Session missed" and "candidate comment" used to be blank here because
// attendance_absences had no column for either. Migration 0249 added them
// (plus a tutor signature separate from the tutor comment), so all four
// print now -- the columns were already measured and positioned, they
// simply had nothing to draw.
const HOURS_BOX_X_MID = 252.8;
const TOTAL_COURSE_HOURS_Y = 89.5;
const TOTAL_HOURS_ATTENDED_Y = 120.7;

const UNAVOIDABLE_ROW_DIVIDERS = [216.89, 239.69, 262.49, 285.19, 307.99, 330.79];
const UNAVOIDABLE_COLUMNS: TableColumn[] = [
  { x0: 66.2, x1: 163.8 }, // Date/Times
  { x0: 163.8, x1: 313.5, wrap: true }, // Session missed
  { x0: 313.5, x1: 473.1, wrap: true }, // Reason
  { x0: 473.1, x1: 695.5, wrap: true }, // How work made up
  { x0: 695.5, x1: 809.9, wrap: true }, // Tutor signature
];

const OTHER_ROW_DIVIDERS = [419.5, 442.3, 464.98, 487.78];
const OTHER_COLUMNS: TableColumn[] = [
  { x0: 66.2, x1: 197.7 }, // Date/Times
  { x0: 197.7, x1: 312.9, wrap: true }, // Session missed
  { x0: 312.9, x1: 428.1, wrap: true }, // Reason
  { x0: 428.1, x1: 543.3, wrap: true }, // Work made up
  { x0: 543.3, x1: 695.5, wrap: true }, // Candidate comment
  { x0: 695.5, x1: 809.9, wrap: true }, // Tutor comment/signature
];

export function drawAttendancePage(page: PDFPage, fonts: Celta5Fonts, data: AttendancePageData) {
  if (data.totalCourseHours !== null) {
    drawAt(page, fonts.regular, String(data.totalCourseHours), 0, TOTAL_COURSE_HOURS_Y, 10.5, { align: "center", xMid: HOURS_BOX_X_MID });
  }
  if (data.totalHoursAttended !== null) {
    drawAt(page, fonts.regular, String(data.totalHoursAttended), 0, TOTAL_HOURS_ATTENDED_Y, 10.5, { align: "center", xMid: HOURS_BOX_X_MID });
  }

  data.unavoidableAbsences.slice(0, UNAVOIDABLE_ROW_DIVIDERS.length - 1).forEach((row, i) => {
    drawTableRow(page, fonts.regular, [row.date, row.sessionMissed ?? "", row.reason ?? "", row.workMadeUp ?? "", row.tutorComment ?? ""], UNAVOIDABLE_COLUMNS, UNAVOIDABLE_ROW_DIVIDERS, i, 7);
  });

  data.otherAbsences.slice(0, OTHER_ROW_DIVIDERS.length - 1).forEach((row, i) => {
    drawTableRow(page, fonts.regular, [row.date, row.sessionMissed ?? "", row.reason ?? "", row.workMadeUp ?? "", row.candidateComment ?? "", row.tutorComment ?? ""], OTHER_COLUMNS, OTHER_ROW_DIVIDERS, i, 7);
  });
}
