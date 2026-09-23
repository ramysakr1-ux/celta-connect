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
  // Up here, not at the bottom: the round logic below returns early on three
  // separate paths, and a call after them runs on none of the ones that
  // matter. Every LRT row in the demo took an early return, so the first
  // version of this cleared nothing at all. It touches only the
  // second-marking stamps, which clearRound never writes, so the order
  // between them does not matter -- only that this always runs.
  clearFutureSecondMarking(out, a, today);
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
  // When the TUTOR marked it, which is first_marks_saved_at.
  //
  // This used to prefer first_outcome_signed_at, which is not a marking stamp
  // at all: it is the CANDIDATE's acknowledgement of the outcome -- the eighth
  // of the CELTA 5's eight signatures, signed in their own name, the morning
  // after the tutor released the work. Preferring it meant a marked assignment
  // read as "awaiting marking" until the candidate signed for it, to the
  // candidate AND to the tutor's board. On the demo that was 5 of the 6 LRTs
  // marked by day 18, while an announcement in the same page told the
  // candidate their feedback was ready (walk, 23 Sep 2026).
  //
  // Backwards, too: a candidate has to SEE the mark in order to sign it, so
  // gating the mark on the signature hides the thing the signature is for.
  // The signature is kept as a fallback for a row marked before
  // first_marks_saved_at existed.
  const firstMarkStamp = (a.first_marks_saved_at as string | null | undefined) ?? (a.first_outcome_signed_at as string | null | undefined) ?? null;
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
  // Same inversion, same fix, for the resubmission round.
  const resubMarkStamp = (a.resubmission_marks_saved_at as string | null | undefined) ?? (a.resubmission_outcome_signed_at as string | null | undefined) ?? null;
  if (a.resubmission_submitted_at && !onOrBefore(a.resubmission_submitted_at, today)) {
    clearRound("resubmission", true);
  } else if (a.resubmission_status === "approved" && resubMarkStamp && !onOrBefore(resubMarkStamp, today)) {
    clearRound("resubmission", false);
  }
  return out as A;
}

/**
 * Second marking, as of today.
 *
 * This belongs here rather than at a call site, and it is here BECAUSE it was
 * at a call site: /assessor/double-marking spread its own
 * `second_marker_recorded_at: asOf(...)` over the result of assignmentAsOf,
 * and the trainer's own Assignments board -- which calls assignmentAsOf and
 * nothing else -- did not. So on demo day 18 the board read "Language Related
 * Tasks 4 of 4 settled" from second marks stamped 24, 25 and 29 September, one
 * of them four days after the course ends, while Today's compliance banner
 * (which does filter on <= today) said "LRT 0/4" in the next room.
 *
 * `second_marker_id` is deliberately KEPT. It carries no stamp of its own, and
 * naming who will second-mark a script is not a claim that they have done it --
 * with the stamps cleared the sample reads "in progress", which is the truth on
 * the day.
 */
function clearFutureSecondMarking(
  out: Record<string, unknown>,
  a: Partial<Record<string, unknown>>,
  today: string,
): void {
  const recorded = a.second_marker_recorded_at as string | null | undefined;
  if (!recorded || onOrBefore(recorded, today)) return;
  for (const k of ["second_marker_recorded_at", "second_marks_recorded_at", "first_initialled_at", "second_initialled_at"]) {
    if (k in out) out[k] = null;
  }
}

/** A CELTA 5 record as of `today`: a provisional grade proposed or approved after today, and a
 *  grade form marked submitted after today, are not there yet. The --full seed writes the whole
 *  course at once; the grade form said "confirmed by the MCT" on day 15 for an approval dated
 *  day 17 (tutor walk, 20 Sep 2026). */
export function celta5AsOf<
  T extends {
    provisional_grade?: string | null;
    provisional_grade_upper?: string | null;
    provisional_upgrade_conditions?: string | null;
    provisional_proposed_by?: string | null;
    provisional_set_at?: string | null;
    provisional_approved_at?: string | null;
    provisional_approved_by?: string | null;
    grade_form_submitted_at?: string | null;
    grade_form_submitted_by?: string | null;
    grade_approval_form_submitted_at?: string | null;
    grade_approval_form_submitted_by?: string | null;
  },
>(r: T, today: string): T {
  const out = { ...r };
  if (out.provisional_set_at && !onOrBefore(out.provisional_set_at, today)) {
    out.provisional_grade = null;
    out.provisional_grade_upper = null;
    out.provisional_upgrade_conditions = null;
    out.provisional_proposed_by = null;
    out.provisional_set_at = null;
  }
  if (out.provisional_approved_at && !onOrBefore(out.provisional_approved_at, today)) {
    out.provisional_approved_at = null;
    out.provisional_approved_by = null;
  }
  if (out.grade_form_submitted_at && !onOrBefore(out.grade_form_submitted_at, today)) {
    out.grade_form_submitted_at = null;
    out.grade_form_submitted_by = null;
  }
  if (out.grade_approval_form_submitted_at && !onOrBefore(out.grade_approval_form_submitted_at, today)) {
    out.grade_approval_form_submitted_at = null;
    out.grade_approval_form_submitted_by = null;
  }
  return out;
}

