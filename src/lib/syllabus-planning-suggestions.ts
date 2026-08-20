import { AIM_TYPES, type AimType } from "@/lib/aim-type";

// connect-spec-corrections-for-claude-code.md item 13: advisory-only
// suggestions for a trainee's still-unpicked TP7/TP8 slot(s), never
// enforced -- the trainee can still submit anything the MCT's own
// constraint (allowedByTp) permits.

const SECOND_HALF_TP_NUMBERS = [4, 5, 6];

export interface Tp16Record {
  tpNumber: number;
  aimType: AimType | null;
  grade: "above_standard" | "to_standard" | "not_to_standard" | null;
}

export interface Tp78Entry {
  tpNumber: 7 | 8;
  /** Already picked, or null if this slot is still unpicked. */
  aimType: AimType | null;
}

export interface SyllabusSuggestion {
  tpNumber: 7 | 8;
  aimType: AimType;
  reason: "remediation" | "coverage";
}

/**
 * Coverage suggestion: by TP7/8, propose a main-aim type the trainee
 * hasn't yet taught as their main focus anywhere in TP1-6.
 * Remediation suggestion: if a TP4-6 lesson failed ("not_to_standard"),
 * propose that same aim type again -- TP7 preferred over TP8, since TP8 is
 * the true last chance. Remediation always wins over coverage for a given
 * slot when both could apply, per the spec's stated priority.
 * Both always constrained to whatever the MCT allows for that TP slot.
 */
export function computeSyllabusSuggestions(
  tp16: Tp16Record[],
  tp78: Tp78Entry[],
  allowedByTp: { 7: AimType[] | null; 8: AimType[] | null }
): SyllabusSuggestion[] {
  const taughtTypes = new Set(tp16.map((r) => r.aimType).filter((t): t is AimType => Boolean(t)));

  const remediationQueue: AimType[] = [];
  for (const r of [...tp16].sort((a, b) => a.tpNumber - b.tpNumber)) {
    if (
      SECOND_HALF_TP_NUMBERS.includes(r.tpNumber) &&
      r.grade === "not_to_standard" &&
      r.aimType &&
      !remediationQueue.includes(r.aimType)
    ) {
      remediationQueue.push(r.aimType);
    }
  }

  const remainingSlots = tp78
    .filter((e) => !e.aimType)
    .map((e) => e.tpNumber)
    .sort((a, b) => a - b);

  const suggestions: SyllabusSuggestion[] = [];

  for (const tpNumber of remainingSlots) {
    const allowed = allowedByTp[tpNumber];
    const withinConstraint = (t: AimType) => !allowed || allowed.length === 0 || allowed.includes(t);

    const remediationIndex = remediationQueue.findIndex(withinConstraint);
    if (remediationIndex !== -1) {
      suggestions.push({ tpNumber, aimType: remediationQueue[remediationIndex], reason: "remediation" });
      remediationQueue.splice(remediationIndex, 1);
      continue;
    }

    const coverageCandidate = AIM_TYPES.find((t) => !taughtTypes.has(t) && withinConstraint(t));
    if (coverageCandidate) {
      suggestions.push({ tpNumber, aimType: coverageCandidate, reason: "coverage" });
    }
  }

  return suggestions;
}
