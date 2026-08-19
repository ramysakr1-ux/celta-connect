"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { sendPushToOwners } from "@/lib/push/send";

export interface FormState {
  error: string | null;
}

const STAGE_LABEL: Record<"stage1" | "stage3", string> = {
  stage1: "Stage 1",
  stage3: "Stage 3",
};

// One trainer action for both stages -- invites are structurally identical
// (one candidate, one time, one confirm step), only the label differs. On
// a course that already has an invite for this trainee+stage, this
// reschedules it: the timetable event's date/time move and confirmed_at
// resets, since a confirmation against the old time no longer means
// anything.
export async function createOrUpdateIndividualTutorialInvite(_prevState: FormState, formData: FormData): Promise<FormState> {
  const trainer = await requireRole(["trainer", "admin"]);
  if (!trainer.course_id) return { error: "No course assigned." };

  const traineeId = formData.get("trainee_id") as string | null;
  const traineeName = (formData.get("trainee_name") as string | null) ?? "the candidate";
  const stage = formData.get("stage") as string | null;
  const eventDate = formData.get("event_date") as string | null;
  const eventTime = formData.get("event_time") as string | null;

  if (!traineeId || (stage !== "stage1" && stage !== "stage3") || !eventDate || !eventTime) {
    return { error: "Choose a candidate, date, and time." };
  }

  const supabase = await createClient();
  const courseId = trainer.course_id;
  const label = STAGE_LABEL[stage];

  const { data: existing } = await supabase
    .from("individual_tutorial_invites")
    .select("id, timetable_event_id")
    .eq("course_id", courseId)
    .eq("trainee_id", traineeId)
    .eq("stage", stage)
    .maybeSingle();

  if (existing) {
    const { error: eventError } = await supabase
      .from("course_timetable_events")
      .update({ event_date: eventDate, event_time: eventTime })
      .eq("id", existing.timetable_event_id);
    if (eventError) return { error: "Could not move the timetable slot." };

    const { error: inviteError } = await supabase
      .from("individual_tutorial_invites")
      .update({ confirmed_at: null })
      .eq("id", existing.id);
    if (inviteError) return { error: "Could not reschedule the invite." };
  } else {
    const { data: event, error: eventError } = await supabase
      .from("course_timetable_events")
      .insert({
        course_id: courseId,
        type: "milestone",
        tag: `${stage}_tutorial`,
        title: `${label} tutorial — ${traineeName}`,
        event_date: eventDate,
        event_time: eventTime,
        created_by: trainer.id,
      })
      .select("id")
      .single();
    if (eventError || !event) return { error: "Could not add the timetable slot." };

    const { error: inviteError } = await supabase.from("individual_tutorial_invites").insert({
      course_id: courseId,
      trainee_id: traineeId,
      stage,
      timetable_event_id: event.id,
      created_by: trainer.id,
    });
    if (inviteError) return { error: "Could not create the invite." };

    // Personal, not group-scoped -- reuses the exact visible_to_trainee_id
    // shape the assignment-feedback announcement already uses (migration
    // 0095), not stage2's group broadcast.
    await supabase.from("course_broadcasts").insert({
      course_id: courseId,
      author_id: trainer.id,
      title: `${label} tutorial booked — ${eventDate}`,
      body: "Your tutor has set a time for this. Open your Today page to confirm.",
      anchor_event_id: event.id,
      anchor_offset_days: 0,
      sent_at: new Date().toISOString(),
      // Per-cohort scheduling, not something a duplicated course should
      // inherit -- same reasoning as Stage 2's own announcement.
      keep_on_duplicate: false,
      visible_to_trainee_id: traineeId,
    });
  }

  revalidatePath("/trainer/timetable");
  revalidatePath("/trainer/roster");
  revalidatePath(`/portfolio/${traineeId}`, "layout");
  return { error: null };
}

// Removing the timetable event cascades to the invite row (on delete
// cascade, migration 0129) -- one delete undoes both.
//
// build-spec.md §? / for-claude-code-announcements.md: "Push notification
// only for cancellation, room change, or something already late." Of the
// three, this is the only one with a real feature to hook a push onto --
// there's no general "cancel a TP" anywhere in the app, and no room field
// to change, so this is deliberately scoped to individual tutorial
// cancellation specifically (confirmed with Ramy 2026-08-19), not a
// general timetable-cancellation push.
export async function cancelIndividualTutorialInvite(formData: FormData): Promise<void> {
  const trainer = await requireRole(["trainer", "admin"]);
  const inviteId = formData.get("invite_id");
  if (typeof inviteId !== "string") return;

  const supabase = await createClient();
  const { data: invite } = await supabase
    .from("individual_tutorial_invites")
    .select("timetable_event_id, trainee_id, stage")
    .eq("id", inviteId)
    .eq("course_id", trainer.course_id ?? "")
    .maybeSingle();
  if (!invite) return;

  const { data: event } = await supabase
    .from("course_timetable_events")
    .select("event_date")
    .eq("id", invite.timetable_event_id)
    .maybeSingle();

  await supabase.from("course_timetable_events").delete().eq("id", invite.timetable_event_id);

  const label = STAGE_LABEL[invite.stage as "stage1" | "stage3"] ?? "tutorial";
  await sendPushToOwners(
    { profileIds: [invite.trainee_id] },
    {
      title: `${label} tutorial cancelled`,
      body: event?.event_date ? `Your ${event.event_date} slot has been cancelled -- your tutor will set a new time.` : "Your tutor will set a new time.",
      url: `/portfolio/${invite.trainee_id}`,
    }
  );

  revalidatePath("/trainer/timetable");
  revalidatePath("/trainer/roster");
  revalidatePath(`/portfolio/${invite.trainee_id}`, "layout");
}

export interface ConfirmState {
  error: string | null;
}

export async function confirmIndividualTutorialInvite(_prevState: ConfirmState, formData: FormData): Promise<ConfirmState> {
  const inviteId = formData.get("invite_id");
  if (typeof inviteId !== "string") return { error: "Missing invite." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase
    .from("individual_tutorial_invites")
    .update({ confirmed_at: new Date().toISOString() })
    .eq("id", inviteId)
    .eq("trainee_id", user.id);
  if (error) return { error: "Could not confirm -- try again." };

  revalidatePath("/portfolio/[traineeId]", "layout");
  return { error: null };
}
