import "server-only";
import { PDFDocument } from "pdf-lib";
import { loadMasterDocument, embedCelta5Fonts, computeCopiesNeeded, buildPageList } from "@/lib/celta5-replica-pdf/engine";
import { drawCoverPage, type CoverPageData } from "@/lib/celta5-replica-pdf/pages/cover";
import { drawStage1Page, type Stage1PageData } from "@/lib/celta5-replica-pdf/pages/stage1";
import { drawObservationsPage, OBSERVATIONS_ROWS_PER_PAGE, type ObservationRow } from "@/lib/celta5-replica-pdf/pages/observations";
import { drawAssessedTpPage, ASSESSED_TP_ROWS_PER_PAGE, type AssessedTpRow } from "@/lib/celta5-replica-pdf/pages/assessed-tp";
import { drawAttendancePage, type AttendancePageData } from "@/lib/celta5-replica-pdf/pages/attendance";
import { drawCriteriaGridPage, STAGE2_PAGES, STAGE3_PAGES, type CriteriaMarks } from "@/lib/celta5-replica-pdf/pages/criteria-grid";
import { drawStage2NotesPage, type Stage2NotesPageData } from "@/lib/celta5-replica-pdf/pages/stage2-notes";
import { drawStage2OverallPage, type Stage2OverallPageData } from "@/lib/celta5-replica-pdf/pages/stage2-overall";
import { drawStage3NotesPage, type Stage3NotesPageData } from "@/lib/celta5-replica-pdf/pages/stage3-notes";
import { drawStage3OverallPage, type Stage3OverallPageData } from "@/lib/celta5-replica-pdf/pages/stage3-overall";
import { drawFinalDeclarationPage, type FinalDeclarationPageData } from "@/lib/celta5-replica-pdf/pages/final-declaration";

export interface Celta5ReplicaInput {
  cover: CoverPageData;
  attendance: AttendancePageData;
  stage1: Stage1PageData;
  observations: ObservationRow[];
  assessedTp: AssessedTpRow[];
  candidateStage2Marks: CriteriaMarks;
  tutorStage2Marks: CriteriaMarks;
  tutorStage3Marks: CriteriaMarks;
  stage2Notes: Stage2NotesPageData;
  stage2Overall: Stage2OverallPageData;
  stage3Notes: Stage3NotesPageData;
  stage3Overall: Stage3OverallPageData;
  finalDeclaration: FinalDeclarationPageData;
}

const PAGE_INDEX = {
  attendance: 10,
  observations: 11,
  assessedTp: 12,
  stage1: 14,
  stage2Notes: 19,
  stage2Overall: 20,
  stage3Notes: 24,
  stage3Overall: 25,
  finalDeclaration: 26,
};

// Produces a visually identical copy of the real Cambridge CELTA 5 booklet
// -- the master PDF's own pages, unchanged, with the candidate/course data
// drawn on top at the real form's own coordinates. Distinct from
// celta5-booklet-pdf/document.tsx, which is Connect's own "digital
// original" design and stays as-is for its own purpose; this module exists
// specifically because Cambridge requires the CELTA 5 candidates actually
// submit to be an unaltered copy of their document (same logo, fonts,
// layout, centre number etc.) -- see the project's celta5-replica memory.
//
// Every dynamic page is wired up now: cover, attendance, Stage 1/2/3
// (criteria grids, notes, overall assessment, signatures), the final-day
// declaration, Observations, and Assessed TP. The remaining ~15 pages
// (roles/responsibilities, appeals procedure, candidate guide,
// Appendix 1/2) are genuinely static in the real document -- nothing is
// ever filled in on them, so they pass through from the master unchanged.
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

  for (const gridPage of STAGE2_PAGES) {
    drawCriteriaGridPage(out.getPage(startIndex.get(gridPage.sourcePageIndex)!), fonts, gridPage, input.candidateStage2Marks, input.tutorStage2Marks);
  }
  for (const gridPage of STAGE3_PAGES) {
    drawCriteriaGridPage(out.getPage(startIndex.get(gridPage.sourcePageIndex)!), fonts, gridPage, null, input.tutorStage3Marks);
  }

  drawStage2NotesPage(out.getPage(startIndex.get(PAGE_INDEX.stage2Notes)!), fonts, input.stage2Notes);
  drawStage2OverallPage(out.getPage(startIndex.get(PAGE_INDEX.stage2Overall)!), fonts, input.stage2Overall);
  drawStage3NotesPage(out.getPage(startIndex.get(PAGE_INDEX.stage3Notes)!), fonts, input.stage3Notes);
  drawStage3OverallPage(out.getPage(startIndex.get(PAGE_INDEX.stage3Overall)!), fonts, input.stage3Overall);
  drawFinalDeclarationPage(out.getPage(startIndex.get(PAGE_INDEX.finalDeclaration)!), fonts, input.finalDeclaration);

  const bytes = await out.save();
  return Buffer.from(bytes);
}
