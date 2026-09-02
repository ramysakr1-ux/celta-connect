"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { CRITERIA_LABELS } from "@/lib/celta-criteria";
import { criteriaForTpDate, getPeerGroupMembers } from "@/lib/peer-observation";
import { toLocalIso, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";
import { getCachedCenter } from "@/lib/supabase/cached-queries";

export interface PeerNoteFormState {
  error: string | null;
}

// specs/build-spec.md "Peer observation" -- prompts are illustrative, not
// verbatim-spec'd: "week one asks about instructions (4c), week four about
// staging and pace" are examples of the MECHANISM (criterion -> prompt),
// not fixed copy. First box anchors to this week's criterion focus (or a
// generic strength prompt before any input session has criteria set);
// second is deliberately open, since not everything worth noting maps
// neatly onto one criterion code.
function buildPrompts(criteriaCodes: string[]): { prompt1: string; prompt2: string } {
  if (criteriaCodes.length === 0) {
    return { prompt1: "What's one strength you noticed?", prompt2: "Anything else worth flagging?" };
  }
  const labels = criteriaCodes.map((c) => CRITERIA_LABELS[c] ?? c).join("; ");
  return { prompt1: `What did you notice about: ${labels}?`, prompt2: "Anything else worth flagging?" };
}

// Finds this lesson's sheet, creating it (with prompts seeded from the
// most recent input session's criteria as of today -- notes are written
// live, during the lesson, so "today" is the TP day) if this is the first
// peer to write a note for it.
async function findOrCreateSheet(
  admin: ReturnType<typeof createAdminClient>,
  courseId: string,
  observedTraineeId: string,
  tpNumber: number
): Promise<{ id: string } | null> {
  const { data: existing } = await admin
    .from("peer_observation_sheets")
    .select("id")
    .eq("trainee_id", observedTraineeId)
    .eq("tp_number", tpNumber)
    .maybeSingle();
  if (existing) return existing;

  const [{ data: plan }, { data: sessions }, { data: course }] = await Promise.all([
    admin.from("plan_assignments").select("id").eq("trainee_id", observedTraineeId).eq("tp_number", tpNumber).maybeSingle(),
    admin
      .from("course_timetable_events")
      .select("event_date, input_session_criteria")
      .eq("course_id", courseId)
      .eq("type", "input_session"),
    admin.from("courses").select("center_id").eq("id", courseId).maybeSingle(),
  ]);

  const timeZone = course ? ((await getCachedCenter(course.center_id))?.time_zone ?? DEFAULT_TIMEZONE) : DEFAULT_TIMEZONE;
  const criteriaCodes = criteriaForTpDate(sessions ?? [], toLocalIso(new Date(), timeZone));
  const { prompt1, prompt2 } = buildPrompts(criteriaCodes);

  const { data: created, error } = await admin
    .from("peer_observation_sheets")
    .insert({
      course_id: courseId,
      trainee_id: observedTraineeId,
      tp_number: tpNumber,
      plan_assignment_id: plan?.id ?? null,
      criteria_codes: criteriaCodes,
      prompt_1: prompt1,
      prompt_2: prompt2,
    })
    .select("id")
    .maybeSingle();
  if (error) return null;
  return created;
}

export async function savePeerNote(_prevState: PeerNoteFormState, formData: FormData): Promise<PeerNoteFormState> {
  const session = await getCurrentProfile();
  const viewer = session?.profile;
  if (!viewer || viewer.role !== "trainee") {
    return { error: "Not authorized." };
  }

  const observedTraineeId = formData.get("trainee_id");
  const tpNumberRaw = formData.get("tp_number");
  const note1 = ((formData.get("note_1") as string | null) ?? "").trim().slice(0, 200);
  const note2 = ((formData.get("note_2") as string | null) ?? "").trim().slice(0, 200);
  if (typeof observedTraineeId !== "string" || typeof tpNumberRaw !== "string") {
    return { error: "Something went wrong. Refresh and try again." };
  }
  const tpNumber = Number(tpNumberRaw);
  if (observedTraineeId === viewer.id) {
    return { error: "You can't write a peer note on your own lesson." };
  }

  const supabase = await createClient();
  const { data: observed } = await supabase
    .from("profiles")
    .select("id, course_id")
    .eq("id", observedTraineeId)
    .eq("role", "trainee")
    .maybeSingle();
  if (!observed || observed.course_id !== viewer.course_id) {
    return { error: "Candidate not found on your course." };
  }

  const admin = createAdminClient();
  const group = await getPeerGroupMembers(admin, observedTraineeId);
  if (!group.some((m) => m.traineeId === viewer.id)) {
    return { error: "You're not in this candidate's TP group." };
  }

  const sheet = await findOrCreateSheet(admin, observed.course_id as string, observedTraineeId, tpNumber);
  if (!sheet) {
    return { error: "Could not open this lesson's peer sheet. Try again." };
  }

  const { data: existingSheet } = await admin
    .from("peer_observation_sheets")
    .select("revealed_at")
    .eq("id", sheet.id)
    .maybeSingle();
  if (existingSheet?.revealed_at) {
    return { error: "Notes for this lesson have already been revealed and can't be changed." };
  }

  const { error } = await admin.from("peer_observation_notes").upsert(
    {
      sheet_id: sheet.id,
      observer_id: viewer.id,
      note_1: note1 || null,
      note_2: note2 || null,
      submitted_at: new Date().toISOString(),
    },
    { onConflict: "sheet_id,observer_id" }
  );
  if (error) {
    // The message below is what the person reads; this is what we read.
    console.error("[portfolio/[traineeId]/tp/[tpNumber]/peer-observation-actions.ts:savePeerNote]", error);
    return { error: "Could not save your note. Try again." };
}

  revalidatePath(`/portfolio/${observedTraineeId}/tp/${tpNumber}`);
  return { error: null };
}

export interface GroupFeedbackFormState {
  error: string | null;
}

// "The three who did not teach today read all the notes and agree the
// group feedback." Any of the eligible non-teaching peers can write/edit
// it post-reveal -- the "agreeing" happens out loud, this just records the
// result. Simple last-write-wins, no per-author locking.
export async function saveGroupFeedback(_prevState: GroupFeedbackFormState, formData: FormData): Promise<GroupFeedbackFormState> {
  const session = await getCurrentProfile();
  const viewer = session?.profile;
  if (!viewer || viewer.role !== "trainee") {
    return { error: "Not authorized." };
  }

  const observedTraineeId = formData.get("trainee_id");
  const tpNumberRaw = formData.get("tp_number");
  const feedback = ((formData.get("group_feedback") as string | null) ?? "").trim();
  if (typeof observedTraineeId !== "string" || typeof tpNumberRaw !== "string" || !feedback) {
    return { error: "Write the agreed feedback before saving." };
  }
  const tpNumber = Number(tpNumberRaw);

  const supabase = await createClient();
  const { data: observed } = await supabase
    .from("profiles")
    .select("id, course_id")
    .eq("id", observedTraineeId)
    .eq("role", "trainee")
    .maybeSingle();
  if (!observed || observed.course_id !== viewer.course_id) {
    return { error: "Candidate not found on your course." };
  }

  const admin = createAdminClient();
  const group = await getPeerGroupMembers(admin, observedTraineeId);
  if (!group.some((m) => m.traineeId === viewer.id)) {
    return { error: "You're not in this candidate's TP group." };
  }

  const { data: sheet } = await admin
    .from("peer_observation_sheets")
    .select("id, revealed_at")
    .eq("trainee_id", observedTraineeId)
    .eq("tp_number", tpNumber)
    .maybeSingle();
  if (!sheet || !sheet.revealed_at) {
    return { error: "Notes for this lesson haven't been revealed yet." };
  }

  await admin
    .from("peer_observation_sheets")
    .update({ group_feedback: feedback, group_feedback_submitted_at: new Date().toISOString() })
    .eq("id", sheet.id);

  revalidatePath(`/portfolio/${observedTraineeId}/tp/${tpNumber}`);
  return { error: null };
}
