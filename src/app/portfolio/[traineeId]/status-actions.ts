"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/require-role";
import type {
  CarriedAssignmentSnapshot,
  DeferredAssignmentSnapshot,
  CarriedTpSnapshot,
  CarriedCelta5MatrixEntry,
  CarriedCelta5Record,
} from "@/lib/supabase/types";

export interface WithdrawFormState {
  error: string | null;
}

// specs/build-spec.md §3 "Withdrawal" -- formal and final, no reversal.
// Reportability is computed once, right now, from whether the course's
// entry_form_sent_at is already set -- not re-derived later, since setting
// that field afterward must never retroactively rewrite this candidate's
// history.
export async function withdrawTrainee(
  _prevState: WithdrawFormState,
  formData: FormData
): Promise<WithdrawFormState> {
  const staff = await requireRole(["trainer", "admin"]);
  const traineeId = formData.get("trainee_id");
  const note = ((formData.get("note") as string | null) ?? "").trim() || null;
  const requestId = (formData.get("request_id") as string | null) || null;
  if (typeof traineeId !== "string") {
    return { error: "Missing candidate." };
  }

  const supabase = await createClient();
  const { data: trainee } = await supabase
    .from("profiles")
    .select("id, course_id, role, course_status")
    .eq("id", traineeId)
    .maybeSingle();
  if (!trainee || trainee.role !== "trainee" || trainee.course_id !== staff.course_id) {
    return { error: "Candidate not found on your course." };
  }
  if (trainee.course_status !== "active") {
    return { error: "This candidate already has a course status set." };
  }

  const { data: course } = await supabase
    .from("courses")
    .select("entry_form_sent_at")
    .eq("id", trainee.course_id as string)
    .maybeSingle();

  const now = new Date().toISOString();
  // profiles RLS only lets a user update their own row (or an admin update
  // anyone in their center) -- a trainer withdrawing someone else's row
  // needs the admin client, same as removeRosterMember. Authorization is
  // already independently checked above (role + same course), so this
  // isn't bypassing anything, just reaching past a policy that has no
  // "trainer, but only this one field, on someone else's row" carve-out.
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({
      course_status: "withdrawn",
      course_status_set_at: now,
      course_status_set_by: staff.id,
      course_status_note: note,
      withdrawal_reportable: Boolean(course?.entry_form_sent_at),
      withdrawal_letter_generated_at: now,
    })
    .eq("id", traineeId);
  if (error) {
    return { error: "Could not withdraw this candidate. Try again." };
  }

  // Marks the candidate's own self-serve request (if this withdrawal
  // actioned one) as done -- best-effort, never blocks the withdrawal
  // itself on this row existing or updating cleanly.
  if (requestId) {
    await admin
      .from("withdrawal_requests")
      .update({ status: "actioned", actioned_by: staff.id, actioned_at: now })
      .eq("id", requestId)
      .eq("trainee_id", traineeId);
  }

  revalidatePath(`/portfolio/${traineeId}`);
  revalidatePath("/trainer/roster");
  return { error: null };
}

export interface RestartFormState {
  error: string | null;
}

