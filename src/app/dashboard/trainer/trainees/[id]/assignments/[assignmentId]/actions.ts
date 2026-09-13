"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { ASSIGNMENT_INFO } from "@/lib/assignment-info";
import { getAssignmentCriteria } from "@/lib/assignment-criteria";
import { derivedOutcome, needsSecondMark } from "@/lib/assignment-board";
import type { Database } from "@/lib/supabase/types";

export interface FormState {
  error: string | null;
}

type SectionResponseInsert = Database["public"]["Tables"]["assignment_section_responses"]["Insert"];

interface SectionCommentPayload {
  key: string;
  title: string;
  comment: string;
}

// Each section's comment is its own named field (comment_<key>), not a
// combined JSON blob -- TrainerFeedbackTextarea's AI tone-cleanup buttons
// write straight to the DOM node, which only round-trips correctly for an
// uncontrolled field read via FormData at submit time.
function parseComments(formData: FormData): SectionCommentPayload[] {
  const raw = formData.get("section_keys");
  if (typeof raw !== "string" || !raw) return [];
  let keys: { key: string; title: string }[];
  try {
    keys = JSON.parse(raw);
  } catch {
    return [];
  }
  return keys.map(({ key, title }) => ({
    key,
    title,
    comment: (formData.get(`comment_${key}`) as string | null) ?? "",
  }));
}

