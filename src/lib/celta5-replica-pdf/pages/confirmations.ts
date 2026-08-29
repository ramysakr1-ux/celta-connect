import type { PDFPage } from "pdf-lib";
import type { Celta5Fonts } from "@/lib/celta5-replica-pdf/engine";

export interface ConfirmationsPageData {
  candidateName: string;
  portfolioConfirmedAt: string | null;
  portfolioSignatureName: string | null;
  appealsConfirmedAt: string | null;
  appealsSignatureName: string | null;
}

// An appended page, not one of Cambridge's.
//
// The CELTA 5 has no page for these two confirmations -- they are the
// centre's own record that the candidate was given, and signed for, the
// portfolio requirements and the appeals procedure. They still have to
// travel with the exported booklet, because of when an appeal happens:
// Administration Handbook 16.2 puts a Stage One appeal AFTER the result is
// confirmed by Cambridge, "within two weeks of the candidate receiving
// their final result", and the bundle Cambridge scrutinises includes the
// candidate portfolio. Ramy, 29 Aug 2026: "the grade appeal comes after
// the course."
//
// By then the exported PDF is what survives, so evidence that the
// candidate was given the appeals procedure has to be inside it rather
// than only on a screen nobody will open again.
//
// Deliberately headed as a centre record and placed after Cambridge's own
// pages, so it can never be mistaken for part of their form.

const LEFT = 60;
const TOP = 760;

function fmt(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function drawConfirmationsPage(page: PDFPage, fonts: Celta5Fonts, data: ConfirmationsPageData) {
  let y = TOP;

  page.drawText("CENTRE RECORD -- CANDIDATE CONFIRMATIONS", {
    x: LEFT,
    y,
    size: 12,
    font: fonts.bold,
  });
  y -= 18;
  page.drawText("Not part of the Cambridge CELTA 5. Retained by the centre as evidence that the", {
    x: LEFT,
    y,
    size: 8.5,
    font: fonts.regular,
  });
  y -= 12;
  page.drawText("candidate was given these documents and confirmed reading them.", {
    x: LEFT,
    y,
    size: 8.5,
    font: fonts.regular,
  });
  y -= 34;

  const block = (title: string, statement: string, name: string | null, at: string | null) => {
    page.drawText(title, { x: LEFT, y, size: 10, font: fonts.bold });
    y -= 15;
    page.drawText(statement, { x: LEFT, y, size: 8.5, font: fonts.regular });
    y -= 20;
    if (at) {
      page.drawText(`Signed: ${name ?? data.candidateName}`, { x: LEFT + 12, y, size: 9.5, font: fonts.regular });
      page.drawText(`Date: ${fmt(at)}`, { x: LEFT + 300, y, size: 9.5, font: fonts.regular });
    } else {
      // An unsigned confirmation is stated as unsigned rather than left
      // blank: a blank line reads as an oversight, "not confirmed" reads
      // as a fact, and on an appeal bundle the difference matters.
      page.drawText("Not confirmed by the candidate.", { x: LEFT + 12, y, size: 9.5, font: fonts.regular });
    }
    y -= 34;
  };

  block(
    "Candidate portfolio requirements",
    "I confirm that I have understood and accept the requirements for the CELTA portfolio.",
    data.portfolioSignatureName,
    data.portfolioConfirmedAt
  );
  block(
    "Cambridge English appeals procedure",
    "I confirm that I have read the Cambridge English Appeals Procedure.",
    data.appealsSignatureName,
    data.appealsConfirmedAt
  );
}