// specs/build-spec.md §3 "First-half withdrawal with a restart... can
// transfer any successful assessment to the new course. Teaching starts
// again from TP1; passed assignments carry. This is not a deferral and
// must not reuse the deferral flow." Snapshots currently-passed assignments
// into restart_transfers now (see migration 0070) -- the destination course
// usually doesn't exist yet, so there's nothing to link to at this point,
// only something to freeze and wait with. "Plagiarism Reflection" is
// deliberately excluded: it's tied to a specific malpractice case on the
// old course and has no standalone meaning on a new one.
export async function markForRestart(
  _prevState: RestartFormState,
  formData: FormData
): Promise<RestartFormState> {
  const staff = await requireRole(["trainer", "admin"]);
  const traineeId = formData.get("trainee_id");
  const note = ((formData.get("note") as string | null) ?? "").trim() || null;
  if (typeof traineeId !== "string") {
    return { error: "Missing candidate." };
  }

  const supabase = await createClient();
  const { data: trainee } = await supabase
    .from("profiles")
    .select("id, course_id, center_id, role, course_status")
    .eq("id", traineeId)
    .maybeSingle();
  if (!trainee || trainee.role !== "trainee" || trainee.course_id !== staff.course_id) {
    return { error: "Candidate not found on your course." };
  }
  if (trainee.course_status !== "active") {
    return { error: "This candidate already has a course status set." };
  }

  const { data: assignments } = await supabase
    .from("assignments")
    .select(
      "id, assignment_type, first_status, first_content_grade, first_english_grade, first_submitted_at, resubmission_status, resubmission_content_grade, resubmission_english_grade, resubmission_submitted_at, marker_id, tutor_feedback"
    )
    .eq("trainee_id", traineeId);

  const carried: CarriedAssignmentSnapshot[] = (assignments ?? [])
    .filter((a) => a.assignment_type !== "Plagiarism Reflection")
    .filter((a) => a.first_status === "approved" || a.resubmission_status === "approved")
    .map((a) => {
      const passedOnResubmission = a.resubmission_status === "approved";
      return {
        assignment_type: a.assignment_type,
        content_grade: passedOnResubmission ? a.resubmission_content_grade : a.first_content_grade,
        english_grade: passedOnResubmission ? a.resubmission_english_grade : a.first_english_grade,
        marker_id: a.marker_id,
        tutor_feedback: a.tutor_feedback,
        submitted_at: passedOnResubmission ? a.resubmission_submitted_at : a.first_submitted_at,
        source_assignment_id: a.id,
      };
    });

  const admin = createAdminClient();
  const [{ error: transferError }, { error: statusError }] = await Promise.all([
    admin.from("restart_transfers").insert({
      center_id: trainee.center_id,
      source_trainee_id: traineeId,
      source_course_id: trainee.course_id as string,
      carried_assignments: carried,
      note,
      created_by: staff.id,
    }),
    admin
      .from("profiles")
      .update({
        course_status: "restarting",
        course_status_set_at: new Date().toISOString(),
        course_status_set_by: staff.id,
        course_status_note: note,
      })
      .eq("id", traineeId),
  ]);
  if (transferError || statusError) {
    return { error: "Could not record the restart. Try again." };
  }

  revalidatePath(`/portfolio/${traineeId}`);
  revalidatePath("/trainer/roster");
  return { error: null };
}

export interface DeferralFormState {
  error: string | null;
}