function parseCriteriaMarks(formData: FormData): Record<string, boolean> {
  const raw = formData.get("criteria_marks");
  if (typeof raw !== "string" || !raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveComments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  assignmentId: string,
  round: string,
  comments: SectionCommentPayload[]
): Promise<string | null> {
  const isResubmission = round === "resubmission";
  for (const c of comments) {
    const row: SectionResponseInsert = {
      assignment_id: assignmentId,
      section_key: c.key,
      section_title: c.title,
      first_comments: isResubmission ? undefined : c.comment,
      resubmission_comments: isResubmission ? c.comment : undefined,
    };
    const { error } = await supabase
      .from("assignment_section_responses")
      .upsert(row, { onConflict: "assignment_id,section_key" });
    if (error) return "Could not save the comments. Try again.";
  }
  return null;
}

async function returnAssignment(
  formData: FormData,
  decision: "pass" | "resubmission_required" | "fail"
): Promise<FormState> {
  const marker = await requireRole("trainer");
  const assignmentId = formData.get("assignment_id");
  const round = formData.get("round");
  const secondMarkerId = formData.get("second_marker_id");
  if (typeof assignmentId !== "string" || typeof round !== "string") {
    return { error: "Invalid request." };
  }

  const isResubmission = round === "resubmission";
  const supabase = await createClient();

  // build-spec.md "Assignment 5": "One chance, pass or fail, as with the
  // resubmission it accompanies" -- a Plagiarism Reflection never gets a
  // resubmission round of its own, so a fail is final on the first round
  // for this type only.
  const { data: assignmentRow } = await supabase
    .from("assignments")
    .select("assignment_type, trainee_id, course_id")
    .eq("id", assignmentId)
    .maybeSingle();
  const isOneChanceReflection = assignmentRow?.assignment_type === "Plagiarism Reflection";

  if (decision === "resubmission_required" && isOneChanceReflection) {
    return { error: "A Plagiarism Reflection has one chance only -- pass or fail, no resubmission." };
  }
  if (decision === "fail" && !isResubmission && !isOneChanceReflection) {
    return { error: "A fail can only be recorded on the resubmission round." };
  }
  if (isResubmission && (typeof secondMarkerId !== "string" || !secondMarkerId)) {
    return { error: "Pick a second marker before returning a resubmission decision." };
  }

  const criteriaMarks = parseCriteriaMarks(formData);

  // Handbook June 2025 9.2.3: "To reach Pass standard, a candidate's work
  // must meet ALL the assessment criteria specified for the written
  // assignments." And 9.2.2: "When the candidate has to resubmit an
  // assignment, there should be clear feedback as to which areas need to be
  // addressed LINKED TO the Cambridge assessment criteria."
  //
  // The marking screen said both of those in a caption and enforced neither:
  // an unmarked criterion renders as "Not met", so the default state of the
  // panel was every criterion not met -- and "Return with a pass" would
  // still go through, printing a pass on a cover sheet whose criteria all
  // read Not met. Equally, a resubmission could be issued with nothing
  // marked not met, which is a rewrite request the candidate cannot link to
  // any criterion. Checked here rather than in the form because this is the
  // rule, not a convenience (13 Sep 2026).
  if (assignmentRow?.assignment_type) {
    const criteria = await getAssignmentCriteria(supabase, marker.center_id, assignmentRow.assignment_type);
    if (criteria.length > 0) {
      const unmet = criteria.filter((c) => criteriaMarks[c.key] !== true);
      if (decision === "pass" && unmet.length > 0) {
        return {
          error:
            unmet.length === criteria.length
              ? "Mark the assessment criteria before returning a pass -- a pass needs every criterion met (Handbook 9.2.3)."
              : `A pass needs every criterion met (Handbook 9.2.3). Still not met: ${unmet.map((c) => c.text).join("; ")}`,
        };
      }
      if (decision !== "pass" && unmet.length === 0) {
        return {
          error:
            "Mark at least one criterion Not met -- the candidate has to be told which criteria the work does not meet (Handbook 9.2.2).",
        };
      }
    }
  }

  // The overall comment is the one the candidate reads first, under "Before
  // you start". Handbook 9.2.2 asks for "appropriate" feedback before and
  // after submission and, on a resubmission, "clear feedback as to which
  // areas need to be addressed" -- a decision released with nothing written
  // is not that. Required on every release (tutor assignments handoff 2d).
  const overall = (formData.get("overall_comment") as string | null)?.trim() ?? "";
  if (!overall) {
    return { error: "Write the overall comment before releasing this -- it is the first thing the candidate reads." };
  }

  // Handbook 9.2.3: the double-marked sample "should include any fail
  // assignments", and blind double marking means "each tutor marking original
  // scripts independently before discussing and agreeing results". So a
  // fail-type outcome, and anything the centre picked into the sample, cannot
  // reach the candidate on one tutor's word: the second mark has to be
  // recorded and both tutors have to have initialled it.
  const { data: full } = await supabase.from("assignments").select("*").eq("id", assignmentId).maybeSingle();
  if (full && decision !== "pass") {
    if (needsSecondMark(full, true)) {
      if (!full.second_marks_recorded_at || full.second_mark_round !== round) {
        return {
          error:
            "This outcome needs a second marker first (Handbook 9.2.3). Send it for a blind second mark, then settle and initial together.",
        };
      }
      if (!full.first_initialled_at || !full.second_initialled_at) {
        return { error: "Both tutors initial a double-marked assignment before it is released (Handbook 9.2.3)." };
      }
    }
  } else if (full && decision === "pass" && full.in_double_marking_sample) {
    if (!full.second_marks_recorded_at || !full.first_initialled_at || !full.second_initialled_at) {
      return {
        error: "This one is in the double-marked sample -- it needs the second mark and both initials before release.",
      };
    }
  }

  const commentError = await saveComments(supabase, assignmentId, round, parseComments(formData));
  if (commentError) return { error: commentError };
  const status = decision === "resubmission_required" ? "resubmission_required" : "approved";
  // Handbook 9.2.3: the grade recorded on the record of written work is
  // "Pass", or on resubmission "Pass (on resubmission)" or "Fail". This was a
  // free-text "final grade note" until 12 Sep 2026 -- a box that could hold
  // "Pass B" on a component that has no B. The wording is Cambridge's, so
  // it is written, not typed.
  const grade = decision === "pass" ? (isResubmission ? "Pass (on resubmission)" : "Pass") : undefined;

  // A Plagiarism Reflection's fail is final on the first round -- the
  // schema only has a distinct pass/fail outcome field on the
  // resubmission side (resubmission_outcome), so a first-round fail for
  // this type reuses it rather than a first_status value that doesn't
  // exist ('approved' alone would read as a pass everywhere else in the
  // app that shows ASSIGNMENT_STATUS_LABEL.approved = "Pass").
  const reflectionFirstRoundFail = isOneChanceReflection && !isResubmission && decision === "fail";

  const update: Database["public"]["Tables"]["assignments"]["Update"] = {
    marker_id: marker.id,
    first_overall_comment: isResubmission ? undefined : overall,
    resubmission_overall_comment: isResubmission ? overall : undefined,
    first_status: isResubmission ? undefined : status,
    first_criteria_marks: isResubmission ? undefined : criteriaMarks,
    resubmission_status: isResubmission ? status : undefined,
    resubmission_criteria_marks: isResubmission ? criteriaMarks : undefined,
    resubmission_outcome: isResubmission ? (decision === "fail" ? "fail" : "pass") : reflectionFirstRoundFail ? "fail" : undefined,
    second_marker_id: isResubmission ? (secondMarkerId as string) : undefined,
    second_marker_recorded_at: isResubmission ? new Date().toISOString() : undefined,
    // A fail is written, not inferred.
    //
    // final_grade used to be set only on a pass, so a failed assignment kept
    // final_grade = null forever and the Fail column on CELTA 5 page 14 --
    // Pass 1st / Pass 2nd / Fail -- could never be ticked. Every reader had
    // to infer the fail from the ABSENCE of a pass, and one export that
    // forgot the rule would silently print a blank where a fail belongs.
    // Ramy, 31 Aug 2026, choosing this over deriving it: "right fail for the
    // assignments... one fail, they cannot get an A. Two fail assignments,
    // they fail."
    //
    // Which decisions are final fails: a fail on a RESUBMISSION (the second
    // and last chance), and a first-round fail of the Plagiarism Reflection,
    // which gets only one chance by design. A first-round
    // "resubmission_required" is NOT a fail -- it is the candidate's second
    // chance being issued, and writing Fail there would condemn work that
    // may well pass.
    final_grade: grade ?? (isResubmission && decision === "fail" ? "Fail" : reflectionFirstRoundFail ? "Fail" : undefined),
  };

  const { error } = await supabase.from("assignments").update(update).eq("id", assignmentId);
  if (error) {
    // The message above is what the person reads; this is what we read.
    console.error("[dashboard/trainer/trainees/[id]/assignments/[assignmentId]:action]", error);
    return { error: "Could not update the assignment. Try again." };
  }

  // for-claude-code-announcements-list.md table B (system-event, personal
  // scope): "an assignment is marked / feedback returned -> the one
  // candidate." Fires immediately, not scheduled -- there's no timetable
  // anchor for "whenever a trainer happens to finish marking."
  if (assignmentRow?.trainee_id && assignmentRow.course_id) {
    const label = assignmentRow.assignment_type ? ASSIGNMENT_INFO[assignmentRow.assignment_type]?.title : null;
    const title =
      status === "resubmission_required"
        ? `${label ?? "An assignment"} needs resubmission`
        : `${label ?? "An assignment"} feedback is ready`;
    await supabase.from("course_broadcasts").insert({
      course_id: assignmentRow.course_id,
      author_id: marker.id,
      title,
      body:
        status === "resubmission_required"
          ? "Check the brief for what to revise before resubmitting."
          : "Open your Written Assignments tab to see the full feedback.",
      visible_to_trainee_id: assignmentRow.trainee_id,
      sent_at: new Date().toISOString(),
    });
  }

  revalidatePath(`/dashboard/trainer/trainees`);
  revalidatePath(`/portfolio/[traineeId]`, "layout");
  return { error: null };
}

export async function returnWithPass(_prevState: FormState, formData: FormData): Promise<FormState> {
  return returnAssignment(formData, "pass");
}

export async function returnForResubmission(_prevState: FormState, formData: FormData): Promise<FormState> {
  return returnAssignment(formData, "resubmission_required");
}

export async function returnAsFail(_prevState: FormState, formData: FormData): Promise<FormState> {
  return returnAssignment(formData, "fail");
}

export async function updateAssignmentDueDate(formData: FormData): Promise<void> {
  await requireRole("trainer");
  const assignmentId = formData.get("assignment_id");
  const dueDate = formData.get("due_date");
  if (typeof assignmentId !== "string") return;

  const supabase = await createClient();
  await supabase
    .from("assignments")
    .update({ due_date: typeof dueDate === "string" && dueDate ? dueDate : null })
    .eq("id", assignmentId);

  revalidatePath(`/dashboard/trainer/trainees`);
}

// Handbook 9.2.3 -- the second tutor's initial on a double-marked assignment.
// Recorded by the second marker THEMSELVES (not named by the first marker),
// on any round that has a decision: that is the footprint the assessor's
// record needs. The resubmission dropdown in returnAssignment stays -- a
// resubmission decision is not returned without a second marker at all.
export async function recordSecondMarking(formData: FormData): Promise<void> {
  const viewer = await requireRole("trainer");
  const assignmentId = formData.get("assignment_id");
  const traineeId = formData.get("trainee_id");
  if (typeof assignmentId !== "string") return;

  const supabase = await createClient();
  const { data: a } = await supabase
    .from("assignments")
    .select("marker_id, first_status, resubmission_status, second_marker_id")
    .eq("id", assignmentId)
    .maybeSingle();
  if (!a) return;
  // "A minimum of two tutors should be involved" -- the first marker cannot
  // be their own second marker, and a recorded second marking is not
  // overwritten by a third person clicking.
  if (a.marker_id === viewer.id) return;
  if (a.second_marker_id) return;
  const decided =
    a.first_status === "approved" ||
    a.first_status === "resubmission_required" ||
    a.resubmission_status === "approved";
  if (!decided) return;

  await supabase
    .from("assignments")
    .update({ second_marker_id: viewer.id, second_marker_recorded_at: new Date().toISOString() })
    .eq("id", assignmentId);

  revalidatePath(`/dashboard/trainer/trainees`);
  if (typeof traineeId === "string") revalidatePath(`/portfolio/${traineeId}/assignments/${assignmentId}`);
  revalidatePath(`/trainer`);
  revalidatePath(`/assessor`);
}

// ---------------------------------------------------------------------------
// design_handoff_tutor_assignments §2h -- the marking cycle before release.
//
// Marking used to BE releasing: one button wrote the decision and the
// candidate had it. The Handbook's double marking needs three steps in
// between -- draft, a blind second mark, settle and initial -- and none of
// them existed. Migration 0299 holds them; these write them.
//
// Nothing here touches first_status/resubmission_status. Release is still the
// moment the status moves, and that is still returnAssignment above.

/** Marks and comments written, nothing sent. */
export async function saveMarkingDraft(_prevState: FormState, formData: FormData): Promise<FormState> {
  const marker = await requireRole("trainer");
  const assignmentId = formData.get("assignment_id");
  const round = formData.get("round");
  if (typeof assignmentId !== "string" || (round !== "first" && round !== "resubmission")) {
    return { error: "Invalid request." };
  }
  const supabase = await createClient();
  const commentError = await saveComments(supabase, assignmentId, round, parseComments(formData));
  if (commentError) return { error: commentError };

  const overall = (formData.get("overall_comment") as string | null) ?? "";
  const marks = parseCriteriaMarks(formData);
  const now = new Date().toISOString();
  const isResub = round === "resubmission";
  const { error } = await supabase
    .from("assignments")
    .update({
      marker_id: marker.id,
      first_criteria_marks: isResub ? undefined : marks,
      resubmission_criteria_marks: isResub ? marks : undefined,
      first_overall_comment: isResub ? undefined : overall,
      resubmission_overall_comment: isResub ? overall : undefined,
      first_marks_saved_at: isResub ? undefined : now,
      resubmission_marks_saved_at: isResub ? now : undefined,
    })
    .eq("id", assignmentId);
  if (error) {
    console.error("[assignments:saveMarkingDraft]", error);
    return { error: "Could not save your marks. Try again." };
  }
  revalidatePath(`/portfolio/[traineeId]`, "layout");
  revalidatePath("/trainer/assignments");
  return { error: null };
}

/** Hands the script to another tutor for an independent read. */
export async function sendToSecondMarker(_prevState: FormState, formData: FormData): Promise<FormState> {
  const marker = await requireRole("trainer");
  const assignmentId = formData.get("assignment_id");
  const secondMarkerId = formData.get("second_marker_id");
  if (typeof assignmentId !== "string" || typeof secondMarkerId !== "string" || !secondMarkerId) {
    return { error: "Pick the tutor who will second-mark it." };
  }
  if (secondMarkerId === marker.id) {
    return { error: "A second mark has to be someone else's -- that is what makes it a second mark." };
  }
  const draft = await saveMarkingDraft(_prevState, formData);
  if (draft.error) return draft;

  const supabase = await createClient();
  const { error } = await supabase
    .from("assignments")
    .update({ second_marker_id: secondMarkerId, in_double_marking_sample: true })
    .eq("id", assignmentId);
  if (error) {
    console.error("[assignments:sendToSecondMarker]", error);
    return { error: "Could not send it on. Try again." };
  }
  revalidatePath("/trainer/assignments");
  return { error: null };
}

/**
 * The blind second mark: the second tutor's own reading, recorded before
 * either of them can see the other's. Only the named second marker may.
 */
export async function recordBlindSecondMark(_prevState: FormState, formData: FormData): Promise<FormState> {
  const marker = await requireRole("trainer");
  const assignmentId = formData.get("assignment_id");
  const round = formData.get("round");
  if (typeof assignmentId !== "string" || (round !== "first" && round !== "resubmission")) {
    return { error: "Invalid request." };
  }
  const supabase = await createClient();
  const { data: row } = await supabase.from("assignments").select("second_marker_id, marker_id").eq("id", assignmentId).maybeSingle();
  if (!row) return { error: "Assignment not found." };
  if (row.second_marker_id !== marker.id) {
    return { error: "Only the tutor this was sent to can record the second mark." };
  }
  if (row.marker_id === marker.id) {
    return { error: "You marked this first -- a second mark has to be another tutor's." };
  }
  const { error } = await supabase
    .from("assignments")
    .update({
      second_criteria_marks: parseCriteriaMarks(formData),
      second_overall_comment: (formData.get("overall_comment") as string | null) ?? "",
      second_marks_recorded_at: new Date().toISOString(),
      second_mark_round: round,
    })
    .eq("id", assignmentId);
  if (error) {
    console.error("[assignments:recordBlindSecondMark]", error);
    return { error: "Could not record your second mark. Try again." };
  }
  revalidatePath(`/portfolio/[traineeId]`, "layout");
  revalidatePath("/trainer/assignments");
  return { error: null };
}

/**
 * Settle and initial. The agreed marks are what the candidate receives; each
 * tutor initials as themselves, and the record carries both names and dates
 * -- "assignments that have been double-marked should be initialled by both
 * tutors" (9.2.3).
 */
export async function settleAndInitial(_prevState: FormState, formData: FormData): Promise<FormState> {
  const marker = await requireRole("trainer");
  const assignmentId = formData.get("assignment_id");
  if (typeof assignmentId !== "string") return { error: "Invalid request." };

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("assignments")
    .select("marker_id, second_marker_id, second_marks_recorded_at")
    .eq("id", assignmentId)
    .maybeSingle();
  if (!row) return { error: "Assignment not found." };
  if (!row.second_marks_recorded_at) return { error: "There is no second mark to settle yet." };
  const isFirst = row.marker_id === marker.id;
  const isSecond = row.second_marker_id === marker.id;
  if (!isFirst && !isSecond) return { error: "Only the two markers initial this." };

  const now = new Date().toISOString();
  const update: Database["public"]["Tables"]["assignments"]["Update"] = {
    agreed_criteria_marks: parseCriteriaMarks(formData),
  };
  if (isFirst) update.first_initialled_at = now;
  if (isSecond) update.second_initialled_at = now;
  // One timestamp for the countersign record the rest of the app already
  // reads, set the moment the second tutor puts their initials on it.
  if (isSecond) update.second_marker_recorded_at = now;

  const { error } = await supabase.from("assignments").update(update).eq("id", assignmentId);
  if (error) {
    console.error("[assignments:settleAndInitial]", error);
    return { error: "Could not record your initials. Try again." };
  }
  revalidatePath(`/portfolio/[traineeId]`, "layout");
  revalidatePath("/trainer/assignments");
  return { error: null };
}

/**
 * Back to the candidate without a decision -- a wrong file, a missing
 * appendix, a declaration problem. Not for the quality of the work. Nothing
 * marked is sent, and the one resubmission is not spent.
 */
export async function returnUnmarked(_prevState: FormState, formData: FormData): Promise<FormState> {
  const marker = await requireRole("trainer");
  const assignmentId = formData.get("assignment_id");
  const round = formData.get("round");
  const reason = (formData.get("reason") as string | null)?.trim() ?? "";
  if (typeof assignmentId !== "string" || (round !== "first" && round !== "resubmission")) {
    return { error: "Invalid request." };
  }
  if (!reason) return { error: "Say why it is going back -- the candidate has to know what to fix." };

  const supabase = await createClient();
  const { error: logError } = await supabase
    .from("assignment_returns")
    .insert({ assignment_id: assignmentId, round, returned_by: marker.id, reason });
  if (logError) {
    console.error("[assignments:returnUnmarked]", logError);
    return { error: "Could not send it back. Try again." };
  }

  // The round goes back to not_submitted so the candidate can edit and hand
  // it in again. Nothing else is touched: no criteria marks, no decision, and
  // on a first round the resubmission is untouched and unspent.
  const isResub = round === "resubmission";
  const { error } = await supabase
    .from("assignments")
    .update(
      isResub
        ? { resubmission_status: "not_submitted", resubmission_submitted_at: null, resubmission_own_work_confirmed: false }
        : { first_status: "not_submitted", first_submitted_at: null, first_own_work_confirmed: false }
    )
    .eq("id", assignmentId);
  if (error) {
    console.error("[assignments:returnUnmarked]", error);
    return { error: "Could not send it back. Try again." };
  }

  const { data: a } = await supabase.from("assignments").select("course_id, trainee_id, assignment_type").eq("id", assignmentId).maybeSingle();
  if (a?.course_id && a.trainee_id) {
    await supabase.from("course_broadcasts").insert({
      course_id: a.course_id,
      author_id: marker.id,
      title: `${ASSIGNMENT_INFO[a.assignment_type]?.title ?? "An assignment"} came back unmarked`,
      body: `${reason} — this does not use up your resubmission.`,
      visible_to_trainee_id: a.trainee_id,
      sent_at: new Date().toISOString(),
    });
  }

  revalidatePath(`/portfolio/[traineeId]`, "layout");
  revalidatePath("/trainer/assignments");
  return { error: null };
}
