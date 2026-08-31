// Shared between the client picker (provisional-grade-form.tsx) and the
// server action (celta5-actions.ts) -- kept out of the "use server" file
// since only async functions survive as real exports there; a plain
// constant silently becomes a non-callable proxy in the client bundle.
export const PROVISIONAL_SLOTS = [
  "Fail",
  "Fail/Pass",
  "Pass",
  "Pass/Pass B",
  "Pass B",
  "Pass B/Pass A",
  "Pass A",
  "Withdrawn",
] as const;

/**
 * Which provisional grades a candidate's WRITTEN ASSIGNMENTS have ruled out.
 *
 * Cambridge's eligibility rules, already quoted verbatim in
 * celta-criteria.ts's `eligibility` array, but until now only ever SHOWN to
 * a tutor as prose. Ramy, 31 Aug 2026: "one fail, they cannot get an A. Two
 * fail assignments, they fail."
 *
 *   Fail more than one written assignment -> not eligible for a Pass at all.
 *   Fail exactly one -> a Pass may still be recommended if there is
 *     sufficient other evidence, but not Pass A.
 *
 * Enforceable only since fails started being recorded: final_grade used to
 * be written on a pass alone, so a failed assignment was indistinguishable
 * from an unmarked one and this function would have had nothing to read.
 *
 * Deliberately returns the blocked options and the reason rather than
 * choosing a grade. The rule caps what may be recommended; it never says
 * which grade IS right, and the second rule is explicit that a Pass "may
 * still be recommended if there is sufficient other evidence" -- that
 * judgement is the tutor's and the assessor's, not this function's.
 *
 * A borderline pair is blocked when its UPPER half is: "Pass B/Pass A" is a
 * recommendation that could land on Pass A, so one failed assignment rules
 * it out too.
 */
export function assignmentGradeCeiling(
  assignments: { final_grade?: string | null; resubmission_outcome?: string | null }[],
  /**
   * A recorded manual override (celta5_records.assignment_fail_override_reason,
   * migration 0262). Ramy, 31 Aug 2026: "everything should be potentially
   * subject to manual override" -- the grades meeting is where a case the
   * rules describe badly gets decided, and the assessor has the final say
   * anyway. The ceiling still reports the fail count, so the record shows
   * what was overridden rather than hiding it.
   */
  overrideReason?: string | null
): { failCount: number; blocked: string[]; reason: string | null; overridden: boolean } {
  const failCount = assignments.filter(
    (a) => a.final_grade?.toLowerCase() === "fail" || a.resubmission_outcome?.toLowerCase() === "fail"
  ).length;

  if (overrideReason && overrideReason.trim() !== "") {
    return {
      failCount,
      blocked: [],
      reason:
        failCount > 0
          ? `${failCount} failed written assignment${failCount === 1 ? "" : "s"} — ceiling overridden: ${overrideReason.trim()}`
          : null,
      overridden: true,
    };
  }

  if (failCount > 1) {
    return {
      failCount,
      // Withdrawn stays available: a missing portfolio is Withdrawn, not
      // Fail, and that is a different rule in the same list.
      blocked: PROVISIONAL_SLOTS.filter((o) => o !== "Fail" && o !== "Withdrawn"),
      reason: `${failCount} failed written assignments — not eligible for a Pass (Handbook eligibility).`,
      overridden: false,
    };
  }
  if (failCount === 1) {
    return {
      failCount,
      blocked: ["Pass A", "Pass B/Pass A"],
      reason: "One failed written assignment — a Pass may still be recommended, but not Pass A.",
      overridden: false,
    };
  }
  return { failCount: 0, blocked: [], reason: null, overridden: false };
}
