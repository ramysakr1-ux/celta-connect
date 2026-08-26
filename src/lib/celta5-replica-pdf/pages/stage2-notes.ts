import type { PDFPage } from "pdf-lib";
import { drawWrapped, type Celta5Fonts } from "@/lib/celta5-replica-pdf/engine";

export interface Stage2NotesPageData {
  candidateWrittenAssignmentsNotes: string | null;
  tutorWrittenAssignmentsNotes: string | null;
  candidateOtherNotes: string | null;
  tutorOtherNotes: string | null;
}

// Page 20 (0-indexed 19) of the master PDF. Neither free-text area is
// ruled with a box on the real page -- just a YOU/TUTOR label with open
// space below -- so these boxes are estimated column widths (split at the
// midpoint between the two labels), not measured borders.
const YOU_COL = { x0: 51, x1: 385 };
const TUTOR_COL = { x0: 390, x1: 535 };

const WRITTEN_ASSIGNMENTS_BOX_Y = { y0: 155, y1: 395 };
const OTHER_BOX_Y = { y0: 500, y1: 775 };

export function drawStage2NotesPage(page: PDFPage, fonts: Celta5Fonts, data: Stage2NotesPageData) {
  if (data.candidateWrittenAssignmentsNotes) {
    drawWrapped(page, fonts.regular, [data.candidateWrittenAssignmentsNotes], { ...YOU_COL, ...WRITTEN_ASSIGNMENTS_BOX_Y });
  }
  if (data.tutorWrittenAssignmentsNotes) {
    drawWrapped(page, fonts.regular, [data.tutorWrittenAssignmentsNotes], { ...TUTOR_COL, ...WRITTEN_ASSIGNMENTS_BOX_Y });
  }
  if (data.candidateOtherNotes) {
    drawWrapped(page, fonts.regular, [data.candidateOtherNotes], { ...YOU_COL, ...OTHER_BOX_Y });
  }
  if (data.tutorOtherNotes) {
    drawWrapped(page, fonts.regular, [data.tutorOtherNotes], { ...TUTOR_COL, ...OTHER_BOX_Y });
  }
}
