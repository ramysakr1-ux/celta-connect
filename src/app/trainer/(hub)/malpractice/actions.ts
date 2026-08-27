"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { PLAGIARISM_REFLECTION_TYPE, PLAGIARISM_REFLECTION_SECTIONS } from "@/lib/assignment-templates/content";

export interface FormState {
  error: string | null;
  // Set by saveConcernNote on success -- the shared FormState shape has no
  // other way to distinguish "just mounted, never submitted" from
  // "submitted successfully" (both leave error null).
  saved?: boolean;
}

const CONCERN_KINDS = ["unattributed_source", "collaboration", "undeclared_ai", "other"] as const;
type ConcernKind = (typeof CONCERN_KINDS)[number];
function parseConcernKind(value: FormDataEntryValue | null): ConcernKind | null {
  return typeof value === "string" && (CONCERN_KINDS as readonly string[]).includes(value) ? (value as ConcernKind) : null;
}

// build-spec.md "Suspected plagiarism" -- opened either from a scanner
// finding or a tutor's own observation (finding_id is optional). Marking
// pauses immediately: no outcome is recorded while a case is open.
// Navigates to the new case's record page on success rather than
// returning state, since there's nowhere useful to stay once it's open.
//
// kind/findings are optional -- set when opened via the RaiseConcernForm
// intake (Malpractice.dc.html "1b Raising it"), left null when opened from
// a scanner finding (which already carries its own matched-passage
// context) or the old bare button.
export async function openCase(_prevState: FormState, formData: FormData): Promise<FormState> {
  const trainer = await requireRole("trainer");
  const assignmentId = formData.get("assignment_id");
  const round = formData.get("round");
  const findingId = formData.get("finding_id");
  const kind = formData.get("kind");
  const findings = formData.get("findings");
  if (typeof assignmentId !== "string" || (round !== "first" && round !== "resubmission")) {
    return { error: "Invalid request." };
  }

  const supabase = await createClient();
  const { data: assignment } = await supabase
    .from("assignments")
    .select("course_id, trainee_id, open_case_id")
    .eq("id", assignmentId)
    .maybeSingle();
  if (!assignment) return { error: "Assignment not found." };
  if (assignment.open_case_id) return { error: "A case is already open on this assignment." };

  const { data: newCase, error: caseError } = await supabase
    .from("malpractice_cases")
    .insert({
      course_id: assignment.course_id,
      trainee_id: assignment.trainee_id,
      assignment_id: assignmentId,
      assignment_round: round,
      opened_by: trainer.id,
      concern_kind: parseConcernKind(kind),
      initial_findings: typeof findings === "string" && findings.trim() ? findings.trim() : null,
    })
    .select("id")
    .single();
  if (caseError || !newCase) return { error: "Could not open the case. Try again." };

  const { error: pauseError } = await supabase
    .from("assignments")
    .update({ open_case_id: newCase.id })
    .eq("id", assignmentId);
  if (pauseError) return { error: "Case was opened but the assignment could not be paused. Refresh and check." };

  if (typeof findingId === "string" && findingId) {
    await supabase.from("plagiarism_scanner_findings").update({ case_id: newCase.id }).eq("id", findingId);
  }

  revalidatePath(`/portfolio/${assignment.trainee_id}/assignments/${assignmentId}`);
  redirect(`/trainer/malpractice/${newCase.id}`);
}

