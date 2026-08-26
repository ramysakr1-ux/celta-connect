import type { PDFPage } from "pdf-lib";
import { drawWrapped, type Celta5Fonts } from "@/lib/celta5-replica-pdf/engine";

export interface Stage3NotesPageData {
  tutorWrittenAssignmentsNotes: string | null;
  tutorOtherNotes: string | null;
}

// Page 25 (0-indexed 24) of the master PDF. Tutor-only -- Stage 3 has no
// candidate self-assessment section. Same "no ruled box, just a label"
// shape as the Stage 2 notes page.
const WRITTEN_ASSIGNMENTS_BOX = { x0: 65, y0: 132, x1: 530, y1: 335 };
const OTHER_BOX = { x0: 65, y0: 437, x1: 530, y1: 750 };

export function drawStage3NotesPage(page: PDFPage, fonts: Celta5Fonts, data: Stage3NotesPageData) {
  if (data.tutorWrittenAssignmentsNotes) drawWrapped(page, fonts.regular, [data.tutorWrittenAssignmentsNotes], WRITTEN_ASSIGNMENTS_BOX);
  if (data.tutorOtherNotes) drawWrapped(page, fonts.regular, [data.tutorOtherNotes], OTHER_BOX);
}
