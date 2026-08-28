"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { CANDIDATES_TO_FOLLOW } from "@/lib/trainer-in-training";

export interface FormState {
  error: string | null;
}

// Every action below relies on RLS (tit_can_access(), migration 0148) as
// the actual authorization boundary -- the TinT themselves, their
// supervisor, or admin at the centre. A write from anyone else is simply
// rejected by Postgres, so nothing here re-derives that check by hand.
function revalidateWorkspace() {
  revalidatePath("/trainer/trainer-in-training");
}

export async function togglePreCourseTask(formData: FormData): Promise<void> {
  await requireRole(["trainer", "admin"]);
  const id = formData.get("id");
  const checked = formData.get("checked") === "true";
  if (typeof id !== "string") return;

  const supabase = await createClient();
  await supabase
    .from("tit_pre_course_tasks")
    .update({ completed_at: checked ? new Date().toISOString() : null })
    .eq("id", id);
  revalidateWorkspace();
}

export async function toggleObservedSession(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requireRole(["trainer", "admin"]);
  const titRecordId = formData.get("tit_record_id");
  const timetableEventId = formData.get("timetable_event_id");
  const asynchronous = formData.get("asynchronous") === "on";
  if (typeof titRecordId !== "string" || typeof timetableEventId !== "string") {
    return { error: "Something went wrong. Refresh and try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("tit_observed_sessions")
    .upsert(
      { tit_record_id: titRecordId, timetable_event_id: timetableEventId, asynchronous },
      { onConflict: "tit_record_id,timetable_event_id" }
    );
  if (error) return { error: "Could not save. Try again." };
  revalidateWorkspace();
  return { error: null };
}

export async function unmarkObservedSession(formData: FormData): Promise<void> {
  await requireRole(["trainer", "admin"]);
  const id = formData.get("id");
  if (typeof id !== "string") return;
  const supabase = await createClient();
  await supabase.from("tit_observed_sessions").delete().eq("id", id);
  revalidateWorkspace();
}

export async function addTask12Stage1(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requireRole(["trainer", "admin"]);
  const titRecordId = formData.get("tit_record_id");
  const timetableEventId = (formData.get("timetable_event_id") as string | null) || null;
  const handoutDescription = (formData.get("handout_description") as string | null)?.trim();
  if (typeof titRecordId !== "string" || !handoutDescription) {
    return { error: "Describe the handout you prepared." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("tit_task12_stage1").insert({
    tit_record_id: titRecordId,
    timetable_event_id: timetableEventId,
    handout_description: handoutDescription,
  });
  if (error) return { error: "Could not save. Try again." };
  revalidateWorkspace();
  return { error: null };
}

export async function removeTask12Stage1(formData: FormData): Promise<void> {
  await requireRole(["trainer", "admin"]);
  const id = formData.get("id");
  if (typeof id !== "string") return;
  const supabase = await createClient();
  await supabase.from("tit_task12_stage1").delete().eq("id", id);
  revalidateWorkspace();
}

export async function addDeliveredSession(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requireRole(["trainer", "admin"]);
  const titRecordId = formData.get("tit_record_id");
  const title = (formData.get("title") as string | null)?.trim();
  const deliveredAt = formData.get("delivered_at");
  // Task Twelve Stage 2: "fully self-designed... never reused from the
  // centre's own Resource Hub library" -- required attestation, not a
  // real content check (out of scope), but nothing existed before this.
  const selfDesigned = formData.get("self_designed") === "on";
  if (typeof titRecordId !== "string" || !title || typeof deliveredAt !== "string" || !deliveredAt) {
    return { error: "Name the session and when you delivered it." };
  }
  if (!selfDesigned) return { error: "Confirm this session was self-designed before adding it." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("tit_delivered_sessions")
    .insert({ tit_record_id: titRecordId, title, delivered_at: deliveredAt, self_designed_attested_at: new Date().toISOString() });
  if (error) return { error: "Could not save. Try again." };
  revalidateWorkspace();
  return { error: null };
}

export async function updateDeliveredSessionSelfEval(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requireRole(["trainer", "admin"]);
  const id = formData.get("id");
  const text = (formData.get("self_evaluation") as string | null)?.trim();
  if (typeof id !== "string" || !text) return { error: "Write your self-evaluation first." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("tit_delivered_sessions")
    .update({ self_evaluation: text, self_evaluation_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: "Could not save. Try again." };
  revalidateWorkspace();
  return { error: null };
}

// Ramy, 28 Aug 2026: was "supervisor-only in practice" via UI convention
// only -- RLS let the TinT write their own supervisor's feedback field too.
// Same real identity check as signTaskRecordItem now, since this is
// exactly the kind of document the spec says "carries no signature at all"
// from the TinT's side -- it has to actually be the supervisor.
export async function updateDeliveredSessionSupervisorFeedback(_prevState: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireRole(["trainer", "admin"]);
  const id = formData.get("id");
  const text = (formData.get("supervisor_feedback") as string | null)?.trim();
  if (typeof id !== "string" || !text) return { error: "Write the feedback first." };

  const supabase = await createClient();
  const { data: session } = await supabase
    .from("tit_delivered_sessions")
    .select("tit_records(course_tutors(supervisor_profile_id))")
    .eq("id", id)
    .maybeSingle();
  const tutors = (session?.tit_records as unknown as { course_tutors: { supervisor_profile_id: string | null } | null } | null)?.course_tutors;
  if (viewer.role !== "admin" && tutors?.supervisor_profile_id !== viewer.id) {
    return { error: "Only this TinT's supervisor can write this." };
  }

  const { error } = await supabase
    .from("tit_delivered_sessions")
    .update({ supervisor_feedback: text, supervisor_feedback_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: "Could not save. Try again." };
  revalidateWorkspace();
  return { error: null };
}

export async function addFeedbackSession(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requireRole(["trainer", "admin"]);
  const titRecordId = formData.get("tit_record_id");
  const traineeId = (formData.get("trainee_id") as string | null) || null;
  const tpNumberRaw = formData.get("tp_number") as string | null;
  const conductedAt = formData.get("conducted_at");
  const observedBySupervisor = formData.get("observed_by_supervisor") === "on";
  if (typeof titRecordId !== "string" || typeof conductedAt !== "string" || !conductedAt) {
    return { error: "Give the date this feedback session happened." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("tit_feedback_sessions").insert({
    tit_record_id: titRecordId,
    trainee_id: traineeId,
    tp_number: tpNumberRaw ? Number(tpNumberRaw) : null,
    conducted_at: conductedAt,
    observed_by_supervisor: observedBySupervisor,
  });
  if (error) return { error: "Could not save. Try again." };
  revalidateWorkspace();
  return { error: null };
}

// 1a4: "draft their own assessment privately -- before seeing the
// supervisor's view, not after." Saved as its own step, separate from
// finalizing, so the draft's timing is real rather than backfilled.
export async function saveFeedbackDraft(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requireRole(["trainer", "admin"]);
  const id = formData.get("id");
  const text = (formData.get("private_draft") as string | null)?.trim();
  if (typeof id !== "string" || !text) return { error: "Write your draft assessment first." };

  const supabase = await createClient();
  const { error } = await supabase.from("tit_feedback_sessions").update({ private_draft: text }).eq("id", id);
  if (error) return { error: "Could not save. Try again." };
  revalidateWorkspace();
  return { error: null };
}

// 1a4 step 4: "discuss the draft with the supervisor before anything is
// written up as the real, trainee-facing document." Finalizing here never
// touches any candidate-facing record -- this working copy exists purely
// as portfolio evidence.
export async function finalizeFeedbackSession(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requireRole(["trainer", "admin"]);
  const id = formData.get("id");
  const notes = (formData.get("supervisor_discussion_notes") as string | null)?.trim();
  if (typeof id !== "string" || !notes) return { error: "Note what the discussion covered first." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("tit_feedback_sessions")
    .update({ supervisor_discussion_notes: notes, finalized_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: "Could not save. Try again." };
  revalidateWorkspace();
  return { error: null };
}

// 1b2: "not what the feedback said, but how the TinT delivered it...
// discussed straight after each feedback session."
export async function saveFeedbackOnFeedback(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requireRole(["trainer", "admin"]);
  const id = formData.get("id");
  const notes = (formData.get("feedback_on_feedback_notes") as string | null)?.trim();
  if (typeof id !== "string" || !notes) return { error: "Write the discussion notes first." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("tit_feedback_sessions")
    .update({ feedback_on_feedback_notes: notes, feedback_on_feedback_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: "Could not save. Try again." };
  revalidateWorkspace();
  return { error: null };
}

export async function addCandidateFollowed(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requireRole(["trainer", "admin"]);
  const titRecordId = formData.get("tit_record_id");
  const traineeId = formData.get("trainee_id");
  if (typeof titRecordId !== "string" || typeof traineeId !== "string" || !traineeId) {
    return { error: "Pick a candidate." };
  }

  const supabase = await createClient();
  // Ramy, 28 Aug 2026: spec's "two candidates followed, not four" (Task
  // Nine) -- was display-text only (CANDIDATES_TO_FOLLOW used just for the
  // "N of 2" label), nothing actually stopped a 3rd+ row.
  const { count } = await supabase
    .from("tit_candidates_followed")
    .select("id", { count: "exact", head: true })
    .eq("tit_record_id", titRecordId);
  if ((count ?? 0) >= CANDIDATES_TO_FOLLOW) {
    return { error: `Already following ${CANDIDATES_TO_FOLLOW} candidates -- that's the maximum (Task Nine).` };
  }

  const { error } = await supabase.from("tit_candidates_followed").insert({ tit_record_id: titRecordId, trainee_id: traineeId });
  if (error) return { error: error.code === "23505" ? "Already being followed." : "Could not save. Try again." };
  revalidateWorkspace();
  return { error: null };
}

export async function updateCandidateNotes(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requireRole(["trainer", "admin"]);
  const id = formData.get("id");
  const stage = formData.get("stage");
  const notes = (formData.get("notes") as string | null)?.trim() || null;
  if (typeof id !== "string" || (stage !== "beginning" && stage !== "middle" && stage !== "end")) {
    return { error: "Something went wrong. Refresh and try again." };
  }

  const supabase = await createClient();
  const update =
    stage === "beginning" ? { notes_beginning: notes } : stage === "middle" ? { notes_middle: notes } : { notes_end: notes };
  const { error } = await supabase.from("tit_candidates_followed").update(update).eq("id", id);
  if (error) return { error: "Could not save. Try again." };
  revalidateWorkspace();
  return { error: null };
}

export async function addShadowMarking(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requireRole(["trainer", "admin"]);
  const titRecordId = formData.get("tit_record_id");
  const assignmentId = (formData.get("assignment_id") as string | null) || null;
  const titGrade = (formData.get("tit_grade") as string | null)?.trim() || null;
  const supervisorGrade = (formData.get("supervisor_grade") as string | null)?.trim() || null;
  const agreed = formData.get("agreed") === "on";
  if (typeof titRecordId !== "string") return { error: "Something went wrong. Refresh and try again." };

  const supabase = await createClient();
  const { error } = await supabase.from("tit_shadow_marking").insert({
    tit_record_id: titRecordId,
    assignment_id: assignmentId,
    tit_grade: titGrade,
    supervisor_grade: supervisorGrade,
    agreed,
  });
  if (error) return { error: "Could not save. Try again." };
  revalidateWorkspace();
  return { error: null };
}

// "Trained online only -> must shadow the equivalent of at least 3 days
// on a face-to-face course before tutoring face-to-face" -- log one real
// shadow day at a time, same "log entry" shape as addShadowMarking above.
export async function addShadowDay(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requireRole(["trainer", "admin"]);
  const titRecordId = formData.get("tit_record_id");
  const mode = formData.get("mode");
  const shadowedAt = formData.get("shadowed_at");
  const note = (formData.get("note") as string | null)?.trim() || null;
  if (typeof titRecordId !== "string" || (mode !== "f2f" && mode !== "online") || typeof shadowedAt !== "string" || !shadowedAt) {
    return { error: "Pick the mode and the date." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("tit_shadow_days").insert({ tit_record_id: titRecordId, mode, shadowed_at: shadowedAt, note });
  if (error) return { error: "Could not save. Try again." };
  revalidateWorkspace();
  return { error: null };
}

export async function updateTaskRecordItem(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requireRole(["trainer", "admin"]);
  const id = formData.get("id");
  const label = (formData.get("label") as string | null)?.trim();
  if (typeof id !== "string" || !label) return { error: "Name the task first." };

  const supabase = await createClient();
  const { error } = await supabase.from("tit_task_record_items").update({ label }).eq("id", id);
  if (error) return { error: "Could not save. Try again." };
  revalidateWorkspace();
  return { error: null };
}

export async function signTaskRecordItem(formData: FormData): Promise<void> {
  const viewer = await requireRole(["trainer", "admin"]);
  const id = formData.get("id");
  const who = formData.get("who");
  if (typeof id !== "string" || (who !== "tit" && who !== "supervisor")) return;

  const supabase = await createClient();
  // Ramy, 28 Aug 2026: "each task signed off by both the TinT and
  // supervisor" (16-item Task Record) -- RLS lets both parties write this
  // row (they need to, to sign their own half), but nothing previously
  // stopped one from also signing the OTHER party's half. A signature only
  // counts if it's actually the matching person clicking it.
  const { data: item } = await supabase
    .from("tit_task_record_items")
    .select("tit_record_id, tit_records(course_tutors(profile_id, supervisor_profile_id))")
    .eq("id", id)
    .maybeSingle();
  const record = item?.tit_records as unknown as { course_tutors: { profile_id: string; supervisor_profile_id: string | null } | null } | null;
  const tutors = record?.course_tutors;
  if (!tutors) return;
  const allowed = who === "tit" ? tutors.profile_id === viewer.id : tutors.supervisor_profile_id === viewer.id;
  // Admins step in for real emergencies (e.g. the supervisor is unreachable) --
  // still gated by the coarse requireRole above, unlike a TinT/supervisor
  // trying to sign the other's half.
  if (!allowed && viewer.role !== "admin") return;

  const now = new Date().toISOString();
  const update = who === "tit" ? { tit_signed_at: now } : { supervisor_signed_at: now };
  await supabase.from("tit_task_record_items").update(update).eq("id", id);
  revalidateWorkspace();
}

export async function updateReflectiveEssay(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requireRole(["trainer", "admin"]);
  const titRecordId = formData.get("tit_record_id");
  const text = (formData.get("reflective_essay") as string | null) ?? "";
  if (typeof titRecordId !== "string") return { error: "Something went wrong. Refresh and try again." };

  const supabase = await createClient();
  const { error } = await supabase.from("tit_records").update({ reflective_essay: text }).eq("id", titRecordId);
  if (error) return { error: "Could not save. Try again." };
  revalidateWorkspace();
  return { error: null };
}

const ESSAY_MIN_WORDS = 1500;
const ESSAY_MAX_WORDS = 2000;

// "The one compulsory task in the whole programme, regardless of what else
// is included." 1,500-2,000 words is checked here as a courtesy, not
// enforced as a hard block -- a supervisor may have a real reason to accept
// something outside the band, and Connect isn't Cambridge's own gate.
export async function submitReflectiveEssay(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requireRole(["trainer", "admin"]);
  const titRecordId = formData.get("tit_record_id");
  const text = (formData.get("reflective_essay") as string | null) ?? "";
  if (typeof titRecordId !== "string") return { error: "Something went wrong. Refresh and try again." };
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount < ESSAY_MIN_WORDS || wordCount > ESSAY_MAX_WORDS) {
    return { error: `The essay should run 1,500-2,000 words -- this is ${wordCount}. Save it as a draft, or submit anyway once it's closer.` };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("tit_records")
    .update({ reflective_essay: text, reflective_essay_submitted_at: new Date().toISOString() })
    .eq("id", titRecordId);
  if (error) return { error: "Could not save. Try again." };
  revalidateWorkspace();
  return { error: null };
}

export async function updateScheme(formData: FormData): Promise<void> {
  await requireRole(["trainer", "admin"]);
  const titRecordId = formData.get("tit_record_id");
  const scheme = formData.get("scheme");
  if (typeof titRecordId !== "string" || (scheme !== "internal" && scheme !== "external")) return;

  const supabase = await createClient();
  await supabase.from("tit_records").update({ scheme }).eq("id", titRecordId);
  revalidateWorkspace();
}

// specs/for-claude-code-trainer-in-training.md line 51 -- the extra
// assessor day also applies "Internal scheme at a centre other than the
// one nominating them," not just External. Only meaningful for Internal
// (External already always requires the day, regardless of this flag).
export async function updateTrainsAtNominatingCentre(formData: FormData): Promise<void> {
  await requireRole(["trainer", "admin"]);
  const titRecordId = formData.get("tit_record_id");
  const value = formData.get("trains_at_nominating_centre") === "on";
  if (typeof titRecordId !== "string") return;

  const supabase = await createClient();
  await supabase.from("tit_records").update({ trains_at_nominating_centre: value }).eq("id", titRecordId);
  revalidateWorkspace();
}

export async function updateModesTrained(formData: FormData): Promise<void> {
  await requireRole(["trainer", "admin"]);
  const titRecordId = formData.get("tit_record_id");
  const modes = formData.getAll("modes") as string[];
  if (typeof titRecordId !== "string") return;

  const supabase = await createClient();
  await supabase.from("tit_records").update({ modes_trained: modes }).eq("id", titRecordId);
  revalidateWorkspace();
}

export async function bookAssessorDay(formData: FormData): Promise<void> {
  await requireRole(["trainer", "admin"]);
  const titRecordId = formData.get("tit_record_id");
  if (typeof titRecordId !== "string") return;
  const supabase = await createClient();
  await supabase.from("tit_records").update({ assessor_day_booked_at: new Date().toISOString() }).eq("id", titRecordId);
  revalidateWorkspace();
}

export async function completeAssessorDay(formData: FormData): Promise<void> {
  await requireRole(["trainer", "admin"]);
  const titRecordId = formData.get("tit_record_id");
  if (typeof titRecordId !== "string") return;
  const supabase = await createClient();
  await supabase.from("tit_records").update({ assessor_day_completed_at: new Date().toISOString() }).eq("id", titRecordId);
  revalidateWorkspace();
}

// "Not yet Main Course Tutor -- that needs >=2 further courses as ACT plus
// shadowing an MCT" is display copy, not enforced here; this action just
// records the outcome itself, which the spec says is "always discussed
// with the TinT and supervisor first" -- a conversation, not a workflow.
export async function setOutcome(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requireRole(["trainer", "admin"]);
  const titRecordId = formData.get("tit_record_id");
  const outcome = formData.get("outcome");
  const note = (formData.get("outcome_note") as string | null)?.trim() || null;
  if (typeof titRecordId !== "string" || (outcome !== "confirmed_act" && outcome !== "extended" && outcome !== "not_verified")) {
    return { error: "Pick an outcome." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("tit_records")
    .update({ outcome, outcome_note: note, outcome_decided_at: new Date().toISOString() })
    .eq("id", titRecordId);
  if (error) return { error: "Could not save. Try again." };
  revalidateWorkspace();
  return { error: null };
}

export async function submitPortfolio(formData: FormData): Promise<void> {
  await requireRole(["trainer", "admin"]);
  const titRecordId = formData.get("tit_record_id");
  if (typeof titRecordId !== "string") return;
  const supabase = await createClient();
  await supabase.from("tit_records").update({ portfolio_submitted_at: new Date().toISOString() }).eq("id", titRecordId);
  revalidateWorkspace();
}
