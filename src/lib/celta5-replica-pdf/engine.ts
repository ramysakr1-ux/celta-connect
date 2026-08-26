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

// A hollow-square tick box on the real form (see the checkbox rects on
// Stage 1/2/3 Progress Records, the final-day declaration) -- an X drawn
// centered inside it. `box` is a fitz-space rect [x0, y0, x1, y1].
export function drawCheck(page: PDFPage, font: PDFFont, box: [number, number, number, number]) {
  const [x0, y0, x1, y1] = box;
  const xMid = (x0 + x1) / 2;
  const yMid = (y0 + y1) / 2;
  const size = Math.min(x1 - x0, y1 - y0) * 0.8;
  drawAt(page, font, "X", 0, yMid + size / 2.6, size, { align: "center", xMid });
}

// Word-wraps free text top-down inside a fitz-space box, one paragraph per
// input array entry (a blank line's worth of gap between paragraphs).
// Truncates rather than overflowing past the box's bottom -- these boxes
// are a fixed size on the real page, same constraint a tutor writing by
// hand would have.
export function drawWrapped(
  page: PDFPage,
  font: PDFFont,
  paragraphs: string[],
  box: { x0: number; y0: number; x1: number; y1: number },
  size = 9.5,
  lineHeight = 12
) {
  const maxWidth = box.x1 - box.x0;
  let cursorY = box.y0;
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
        if (cursorY + lineHeight > box.y1) return;
        drawAt(page, font, line, box.x0, cursorY, size);
        cursorY += lineHeight;
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) {
      if (cursorY + lineHeight > box.y1) return;
      drawAt(page, font, line, box.x0, cursorY, size);
      cursorY += lineHeight;
    }
    cursorY += lineHeight * 0.4;
  }
}

// Draws a hand-circle-style oval border around a fitz-space rect -- used
// for "Circle only one option" (overall progress ratings). Unfilled, black
// border, same visual language as a tutor circling one of the printed
// options by hand.
export function drawOvalAround(page: PDFPage, box: { x0: number; y0: number; x1: number; y1: number }) {
  const xMid = (box.x0 + box.x1) / 2;
  const yMidFitz = (box.y0 + box.y1) / 2;
  const xScale = (box.x1 - box.x0) / 2 + 10;
  const yScale = (box.y1 - box.y0) / 2 + 9;
  page.drawEllipse({
    x: xMid,
    y: fitzY(page, yMidFitz, 0),
    xScale,
    yScale,
    borderColor: rgb(0, 0, 0),
    borderWidth: 1.1,
  });
}

// How many copies of a repeatable-table page (Observations, Assessed
// Teaching Practice) are needed to fit every row -- Ramy's call: rather
// than capping at the printed row count or shrinking rows to force-fit,
// duplicate the real master page as many times as needed and continue the
// table across copies, same as a candidate extending it by hand.
export function computeCopiesNeeded(rowCount: number, rowsPerPage: number): number {
  return Math.max(1, Math.ceil(rowCount / rowsPerPage));
}

// Expands a straight page list into one with extra copies of specific
// source pages spliced in, and records where each source page's copies
// start in the expanded (output) list -- e.g. page 12 needing 3 copies to
// fit its rows becomes 3 consecutive entries in `list`, and
// `startIndex.get(12)` is the output index of the first one.
export function buildPageList(totalPages: number, repeatCounts: Map<number, number>): { list: number[]; startIndex: Map<number, number> } {
  const list: number[] = [];
  const startIndex = new Map<number, number>();
  for (let i = 0; i < totalPages; i++) {
    const copies = repeatCounts.get(i) ?? 1;
    startIndex.set(i, list.length);
    for (let c = 0; c < copies; c++) list.push(i);
  }
  return { list, startIndex };
}

export interface TableColumn {
  x0: number;
  x1: number;
  wrap?: boolean; // multi-line within the row (e.g. "Lesson focus"); single-line elsewhere
}

// Draws one row of a repeatable table -- `rowDividers` are the fitz-space y
// values measured off the real page (consecutive pairs are one row's
// [top, bottom]); `rowIndex` picks which pair. Cells align with `columns`
// in order; a wrap column word-wraps within the row's height instead of
// overflowing into the next column.
export function drawTableRow(
  page: PDFPage,
  font: PDFFont,
  cells: string[],
  columns: TableColumn[],
  rowDividers: number[],
  rowIndex: number,
  size = 8.5
) {
  const top = rowDividers[rowIndex];
  const bottom = rowDividers[rowIndex + 1];
  columns.forEach((col, i) => {
    const text = cells[i] ?? "";
    if (!text) return;
    if (col.wrap) {
      drawWrapped(page, font, [text], { x0: col.x0 + 4, y0: top + size + 2.5, x1: col.x1 - 4, y1: bottom - 2 }, size, size + 1.5);
    } else {
      drawAt(page, font, text, col.x0 + 4, top + (bottom - top) / 2 + size / 2.6, size);
    }
  });
}
