import type { Database } from "@/lib/supabase/types";
import { computeSignatureLedger, isBookletExportReady } from "@/lib/celta5-signatures";

type Celta5Record = Database["public"]["Tables"]["celta5_records"]["Row"];
type Assignment = Database["public"]["Tables"]["assignments"]["Row"];

// "Before this grade can be released", from Ramy's own Grades Report design
// file rather than my guess at it.
//
// I mocked this panel once with the wrong four items -- whether the paperwork
// was signed -- and he cut it: "I'm not sure what that is." His file's own
// four are a different and better question, about whether the CANDIDATE has
// met the course requirements:
//
//   6 hours assessed teaching at two levels
//   Four assignments resolved
//   CELTA 5 signatures complete
//   Assessor visit recorded
//
// Every one is Handbook-grounded. Six hours at two levels is the assessed
// teaching requirement; four assignments is 11.6; the CELTA 5 signatures are
// 12.1.3's "all records have been completed and signed"; the visit is 13.1.
//
// Nothing here gates the release action -- releaseAllFinalReports has its own
// checks and keeps them. This tells a tutor what is outstanding before they
// press it, which is what the panel is for.

export interface ReleaseCheck {
  label: string;
  state: string;
  met: boolean;
}

export function buildReleaseChecklist(input: {
  record: Celta5Record | null;
  /** A paired provisional -- Fail/Pass, Pass/Pass B, Pass B/Pass A. */
  wasSlashed?: boolean;
  assignments: Assignment[];
  hoursAssessed: number;
  levels: string[];
  assessorVisitDate: string | null;
}): ReleaseCheck[] {
  const { record, assignments, hoursAssessed, levels, assessorVisitDate, wasSlashed } = input;

  // Handbook 9: six hours of assessed teaching, and 10.1's "at least two
  // levels" -- both halves matter, so a candidate with six hours at one level
  // has not met it and the state says which half is missing.
  const hoursMet = hoursAssessed >= 6;
  const levelsMet = levels.length >= 2;
  const teaching: ReleaseCheck = {
    label: "6 hours assessed teaching at two levels",
    met: hoursMet && levelsMet,
    state:
      hoursMet && levelsMet
        ? "Met"
        : !hoursMet && !levelsMet
          ? `${hoursAssessed.toFixed(1)} hrs, ${levels.length === 1 ? "one level" : "no level recorded"}`
          : !hoursMet
            ? `${hoursAssessed.toFixed(1)} of 6 hrs`
            : `${levels.length === 1 ? "one level only" : "no level recorded"}`,
  };

  const unresolved = assignments.filter((a) => {
    const resubRound = a.first_status === "resubmission_required" || a.resubmission_status !== "not_submitted";
    return (resubRound ? a.resubmission_status : a.first_status) !== "approved";
  });
  const assignmentsCheck: ReleaseCheck = {
    label: "Four assignments resolved",
    met: assignments.length >= 4 && unresolved.length === 0,
    state:
      assignments.length === 0
        ? "None submitted"
        : unresolved.length > 0
          ? `${unresolved.length} unresolved`
          : assignments.length < 4
            ? `${assignments.length} of 4 submitted`
            : "Met",
  };

  const ledger = record ? computeSignatureLedger(record, assignments) : [];
  const outstandingSignatures = ledger.filter((r) => r.state !== "signed").length;
  const signatures: ReleaseCheck = {
    label: "CELTA 5 signatures complete",
    met: Boolean(record) && isBookletExportReady(ledger),
    state: !record
      ? "No record"
      : isBookletExportReady(ledger)
        ? "Met"
        : `${outstandingSignatures} outstanding`,
  };

  // Course-level, not per candidate, but it belongs on this list: without a
  // visit there is no moderation, and without moderation no final grade
  // should leave the centre.
  const visit: ReleaseCheck = {
    label: "Assessor visit recorded",
    met: Boolean(assessorVisitDate),
    state: assessorVisitDate
      ? new Date(`${assessorVisitDate}T00:00:00Z`).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          timeZone: "UTC",
        })
      : "Not set",
  };

  // Ramy, 30 Aug 2026: "some assessors don't really ask for a justification
  // for the straight passes... just not enforced. What's enforced is the
  // slash." So this line only appears for a slashed candidate. On a straight
  // grade the rationale is still offered on the page and still welcome -- it
  // is simply not something the centre is held to.
  // Points at final_higher_grade_evidence, not overall_notes. Handbook 15.2:
  // the evidence field "is optional but should be completed for any
  // candidates that were borderline (e.g., Pass/Fail, Pass/Pass B) so there
  // is a justification recorded for the final recommended grade." That IS
  // the rationale for a borderline candidate, and it is the box the Grade
  // form now shows -- checking a different column would report a gap the
  // tutor has no way to close from this page.
  const evidence = (record as { final_higher_grade_evidence?: string | null } | null)?.final_higher_grade_evidence;
  const rationale: ReleaseCheck | null = wasSlashed
    ? {
        label: "Justification for the borderline grade",
        met: Boolean(evidence?.trim()),
        state: evidence?.trim() ? "Met" : "Required",
      }
    : null;

  return rationale
    ? [teaching, assignmentsCheck, signatures, rationale, visit]
    : [teaching, assignmentsCheck, signatures, visit];
}
