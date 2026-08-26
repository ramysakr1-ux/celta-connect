import "server-only";
import fs from "node:fs";
import path from "node:path";
import { PDFDocument, PDFFont, PDFPage, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

const ASSETS_DIR = path.join(process.cwd(), "src/lib/celta5-replica-pdf/assets");

export const MASTER_PDF_PATH = path.join(ASSETS_DIR, "celta5-master-july-2023.pdf");

// The real Cambridge CELTA 5 (July 2023) Candidate Record Booklet -- Ramy's
// own master copy, given to the centre by Cambridge. Reused for every
// candidate on every course; only the overlaid data below varies. Deliberately
// NOT under public/ -- this is Cambridge's copyrighted document, not an asset
// this app should serve at a guessable URL.
export async function loadMasterDocument(): Promise<PDFDocument> {
  const bytes = fs.readFileSync(MASTER_PDF_PATH);
  return PDFDocument.load(bytes);
}

export interface Celta5Fonts {
  regular: PDFFont;
  bold: PDFFont;
}

// subset: false is deliberate -- pdf-lib's glyph subsetter drops composite
// (base+diacritic) glyphs for this font, silently rendering Turkish/other
// Latin Extended names (Hasırcı, Şen, Yalçın, İstanbul) with missing
// letters. Full embed costs ~600KB across both weights, irrelevant for a
// document generated once per candidate at course close-out.
export async function embedCelta5Fonts(doc: PDFDocument): Promise<Celta5Fonts> {
  doc.registerFontkit(fontkit);
  const regularBytes = fs.readFileSync(path.join(ASSETS_DIR, "Arimo-Regular.ttf"));
  const boldBytes = fs.readFileSync(path.join(ASSETS_DIR, "Arimo-Bold.ttf"));
  const regular = await doc.embedFont(regularBytes, { subset: false });
  const bold = await doc.embedFont(boldBytes, { subset: false });
  return { regular, bold };
}

// Every coordinate in the page-layout modules is taken by reading words/
// drawings straight off the real master PDF with PyMuPDF (top-left origin,
// y increasing downward -- "fitz" coordinates). PDF drawing itself is
// bottom-left origin. Centralized here so each page module can stay in the
// same coordinate space the source was measured in.
export function fitzY(page: PDFPage, fitzYCoord: number, baselineAdjust = 2.2): number {
  return page.getHeight() - fitzYCoord + baselineAdjust;
}

export function drawAt(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  fitzY1: number,
  size = 10.5,
  opts?: { align?: "left" | "center"; xMid?: number }
) {
  if (!text) return;
  let drawX = x;
  if (opts?.align === "center" && opts.xMid !== undefined) {
    const w = font.widthOfTextAtSize(text, size);
    drawX = opts.xMid - w / 2;
  }
  page.drawText(text, { x: drawX, y: fitzY(page, fitzY1), size, font, color: rgb(0, 0, 0) });
}

// Splits into an ordered array of character cells for the boxed digit-cell
// grids (Centre Number: 5 cells, ULN: 10 cells) -- one char centered per
// cell, blank cells left empty if the value is shorter than the grid.
export function drawCellGrid(page: PDFPage, font: PDFFont, value: string, cellXMids: number[], fitzY1: number, size = 12) {
  const chars = value.split("");
  cellXMids.forEach((xMid, i) => {
    if (chars[i]) drawAt(page, font, chars[i], 0, fitzY1, size, { align: "center", xMid });
  });
}
