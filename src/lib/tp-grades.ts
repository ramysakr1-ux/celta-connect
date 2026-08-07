import type { StandardRating } from "@/lib/supabase/types";

export interface TpGlyphSlot {
  tpNumber: number;
  grade: StandardRating | null;
}

const TP_COUNT = 8;

// Grades Report's TP1-8 row (cohort sheet + per-candidate header) -- both
// need the same fixed 8-slot array regardless of how many TPs a trainee has
// actually had graded so far, so a partial course still renders a stable
// row instead of a variable-length one.
export function mapTpFeedbackToGlyphRow(
  feedbackRows: { tp_number: number; grade: StandardRating | null; submitted_at: string | null }[]
): TpGlyphSlot[] {
  const byTpNumber = new Map(feedbackRows.filter((f) => f.submitted_at).map((f) => [f.tp_number, f.grade]));
  return Array.from({ length: TP_COUNT }, (_, i) => {
    const tpNumber = i + 1;
    return { tpNumber, grade: byTpNumber.get(tpNumber) ?? null };
  });
}
