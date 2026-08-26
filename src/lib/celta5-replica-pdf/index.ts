import "server-only";
import { PDFDocument } from "pdf-lib";
import { loadMasterDocument, embedCelta5Fonts } from "@/lib/celta5-replica-pdf/engine";
import { drawCoverPage, type CoverPageData } from "@/lib/celta5-replica-pdf/pages/cover";

export interface Celta5ReplicaInput {
  cover: CoverPageData;
}

// Produces a visually identical copy of the real Cambridge CELTA 5 booklet
// -- the master PDF's own pages, unchanged, with the candidate/course data
// drawn on top at the real form's own coordinates. Distinct from
// celta5-booklet-pdf/document.tsx, which is Connect's own "digital
// original" design and stays as-is for its own purpose; this module exists
// specifically because Cambridge requires the CELTA 5 candidates actually
// submit to be an unaltered copy of their document (same logo, fonts,
// layout, centre number etc.) -- see the project's celta5-replica memory.
//
// Only the cover page is wired up so far. Every other page currently
// passes through from the master unchanged (informational pages already
// need nothing drawn on them; the progress-record/criteria-grid/signature
// pages still need their own per-page coordinate mapping, in progress).
export async function renderCelta5ReplicaBuffer(input: Celta5ReplicaInput): Promise<Buffer> {
  const master = await loadMasterDocument();
  const pageCount = master.getPageCount();
  const out = await PDFDocument.create();
  const fonts = await embedCelta5Fonts(out);

  const copiedPages = await out.copyPages(master, [...Array(pageCount).keys()]);
  copiedPages.forEach((page) => out.addPage(page));

  drawCoverPage(out.getPage(0), fonts, input.cover);

  const bytes = await out.save();
  return Buffer.from(bytes);
}