// "Their account is recorded, in their words" -- put to the candidate in
// person, then transcribed by the tutor. Required before a decision (see
// the DB constraint malpractice_cases_decide_needs_account).
export async function recordCandidateAccount(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requireRole("trainer");
  const caseId = formData.get("case_id");
  const account = formData.get("candidate_account");
  if (typeof caseId !== "string" || typeof account !== "string" || !account.trim()) {
    return { error: "Enter the candidate's account before saving." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("malpractice_cases")
    .update({ candidate_account: account.trim(), candidate_account_recorded_at: new Date().toISOString() })
    .eq("id", caseId)
    .eq("status", "open");
  if (error) return { error: "Could not save. Try again." };

  revalidatePath(`/trainer/malpractice/${caseId}`);
  return { error: null };
}

// for-claude-code-malpractice-outcomes.md: the outcome comes from the
// centre's own configured list (malpractice_outcome_options) when one
// exists, never a hardcoded pair -- Handbook 9.2.4. Falls back to the
// original binary upheld/not_upheld when a centre hasn't configured any
// outcomes yet. Either way, the only real effects beyond this table are
// driven by the resolved fails_assignment flag: fail the linked assignment
// through its one resubmission chance (or hard-fail if that chance is
// already spent) and create a Plagiarism Reflection assignment. An outcome
// that doesn't fail the assignment touches nothing else at all -- that
// asymmetry is deliberate, see the migration's own comment.
export async function decideCase(_prevState: FormState, formData: FormData): Promise<FormState> {
  const trainer = await requireRole("trainer");
  const caseId = formData.get("case_id");
  const outcomeOptionId = formData.get("outcome_option_id");
  const fallbackOutcome = formData.get("outcome");
  const notes = formData.get("decision_notes");
  if (typeof caseId !== "string") return { error: "Invalid request." };

  const supabase = await createClient();

  let label: string;
  let failsAssignment: boolean;
  let flaggedForReferral: boolean;
  let resolvedOptionId: string | null = null;

  if (typeof outcomeOptionId === "string" && outcomeOptionId) {
    const { data: option } = await supabase
      .from("malpractice_outcome_options")
      .select("id, label, fails_assignment, flagged_for_referral")
      .eq("id", outcomeOptionId)
      .eq("center_id", trainer.center_id)
      .maybeSingle();
    if (!option) return { error: "That outcome no longer exists. Refresh and pick again." };
    label = option.label;
    failsAssignment = option.fails_assignment;
    flaggedForReferral = option.flagged_for_referral;
    resolvedOptionId = option.id;
  } else if (fallbackOutcome === "upheld" || fallbackOutcome === "not_upheld") {
    label = fallbackOutcome === "upheld" ? "Upheld" : "Not upheld";
    failsAssignment = fallbackOutcome === "upheld";
    flaggedForReferral = false;
  } else {
    return { error: "Choose an outcome." };
  }

  const { data: openCaseRow } = await supabase
    .from("malpractice_cases")
    .select("*")
    .eq("id", caseId)
    .eq("status", "open")
    .maybeSingle();
  if (!openCaseRow) return { error: "This case is not open, or was not found." };
  if (!openCaseRow.candidate_account) {
    return { error: "Record the candidate's account before deciding the case." };
  }

  const decidedAt = new Date().toISOString();
  let reflectionAssignmentId: string | null = null;

  if (failsAssignment) {
    const { data: assignment } = await supabase
      .from("assignments")
      .select("first_status, resubmission_status")
      .eq("id", openCaseRow.assignment_id)
      .maybeSingle();
    if (!assignment) return { error: "The linked assignment could not be found." };

    // Fail the linked assignment through its normal one-chance mechanics --
    // resubmission_required if this was the first round (their one
    // chance), or a hard fail if it was already the resubmission (that
    // chance is spent). Same encoding returnAssignment() already uses.
    const assignmentUpdate =
      openCaseRow.assignment_round === "first"
        ? { first_status: "resubmission_required" as const, open_case_id: null }
        : { resubmission_status: "approved" as const, resubmission_outcome: "fail" as const, open_case_id: null };
    const { error: failError } = await supabase
      .from("assignments")
      .update(assignmentUpdate)
      .eq("id", openCaseRow.assignment_id);
    if (failError) return { error: "Could not update the linked assignment. Try again." };

    // Ensure this centre has the Plagiarism Reflection type + a published
    // system template for it (idempotent -- most cases after the first
    // reuse both). Reuses assignment_type_definitions (migration 0050),
    // which anticipated exactly this.
    await supabase
      .from("assignment_type_definitions")
      .upsert(
        { center_id: trainer.center_id, code: PLAGIARISM_REFLECTION_TYPE, title: "Plagiarism reflection", counts_toward_pass: false },
        { onConflict: "center_id,code" }
      );

    const { data: existingTemplate } = await supabase
      .from("assignment_templates")
      .select("id")
      .eq("center_id", trainer.center_id)
      .eq("assignment_type", PLAGIARISM_REFLECTION_TYPE)
      .maybeSingle();
    if (!existingTemplate) {
      await supabase.from("assignment_templates").insert({
        center_id: trainer.center_id,
        assignment_type: PLAGIARISM_REFLECTION_TYPE,
        storage_path: "system:plagiarism-reflection",
        sections: PLAGIARISM_REFLECTION_SECTIONS,
        // "prose" -- continuous personal narrative, not a structured
        // table-like brief. Matters beyond display: the scanner
        // (src/lib/plagiarism/scan.ts) derives its match threshold from
        // this field, and a personal account copied from somewhere else
        // is exactly the case worth catching sensitively here.
        format: "prose",
        generation_status: "completed",
        published_at: decidedAt,
      });
    }

    const { data: course } = await supabase.from("courses").select("end_date").eq("id", openCaseRow.course_id).maybeSingle();

    const { data: reflection, error: reflectionError } = await supabase
      .from("assignments")
      .insert({
        course_id: openCaseRow.course_id,
        trainee_id: openCaseRow.trainee_id,
        assignment_type: PLAGIARISM_REFLECTION_TYPE,
        due_date: course?.end_date ?? null,
        reflection_for_case_id: caseId,
      })
      .select("id")
      .single();
    if (reflectionError || !reflection) return { error: "Case was decided, but the reflection assignment could not be created." };
    reflectionAssignmentId = reflection.id;
  } else {
    // Doesn't fail the assignment -- clear the pause and touch nothing
    // else. This is the whole point: an outcome with no penalty must leave
    // no other trace.
    await supabase.from("assignments").update({ open_case_id: null }).eq("id", openCaseRow.assignment_id);
  }

  const { error: decideError } = await supabase
    .from("malpractice_cases")
    .update({
      status: "decided",
      outcome: label,
      outcome_option_id: resolvedOptionId,
      fails_assignment: failsAssignment,
      flagged_for_referral: flaggedForReferral,
      decision_notes: typeof notes === "string" ? notes.trim() || null : null,
      decided_by: trainer.id,
      decided_at: decidedAt,
      reflection_assignment_id: reflectionAssignmentId,
    })
    .eq("id", caseId);
  if (decideError) return { error: "Could not record the decision. Try again." };

  revalidatePath(`/trainer/malpractice/${caseId}`);
  revalidatePath(`/portfolio/${openCaseRow.trainee_id}/assignments/${openCaseRow.assignment_id}`);
  if (reflectionAssignmentId) revalidatePath(`/portfolio/${openCaseRow.trainee_id}/assignments/${reflectionAssignmentId}`);
  return { error: null };
}

// "A flag is not a case and creates no record against the candidate until
// a tutor opens one" -- reviewing without opening a case is a real, common
// outcome (a shared textbook definition), not a decision, so this just
// dismisses the band without touching anything else.
export async function markFindingReviewed(formData: FormData): Promise<void> {
  const trainer = await requireRole("trainer");
  const findingId = formData.get("finding_id");
  const assignmentId = formData.get("assignment_id");
  const traineeId = formData.get("trainee_id");
  if (typeof findingId !== "string") return;

  const supabase = await createClient();
  await supabase
    .from("plagiarism_scanner_findings")
    .update({ reviewed_at: new Date().toISOString(), reviewed_by: trainer.id })
    .eq("id", findingId);

  if (typeof traineeId === "string" && typeof assignmentId === "string") {
    revalidatePath(`/portfolio/${traineeId}/assignments/${assignmentId}`);
  }
}

// Malpractice.dc.html "1b Raising it": "Most concerns are nothing... The
// first button saves what was noticed against the assignment without
// opening anything." A genuinely separate, lighter-weight record from
// malpractice_cases -- see the migration's own comment for why. Touches
// nothing else: no pause, no candidate-visible change, no case.
export async function saveConcernNote(_prevState: FormState, formData: FormData): Promise<FormState> {
  const trainer = await requireRole("trainer");
  const assignmentId = formData.get("assignment_id");
  const round = formData.get("round");
  const kind = parseConcernKind(formData.get("kind"));
  const findings = formData.get("findings");
  if (typeof assignmentId !== "string" || (round !== "first" && round !== "resubmission") || !kind || typeof findings !== "string" || !findings.trim()) {
    return { error: "Choose a kind of concern and say what you found." };
  }

  const supabase = await createClient();
  const { data: assignment } = await supabase.from("assignments").select("course_id, trainee_id").eq("id", assignmentId).maybeSingle();
  if (!assignment) return { error: "Assignment not found." };

  const { error } = await supabase.from("malpractice_concern_notes").insert({
    course_id: assignment.course_id,
    trainee_id: assignment.trainee_id,
    assignment_id: assignmentId,
    assignment_round: round,
    kind,
    findings: findings.trim(),
    raised_by: trainer.id,
  });
  if (error) return { error: "Could not save the note. Try again." };

  revalidatePath(`/portfolio/${assignment.trainee_id}/assignments/${assignmentId}`);
  return { error: null, saved: true };
}
