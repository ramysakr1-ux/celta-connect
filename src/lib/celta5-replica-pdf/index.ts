import "server-only";
import { PDFDocument } from "pdf-lib";
import { loadMasterDocument, embedCelta5Fonts, computeCopiesNeeded, buildPageList } from "@/lib/celta5-replica-pdf/engine";
import { drawCoverPage, type CoverPageData } from "@/lib/celta5-replica-pdf/pages/cover";
import { drawStage1Page, type Stage1PageData } from "@/lib/celta5-replica-pdf/pages/stage1";
import { drawObservationsPage, OBSERVATIONS_ROWS_PER_PAGE, type ObservationRow } from "@/lib/celta5-replica-pdf/pages/observations";
import { drawAssessedTpPage, ASSESSED_TP_ROWS_PER_PAGE, type AssessedTpRow } from "@/lib/celta5-replica-pdf/pages/assessed-tp";
import { drawAttendancePage, type AttendancePageData } from "@/lib/celta5-replica-pdf/pages/attendance";

export interface Celta5ReplicaInput {
  cover: CoverPageData;
  attendance: AttendancePageData;
  stage1: Stage1PageData;
  observations: ObservationRow[];
  assessedTp: AssessedTpRow[];
}

const PAGE_INDEX = { attendance: 10, stage1: 14, observations: 11, assessedTp: 12 };

// Produces a visually identical copy of the real Cambridge CELTA 5 booklet
// -- the master PDF's own pages, unchanged, with the candidate/course data
// drawn on top at the real form's own coordinates. Distinct from
// celta5-booklet-pdf/document.tsx, which is Connect's own "digital
// original" design and stays as-is for its own purpose; this module exists
// specifically because Cambridge requires the CELTA 5 candidates actually
// submit to be an unaltered copy of their document (same logo, fonts,
// layout, centre number etc.) -- see the project's celta5-replica memory.
//
// Cover, Attendance, Stage 1, Observations and Assessed TP are wired up so
// far. Every other page currently passes through from the master unchanged
// (informational pages already need nothing drawn on them; the remaining
// progress-record/criteria-grid/signature pages still need their own
// coordinate mapping, in progress).
export async function renderCelta5ReplicaBuffer(input: Celta5ReplicaInput): Promise<Buffer> {
  const master = await loadMasterDocument();
  const pageCount = master.getPageCount();
  const out = await PDFDocument.create();
  const fonts = await embedCelta5Fonts(out);

  // Observations/Assessed TP are the two tables where a real candidate can
  // easily have more entries than the printed page has rows -- Ramy's
  // call: duplicate the real page as many times as needed rather than cap
  // or shrink rows. Every other page appears exactly once.
  const observationsCopies = computeCopiesNeeded(input.observations.length, OBSERVATIONS_ROWS_PER_PAGE);
  const assessedTpCopies = computeCopiesNeeded(input.assessedTp.length, ASSESSED_TP_ROWS_PER_PAGE);
  const repeatCounts = new Map<number, number>([
    [PAGE_INDEX.observations, observationsCopies],
    [PAGE_INDEX.assessedTp, assessedTpCopies],
  ]);
  const { list: pageList, startIndex } = buildPageList(pageCount, repeatCounts);

  const copiedPages = await out.copyPages(master, pageList);
  copiedPages.forEach((page) => out.addPage(page));

  drawCoverPage(out.getPage(startIndex.get(0)!), fonts, input.cover);
  drawAttendancePage(out.getPage(startIndex.get(PAGE_INDEX.attendance)!), fonts, input.attendance);
  drawStage1Page(out.getPage(startIndex.get(PAGE_INDEX.stage1)!), fonts, input.stage1);

  const observationsStart = startIndex.get(PAGE_INDEX.observations)!;
  for (let i = 0; i < observationsCopies; i++) {
    drawObservationsPage(out.getPage(observationsStart + i), fonts, input.observations, i);
  }

  const assessedTpStart = startIndex.get(PAGE_INDEX.assessedTp)!;
  for (let i = 0; i < assessedTpCopies; i++) {
    drawAssessedTpPage(out.getPage(assessedTpStart + i), fonts, input.assessedTp, i);
  }

  const bytes = await out.save();
  return Buffer.from(bytes);
}