// specs/build-spec.md §3 "Deferral" + CELTA Admin Handbook June 2025 §7.9
// (real PDF re-read 2026-08-27; build-spec.md itself still cites the
// superseded 2022 §6.9 >50% threshold -- code follows the real document).
// Largest of the four leaving-course cases -- "everything freezes as it stands,
// complete or not" means the snapshot here is far richer than a restart's:
// full assignment state (not just passed ones -- a resubmission not yet
// returned must be able to continue), taught TPs (for numbering/hours
// credit on the destination course), CELTA5 criteria, and tutorial
// content. See CarriedCelta5Record's own comment for what's deliberately
// excluded (grade/signoff/reveal-gate fields) and why.
export async function markForDeferral(
  _prevState: DeferralFormState,
  formData: FormData
): Promise<DeferralFormState> {
  const staff = await requireRole(["trainer", "admin"]);
  const traineeId = formData.get("trainee_id");
  const reasons = ((formData.get("reasons") as string | null) ?? "").trim();
  const reintegrationArrangements = ((formData.get("reintegration_arrangements") as string | null) ?? "").trim() || null;
  const note = ((formData.get("note") as string | null) ?? "").trim() || null;
  const hoursCarriedRaw = formData.get("hours_carried");
  const hoursCarriedNote = ((formData.get("hours_carried_note") as string | null) ?? "").trim() || null;
  const reintegrationDeadline = (formData.get("reintegration_deadline") as string | null) || null;
  const requestId = (formData.get("request_id") as string | null) || null;
  const cambridgeConsulted = formData.get("cambridge_consulted") === "on";

  if (typeof traineeId !== "string") {
    return { error: "Missing candidate." };
  }
  if (!reasons) {
    return { error: "A reason for the deferral is required (kept on the Appian form)." };
  }
  // Admin Handbook June 2025 s7.9 dropped the 2022 edition's >50%-completed
  // threshold and replaced it with a genuinely new required step instead:
  // "centres... must consult Cambridge English through the process
  // described" before agreeing to a deferral -- not optional, so this is a
  // hard gate like the reasons field above, not a soft warning.
  if (!cambridgeConsulted) {
    return { error: "Confirm the centre has consulted Cambridge English before agreeing to this deferral." };
  }

  const supabase = await createClient();
  const { data: trainee } = await supabase
    .from("profiles")
    .select("id, course_id, center_id, role, course_status")
    .eq("id", traineeId)
    .maybeSingle();
  if (!trainee || trainee.role !== "trainee" || trainee.course_id !== staff.course_id) {
    return { error: "Candidate not found on your course." };
  }
  if (trainee.course_status !== "active") {
    return { error: "This candidate already has a course status set." };
  }

  const [{ data: record }, { data: matrix }, { data: assignments }, { data: taughtPlans }] = await Promise.all([
    supabase.from("celta5_records").select("*").eq("trainee_id", traineeId).maybeSingle(),
    supabase.from("celta5_matrix").select("criteria_code, tutor_status_stage2, tutor_status_stage3").eq("trainee_id", traineeId),
    supabase.from("assignments").select("*").eq("trainee_id", traineeId),
    supabase
      .from("plan_assignments")
      .select("tp_number, tp_point_id, main_lesson_aim, sub_aim, materials_description, procedure, page_references, density_tier, aim_type, taught_at")
      .eq("trainee_id", traineeId)
      .not("taught_at", "is", null),
  ]);

  const defaultHoursCarried = record?.hours_attended ?? 0;
  const hoursCarried = hoursCarriedRaw !== null && hoursCarriedRaw !== "" ? Number(hoursCarriedRaw) : defaultHoursCarried;
  const hoursCarriedOverridden = hoursCarried !== defaultHoursCarried;
  if (hoursCarriedOverridden && !hoursCarriedNote) {
    return { error: "A note is required when you change the carried hours from the default." };
  }

  const carriedAssignments: DeferredAssignmentSnapshot[] = (assignments ?? [])
    .filter((a) => a.assignment_type !== "Plagiarism Reflection")
    .map((a) => ({
      assignment_type: a.assignment_type,
      first_submission_url: a.first_submission_url,
      first_status: a.first_status,
      first_submitted_at: a.first_submitted_at,
      first_content_grade: a.first_content_grade,
      first_english_grade: a.first_english_grade,
      resubmission_url: a.resubmission_url,
      resubmission_status: a.resubmission_status,
      resubmission_submitted_at: a.resubmission_submitted_at,
      resubmission_content_grade: a.resubmission_content_grade,
      resubmission_english_grade: a.resubmission_english_grade,
      resubmission_outcome: a.resubmission_outcome,
      marker_id: a.marker_id,
      second_marker_id: a.second_marker_id,
      first_ai_declared: a.first_ai_declared,
      first_ai_conversation_url: a.first_ai_conversation_url,
      resubmission_ai_declared: a.resubmission_ai_declared,
      resubmission_ai_conversation_url: a.resubmission_ai_conversation_url,
      first_own_work_confirmed: a.first_own_work_confirmed,
      resubmission_own_work_confirmed: a.resubmission_own_work_confirmed,
      tutor_feedback: a.tutor_feedback,
      source_assignment_id: a.id,
    }));

  const carriedTps: CarriedTpSnapshot[] = (taughtPlans ?? []).map((p) => ({
    tp_number: p.tp_number,
    tp_point_id: p.tp_point_id,
    main_lesson_aim: p.main_lesson_aim,
    sub_aim: p.sub_aim,
    materials_description: p.materials_description,
    procedure: p.procedure,
    page_references: p.page_references,
    density_tier: p.density_tier,
    aim_type: p.aim_type,
    taught_at: p.taught_at,
  }));

  const carriedMatrix: CarriedCelta5MatrixEntry[] = (matrix ?? []).map((m) => ({
    criteria_code: m.criteria_code,
    tutor_status_stage2: m.tutor_status_stage2,
    tutor_status_stage3: m.tutor_status_stage3,
  }));

  const carriedRecord: CarriedCelta5Record | null = record
    ? {
        hours_attended: record.hours_attended,
        stage1_tutorial_given: record.stage1_tutorial_given,
        stage1_hours_taught: record.stage1_hours_taught,
        stage1_strengths: record.stage1_strengths,
        stage1_action_plan: record.stage1_action_plan,
        stage2_tutorial_given: record.stage2_tutorial_given,
        stage2_hours_taught: record.stage2_hours_taught,
        stage2_candidate_overall: record.stage2_candidate_overall,
        stage2_candidate_notes: record.stage2_candidate_notes,
        stage2_candidate_written_assignments_notes: record.stage2_candidate_written_assignments_notes,
        stage2_candidate_other_notes: record.stage2_candidate_other_notes,
        stage2_tutor_overall: record.stage2_tutor_overall,
        stage2_tutor_notes: record.stage2_tutor_notes,
        stage2_tutor_written_assignments_notes: record.stage2_tutor_written_assignments_notes,
        stage2_tutor_other_notes: record.stage2_tutor_other_notes,
        stage3_tutorial_required: record.stage3_tutorial_required,
        stage3_tutorial_given: record.stage3_tutorial_given,
        stage3_hours_taught: record.stage3_hours_taught,
        stage3_tutor_overall: record.stage3_tutor_overall,
        stage3_tutor_notes: record.stage3_tutor_notes,
        stage3_tutor_written_assignments_notes: record.stage3_tutor_written_assignments_notes,
        stage3_tutor_other_notes: record.stage3_tutor_other_notes,
      }
    : null;

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const [{ error: transferError }, { error: statusError }] = await Promise.all([
    admin.from("deferral_transfers").insert({
      center_id: trainee.center_id,
      source_trainee_id: traineeId,
      source_course_id: trainee.course_id as string,
      reasons,
      reintegration_arrangements: reintegrationArrangements,
      reintegration_deadline: reintegrationDeadline,
      hours_carried: hoursCarried,
      hours_carried_overridden: hoursCarriedOverridden,
      hours_carried_note: hoursCarriedOverridden ? hoursCarriedNote : null,
      carried_assignments: carriedAssignments,
      carried_tps: carriedTps,
      carried_celta5_matrix: carriedMatrix,
      carried_celta5_record: carriedRecord,
      note,
      created_by: staff.id,
      cambridge_consulted_at: now,
    }),
    admin
      .from("profiles")
      .update({
        course_status: "deferred",
        course_status_set_at: now,
        course_status_set_by: staff.id,
        course_status_note: note,
      })
      .eq("id", traineeId),
  ]);
  if (transferError || statusError) {
    return { error: "Could not record the deferral. Try again." };
  }

  if (requestId) {
    await admin
      .from("withdrawal_requests")
      .update({ status: "actioned", actioned_by: staff.id, actioned_at: now })
      .eq("id", requestId)
      .eq("trainee_id", traineeId);
  }

  revalidatePath(`/portfolio/${traineeId}`);
  revalidatePath("/trainer/roster");
  return { error: null };
}

