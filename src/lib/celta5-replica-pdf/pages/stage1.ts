import type { PDFPage } from "pdf-lib";
import { drawAt, drawCheck, drawWrapped, drawSignature, type Celta5Fonts } from "@/lib/celta5-replica-pdf/engine";

export interface Stage1PageData {
  tutorialGiven: boolean;
  hoursTaught: number | null;
  strengths: string | null;
  actionPlan: string | null;
  candidateSignatureName: string | null;
  candidateSignedAt: string | null; // ISO
  tutorSignatureName: string | null;
  tutorSignedAt: string | null; // ISO -- stage1_completed_at doubles as this date
}

// Page 15 (0-indexed 14) of the master PDF. Coordinates measured off the
// real page's own drawing layer (checkbox/text-box rects) and word layer
// (signature line positions).
const TUTORIAL_GIVEN_BOX: [number, number, number, number] = [123.1, 170.1, 138.8, 185.8];
const HOURS_TAUGHT_BOX: [number, number, number, number] = [267.0, 170.1, 282.8, 185.8];
const TUTORIAL_NOT_GIVEN_BOX: [number, number, number, number] = [429.0, 170.1, 444.8, 185.8];

const STRENGTHS_BOX = { x0: 52, y0: 230, x1: 538, y1: 335 };
const ACTION_PLAN_BOX = { x0: 52, y0: 394, x1: 538, y1: 625 };

const CANDIDATE_SIG_X = 181;
const CANDIDATE_DATE_X = 434;
const CANDIDATE_SIG_Y = 729.7;

const TUTOR_SIG_X = 156;
const TUTOR_DATE_X = 434;
const TUTOR_SIG_Y = 666.6;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function drawStage1Page(page: PDFPage, fonts: Celta5Fonts, data: Stage1PageData) {
  drawCheck(page, fonts.bold, data.tutorialGiven ? TUTORIAL_GIVEN_BOX : TUTORIAL_NOT_GIVEN_BOX);
  if (data.hoursTaught !== null) {
    const xMid = (HOURS_TAUGHT_BOX[0] + HOURS_TAUGHT_BOX[2]) / 2;
    const yMid = (HOURS_TAUGHT_BOX[1] + HOURS_TAUGHT_BOX[3]) / 2;
    drawAt(page, fonts.regular, String(data.hoursTaught), 0, yMid + 4, 11, { align: "center", xMid });
  }

  if (data.strengths) drawWrapped(page, fonts.regular, [data.strengths], STRENGTHS_BOX);
  if (data.actionPlan) drawWrapped(page, fonts.regular, [data.actionPlan], ACTION_PLAN_BOX);

  if (data.tutorSignatureName && data.tutorSignedAt) {
    drawSignature(page, fonts.regular, data.tutorSignatureName, TUTOR_SIG_X, TUTOR_SIG_Y, TUTOR_DATE_X - TUTOR_SIG_X - 10);
    drawAt(page, fonts.regular, formatDate(data.tutorSignedAt), TUTOR_DATE_X, TUTOR_SIG_Y);
  }
  if (data.candidateSignatureName && data.candidateSignedAt) {
    drawSignature(page, fonts.regular, data.candidateSignatureName, CANDIDATE_SIG_X, CANDIDATE_SIG_Y, CANDIDATE_DATE_X - CANDIDATE_SIG_X - 10);
    drawAt(page, fonts.regular, formatDate(data.candidateSignedAt), CANDIDATE_DATE_X, CANDIDATE_SIG_Y);
  }
}
