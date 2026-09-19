// "As of today" for a record that may run ahead of the calendar.
//
// The demo course is written by a record clock (project_demo_clock): the
// whole course exists at once, and a viewer reads it at ?day=N. A real
// course never has a submission, a mark or a lesson dated after today, so
// these guards cost it nothing -- and on the demo they keep day 15 from
// reading "All your TPs are taught" and "Submitted 22 Sept" (Ramy, 20 Sep
// 2026, after the tutor side got the same treatment).

/** True when the stamp exists and falls on or before the course-local day. */
export function onOrBefore(stamp: string | null | undefined, today: string): boolean {
  return Boolean(stamp) && (stamp as string).slice(0, 10) <= today;
}

/** The stamp itself when it is on or before today; otherwise null. */
export function asOf<T extends string | null | undefined>(stamp: T, today: string): T | null {
  return onOrBefore(stamp, today) ? stamp : null;
}

type Round = "first" | "resubmission";

/**
 * An assignment row as it stood at the end of `today`: a round submitted
 * after today reads as not submitted; a round marked after today reads as
 * still under review. Every reader of assignment state on the candidate's
 * side goes through this, so the list, the detail page, the rail, Catch up
 * and the CELTA 5 overview cannot disagree.
 */
export function assignmentAsOf<
  A extends {
    first_status: string;
    first_submitted_at: string | null;
    resubmission_status: string;
    resubmission_submitted_at: string | null;
  } & Partial<Record<string, unknown>>,
>(a: A, today: string): A {
  const out: Record<string, unknown> = { ...a };
  const clearRound = (round: Round, unsubmitted: boolean) => {
    out[`${round}_status`] = unsubmitted ? "not_submitted" : "submitted";
    if (unsubmitted) {
      out[`${round}_submitted_at`] = null;
      out[`${round}_submission_url`] = null;
      out[`${round}_own_work_confirmed`] = false;
    }
    for (const k of ["overall_comment", "criteria_marks", "outcome_signed_at", "outcome_signature_name", "marks_saved_at", "content_grade", "english_grade"]) {
      if (`${round}_${k}` in out) out[`${round}_${k}`] = null;
    }
    if (round === "resubmission" && "resubmission_outcome" in out) out.resubmission_outcome = null;
    if ("final_grade" in out) out.final_grade = null;
  };
  const firstMarked = a.first_status === "approved" || a.first_status === "resubmission_required";
  const firstMarkStamp = (a.first_outcome_signed_at as string | null | undefined) ?? (a.first_marks_saved_at as string | null | undefined) ?? null;
  if (a.first_submitted_at && !onOrBefore(a.first_submitted_at, today)) {
    clearRound("first", true);
    clearRound("resubmission", true);
    return out as A;
  }
  if (firstMarked && firstMarkStamp && !onOrBefore(firstMarkStamp, today)) {
    clearRound("first", false);
    clearRound("resubmission", true);
    return out as A;
  }
  const resubMarkStamp = (a.resubmission_outcome_signed_at as string | null | undefined) ?? (a.resubmission_marks_saved_at as string | null | undefined) ?? null;
  if (a.resubmission_submitted_at && !onOrBefore(a.resubmission_submitted_at, today)) {
    clearRound("resubmission", true);
  } else if (a.resubmission_status === "approved" && resubMarkStamp && !onOrBefore(resubMarkStamp, today)) {
    clearRound("resubmission", false);
  }
  return out as A;
}