export interface ExtensionFormState {
  error: string | null;
}

// specs/build-spec.md §3 "Extension -- for special consideration... The
// candidate completes after the official end date... Close-out waits."
// Unlike withdrawTrainee, this does NOT freeze the portfolio -- course_status
// changes but isCourseStatusReadOnly deliberately excludes 'extension'.
export async function grantExtension(
  _prevState: ExtensionFormState,
  formData: FormData
): Promise<ExtensionFormState> {
  const staff = await requireRole(["trainer", "admin"]);
  const traineeId = formData.get("trainee_id");
  const note = ((formData.get("note") as string | null) ?? "").trim() || null;
  const completesBy = (formData.get("completes_by") as string | null) || null;
  if (typeof traineeId !== "string") {
    return { error: "Missing candidate." };
  }

  const supabase = await createClient();
  const { data: trainee } = await supabase
    .from("profiles")
    .select("id, course_id, role, course_status")
    .eq("id", traineeId)
    .maybeSingle();
  if (!trainee || trainee.role !== "trainee" || trainee.course_id !== staff.course_id) {
    return { error: "Candidate not found on your course." };
  }
  if (trainee.course_status !== "active") {
    return { error: "This candidate already has a course status set." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({
      course_status: "extension",
      course_status_set_at: new Date().toISOString(),
      course_status_set_by: staff.id,
      course_status_note: note,
      extension_completes_by: completesBy,
    })
    .eq("id", traineeId);
  if (error) {
    return { error: "Could not record the extension. Try again." };
  }

  revalidatePath(`/portfolio/${traineeId}`);
  revalidatePath("/trainer/roster");
  return { error: null };
}

export type AbsenceFormState = { error: string | null };

// Ramy, 29 Aug 2026: "the trainee side should also show the attendance --
// it's like for absences. If they skip something, then they have to record
// it."
//
// The trainer's own addAbsence in celta5-actions.ts requires a trainer, so
// until now the only way an absence reached the record was a tutor typing
// it in afterwards. This is the candidate declaring their own, which is
// how it is meant to work: they know they missed the session, the tutor
// finds out because they said so.
//
// Deliberately cannot set tutor_comment -- that is the tutor's response to
// the absence, and migration 0244's policy rejects the insert if it is
// present rather than trusting this to leave it out.
export async function reportOwnAbsence(_prevState: AbsenceFormState, formData: FormData): Promise<AbsenceFormState> {
  const trainee = await requireRole("trainee");
  if (!trainee.course_id) return { error: "You are not on a course yet." };

  const category = formData.get("category");
  if (category !== "unavoidable" && category !== "other") {
    return { error: "Choose whether this was unavoidable." };
  }
  const sessionDate = formData.get("session_date");
  if (typeof sessionDate !== "string" || !sessionDate) {
    return { error: "Say which day you missed." };
  }
  const reason = formData.get("reason");
  if (typeof reason !== "string" || !reason.trim()) {
    return { error: "Give a short reason -- your tutor needs to know what happened." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("attendance_absences").insert({
    course_id: trainee.course_id,
    trainee_id: trainee.id,
    category,
    session_date: sessionDate,
    reason: reason.trim(),
    work_made_up: typeof formData.get("work_made_up") === "string" ? (formData.get("work_made_up") as string).trim() || null : null,
  });
  if (error) return { error: "Could not save. Try again." };

  revalidatePath(`/portfolio/${trainee.id}/celta5`);
  return { error: null };
}

// Ramy, 29 Aug 2026: "the trainees must sign for the assignments -- if it's
// pass, for resubmission, second submission, or fail."
//
// Distinct from the own-work confirmation, which is declared BEFORE
// submitting. This records that the candidate has seen the result and its
// consequence -- a resubmission window opening, a resubmission being spent,
// a criterion left unmet. It is not agreement, and signing it does not
// waive the right to query the grade; it is a record that they were shown.
export async function signAssignmentOutcome(_prevState: AbsenceFormState, formData: FormData): Promise<AbsenceFormState> {
  const trainee = await requireRole("trainee");

  const assignmentId = formData.get("assignment_id");
  const round = formData.get("round");
  if (typeof assignmentId !== "string" || !assignmentId || (round !== "first" && round !== "resubmission")) {
    return { error: "Something went wrong. Refresh and try again." };
  }

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("signature_name, full_name").eq("id", trainee.id).maybeSingle();
  // Falls back to the profile name, because on this form typing the name
  // IS the act of signing -- Ramy's design says "Type your name both next
  // to 'Name' and 'Signed'". Requiring a signature to have been set
  // elsewhere first blocked the candidate on the very page that collects
  // it, which is how these two confirmations ended up unsignable.
  const name = profile?.signature_name?.trim() || profile?.full_name?.trim();
  if (!name) return { error: "Your record has no name on it. Ask your tutor to check your profile." };

  // The booklet signs the way the paper CELTA 5 does -- the candidate
  // types their name next to both "Name" and "Signed" (Ramy's design file,
  // 29 Aug 2026). Both fields are checked here rather than in the client
  // alone: a signature is the evidence the centre relies on if a result is
  // ever queried, so it can't rest on markup that a candidate could skip.
  // Matching is case- and whitespace-insensitive against the name already
  // on the profile; the stored value stays the canonical profile name so
  // the signature ledger and the PDF can't disagree with each other.
  const typedName = String(formData.get("typed_name") ?? "").trim();
  const typedSignature = String(formData.get("typed_signature") ?? "").trim();
  if (!typedName || !typedSignature) {
    return { error: "Type your name next to both Name and Signed." };
  }
  const norm = (v: string) => v.toLowerCase().replace(/\s+/g, " ");
  if (norm(typedName) !== norm(name) || norm(typedSignature) !== norm(name)) {
    return { error: `Both fields must read "${name}" -- the name on your record.` };
  }

  const { data: existing } = await supabase
    .from("assignments")
    .select("first_outcome_signed_at, resubmission_outcome_signed_at")
    .eq("id", assignmentId)
    .eq("trainee_id", trainee.id)
    .maybeSingle();
  if (!existing) return { error: "Could not find that assignment." };
  // Idempotent: a second press must not overwrite the original date, which
  // is the whole evidential point of the signature.
  if (round === "first" ? existing.first_outcome_signed_at : existing.resubmission_outcome_signed_at) {
    return { error: null };
  }

  const now = new Date().toISOString();
  const patch =
    round === "first"
      ? { first_outcome_signed_at: now, first_outcome_signature_name: name }
      : { resubmission_outcome_signed_at: now, resubmission_outcome_signature_name: name };

  const { error } = await supabase.from("assignments").update(patch).eq("id", assignmentId).eq("trainee_id", trainee.id);
  if (error) return { error: "Could not save. Try again." };

  revalidatePath(`/portfolio/${trainee.id}/assignments/${assignmentId}`);
  revalidatePath(`/portfolio/${trainee.id}/celta5`);
  return { error: null };
}

// Ramy, 30 Aug 2026: the real CELTA 5 ends two of its static sections with
// a candidate confirmation -- "I confirm that I have understood and accept
// the above requirements for the CELTA portfolio", and "I confirm that I
// have read the Cambridge English Appeals Procedure".
//
// Those are declarations about text the candidate has just read, which is
// why the whole section has to be on the page rather than behind a link.
// Signed in place, section by section, in Cambridge's own order.
export async function confirmCelta5Section(_prevState: AbsenceFormState, formData: FormData): Promise<AbsenceFormState> {
  const trainee = await requireRole("trainee");

  const section = formData.get("section");
  if (section !== "portfolio" && section !== "appeals") {
    return { error: "Something went wrong. Refresh and try again." };
  }

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("signature_name, full_name").eq("id", trainee.id).maybeSingle();
  const name = profile?.signature_name?.trim() || profile?.full_name?.trim();
  if (!name) return { error: "Set your signature name first." };

  const now = new Date().toISOString();
  const patch =
    section === "portfolio"
      ? { portfolio_terms_confirmed_at: now, portfolio_terms_signature_name: name }
      : { appeals_read_confirmed_at: now, appeals_read_signature_name: name };

  // Idempotent by column: re-confirming would only rewrite the date, and
  // the date is the evidence. The UI hides the control once signed, this
  // is the guard behind it.
  const { data: existing } = await supabase
    .from("celta5_records")
    .select("portfolio_terms_confirmed_at, appeals_read_confirmed_at")
    .eq("trainee_id", trainee.id)
    .maybeSingle();
  if (!existing) return { error: "Could not find your record." };
  if (section === "portfolio" ? existing.portfolio_terms_confirmed_at : existing.appeals_read_confirmed_at) {
    return { error: null };
  }

  const { error } = await supabase.from("celta5_records").update(patch).eq("trainee_id", trainee.id);
  if (error) return { error: "Could not save. Try again." };

  revalidatePath(`/portfolio/${trainee.id}/celta5`);
  return { error: null };
}
