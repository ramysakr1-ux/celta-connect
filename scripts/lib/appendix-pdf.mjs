// Renders one appendix to a PDF, using the same pdf-lib already in the app.
//
// Deliberately plain: this is a classroom worksheet a candidate attached, not
// a Connect document, and dressing it in the platform's identity would make a
// tutor think the platform produced it.
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Arimo, already in the repo for the CELTA 5 replica, and the reason these
// render at all: pdf-lib's standard fonts are WinAnsi, which has no IPA. Two
// of these worksheets are pronunciation worksheets -- a minimal-pairs sheet
// that says "/th/ and /dh/" instead of the phonemes is not the material a
// CELTA tutor is marking.
const ASSETS = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../src/lib/celta5-replica-pdf/assets");

const PAGE = [595, 842];
const MARGIN = 56;
const WIDTH = PAGE[0] - MARGIN * 2;
const INK = rgb(0.13, 0.12, 0.11);
const MUTED = rgb(0.45, 0.42, 0.4);
const TEAL = rgb(0.15, 0.35, 0.36);

// Only the non-breaking space needs folding -- it measures as a word joiner
// and wrecks the wrap. Arimo carries everything else, phonemes included.
const ascii = (s) => String(s).replace(/\u00a0/g, " ");

function wrap(text, font, size, width) {
  const lines = [];
  for (const para of ascii(text).split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > width && line) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    lines.push(line);
  }
  return lines;
}

export async function renderAppendixPdf({ label, title, subtitle, blocks }) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(fs.readFileSync(path.join(ASSETS, "Arimo-Regular.ttf")), { subset: true });
  const bold = await pdf.embedFont(fs.readFileSync(path.join(ASSETS, "Arimo-Bold.ttf")), { subset: true });
  // No italic cut ships with Arimo here; the muted colour carries the role.
  const italic = font;

  let page = pdf.addPage(PAGE);
  let y = PAGE[1] - MARGIN;

  const write = (text, { size = 10.5, f = font, colour = INK, lead = 14, indent = 0, gapAfter = 6 } = {}) => {
    for (const line of wrap(text, f, size, WIDTH - indent)) {
      if (y < MARGIN + lead) {
        page = pdf.addPage(PAGE);
        y = PAGE[1] - MARGIN;
      }
      page.drawText(line, { x: MARGIN + indent, y, size, font: f, color: colour });
      y -= lead;
    }
    y -= gapAfter;
  };

  write(label.toUpperCase(), { size: 8.5, f: bold, colour: TEAL, lead: 12, gapAfter: 4 });
  write(title, { size: 16, f: bold, lead: 20, gapAfter: 4 });
  if (subtitle) write(subtitle, { size: 9, f: italic, colour: MUTED, lead: 12, gapAfter: 14 });

  for (const b of blocks) {
    if (b.kind === "h") write(b.text, { size: 11.5, f: bold, colour: TEAL, lead: 15, gapAfter: 4 });
    else if (b.kind === "li") write(b.text, { size: 10, lead: 13.5, indent: 14, gapAfter: 2 });
    else if (b.kind === "note") write(b.text, { size: 9.5, f: italic, colour: MUTED, lead: 13, gapAfter: 10 });
    else write(b.text, { size: 10.5, lead: 14.5, gapAfter: 8 });
  }

  return Buffer.from(await pdf.save());
}
