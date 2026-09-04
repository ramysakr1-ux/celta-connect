"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

export interface FormState {
  error: string | null;
}

function revalidateBroadcastPages(): void {
  // Cohort-wide, not one trainee's page -- revalidate the composer's own
  // homes (Today, the full Announcements screen) and every portfolio
  // Course Stream that reads it.
  revalidatePath("/trainer");
  revalidatePath("/trainer/announcements");
  revalidatePath("/portfolio/[traineeId]", "layout");
}

// for-claude-code-mct-only-announcements.md: managing an announcement
// (edit/delete/hold/resume/post-now) is gated the same as creating one --
// a non-MCT trainer who could no longer compose shouldn't be able to touch
// an existing row either. Same fail-open-if-unassigned rule as postBroadcast.
async function requireMctForBroadcastManagement(
  supabase: Awaited<ReturnType<typeof createClient>>,
  trainer: { role: string; id: string; course_id: string | null }
): Promise<boolean> {
  if (trainer.role !== "trainer" || !trainer.course_id) return true;
  const { data: mct } = await supabase
    .from("course_tutors")
    .select("profile_id")
    .eq("course_id", trainer.course_id)
    .eq("tutor_role", "main_course_tutor")
    .is("left_at", null)
    .maybeSingle();
  return !mct || mct.profile_id === trainer.id;
}

// Ramy, 5 Sep 2026, reopening the 23 Aug decision for one case: an ACT may
// post to their OWN TP group -- "Group B, bring your coursebook tomorrow"
// -- without going through the MCT. Whole-cohort stays the MCT's. "Own"
// means course_tp_groups.tutor_profile_id names them today; when the
// tutors swap groups mid-course, the MCT changes that field on Rotation
// and this follows.
async function myTpGroupIds(supabase: Awaited<ReturnType<typeof createClient>>, trainerId: string, courseId: string): Promise<Set<string>> {
  const { data } = await supabase.from("course_tp_groups").select("id").eq("course_id", courseId).eq("tutor_profile_id", trainerId);
  return new Set((data ?? []).map((g) => g.id));
}

// Managing a row: the MCT for any row, or the author for their own group
// post (an ACT can hold, edit or delete what they themselves scheduled).
async function canManageBroadcast(
  supabase: Awaited<ReturnType<typeof createClient>>,
  trainer: { role: string; id: string; course_id: string | null },
  broadcastId: string
): Promise<boolean> {
  if (await requireMctForBroadcastManagement(supabase, trainer)) return true;
  const { data: row } = await supabase.from("course_broadcasts").select("author_id").eq("id", broadcastId).maybeSingle();
  return row?.author_id === trainer.id;
}

export async function postBroadcast(_prevState: FormState, formData: FormData): Promise<FormState> {
  const trainer = await requireRole(["trainer", "admin"]);
  if (!trainer.course_id) return { error: "No course assigned." };

  const title = (formData.get("title") as string | null)?.trim();
  const body = (formData.get("body") as string | null)?.trim() || null;
  const zoomUrl = (formData.get("zoom_url") as string | null)?.trim() || null;
  const zoomTime = (formData.get("zoom_time") as string | null) || null;
  const attachmentName = (formData.get("attachment_name") as string | null)?.trim() || null;
  const attachmentUrl = (formData.get("attachment_url") as string | null)?.trim() || null;
  const linkedTimetableEventId = (formData.get("linked_timetable_event_id") as string | null) || null;
  const pinned = formData.get("pinned") === "on";
  const keepOnDuplicate = formData.get("keep_on_duplicate") === "on";
  const groupScopeId = (formData.get("visible_to_tp_group_id") as string | null) || null;

  // Scheduling: for-claude-code-trainer-remaining-screens.md's "always
  // anchored to a timetable event, never a fixed date, so the set
  // duplicates correctly into the next course." Distinct from
  // linked_timetable_event_id above, which only supplies a Zoom time to
  // display -- an anchor also controls WHEN the row becomes visible.
  const anchorEventId = (formData.get("anchor_event_id") as string | null) || null;
  const anchorOffsetRaw = (formData.get("anchor_offset_days") as string | null) || null;
  const anchorOffsetDays = anchorOffsetRaw ? Number(anchorOffsetRaw) : null;

  if (!title) return { error: "Title is required." };
  if (anchorEventId && (anchorOffsetDays === null || Number.isNaN(anchorOffsetDays))) {
    return { error: "Choose how many days before/after the event this should send." };
  }

  const supabase = await createClient();

  // for-claude-code-mct-only-announcements.md, superseding this file's
  // older D1/D2 split (for-claude-code-announcements-list.md table D, which
  // let "any tutor attached to that group" send a group-scoped one): Ramy,
  // 23 Aug 2026 -- a trainee's own real-time TP-group chat pill (informal,
  // resets on schedule, build-spec.md's "Trainee -- their own TP group, and
  // DMs to their own tutors") already covers day-to-day ACT<->group
  // communication. Announcements is the heavier, permanent, to-do-list
  // broadcast tool -- MCT only regardless of reach (whole cohort or one
  // group). Still fails OPEN if no MCT is assigned yet (tutor_role is
  // frequently null on real courses), so the course is never left unable to
  // broadcast; admin is never blocked.
  const isMct = await requireMctForBroadcastManagement(supabase, trainer);
  if (!isMct) {
    const mine = await myTpGroupIds(supabase, trainer.id, trainer.course_id);
    if (mine.size === 0) return { error: "Announcements are sent by the main course tutor." };
    if (!groupScopeId || !mine.has(groupScopeId)) return { error: "You can send to your own TP group only -- whole-cohort announcements are the main course tutor's." };
  }
  if (groupScopeId) {
    const { data: group } = await supabase
      .from("course_tp_groups")
      .select("id")
      .eq("id", groupScopeId)
      .eq("course_id", trainer.course_id)
      .maybeSingle();
    if (!group) return { error: "That group could not be found." };
  }

  const { error } = await supabase.from("course_broadcasts").insert({
    course_id: trainer.course_id,
    author_id: trainer.id,
    title,
    body,
    visible_to_tp_group_id: groupScopeId,
    pinned,
    // A linked timetable event is the preferred source for the Zoom time
    // (read live at display time, see page.tsx) -- these manual fields are
    // only the fallback for an ad-hoc call not tied to any scheduled event.
    zoom_url: zoomUrl,
    zoom_time: zoomTime ? new Date(zoomTime).toISOString() : null,
    linked_timetable_event_id: linkedTimetableEventId,
    attachment_name: attachmentUrl ? attachmentName : null,
    attachment_url: attachmentUrl,
    anchor_event_id: anchorEventId,
    anchor_offset_days: anchorEventId ? anchorOffsetDays : null,
    keep_on_duplicate: keepOnDuplicate,
    // Unanchored = immediate: visible the moment it's posted. Anchored =
    // stays pending until the cron (or "Post now") fires it.
    sent_at: anchorEventId ? null : new Date().toISOString(),
  });

  if (error) {
    // The message above is what the person reads; this is what we read.
    console.error("[portfolio/[traineeId]/stream-actions.ts:postBroadcast]", error);
    return { error: "Could not post the announcement." };
  }

  revalidateBroadcastPages();
  return { error: null };
}

export async function deleteBroadcast(formData: FormData): Promise<void> {
  const trainer = await requireRole(["trainer", "admin"]);
  const broadcastId = formData.get("broadcast_id");
  if (typeof broadcastId !== "string") return;

  const supabase = await createClient();
  if (!(await canManageBroadcast(supabase, trainer, broadcastId))) return;
  await supabase
    .from("course_broadcasts")
    .delete()
    .eq("id", broadcastId)
    .eq("course_id", trainer.course_id ?? "");

  revalidateBroadcastPages();
}

// "Post now" -- fire a still-pending scheduled announcement early.
export async function postBroadcastNow(formData: FormData): Promise<void> {
  const trainer = await requireRole(["trainer", "admin"]);
  const broadcastId = formData.get("broadcast_id");
  if (typeof broadcastId !== "string") return;

  const supabase = await createClient();
  if (!(await canManageBroadcast(supabase, trainer, broadcastId))) return;
  await supabase
    .from("course_broadcasts")
    .update({ sent_at: new Date().toISOString() })
    .eq("id", broadcastId)
    .eq("course_id", trainer.course_id ?? "")
    .is("sent_at", null);

  revalidateBroadcastPages();
}

// for-claude-code-announcements.md's second safeguard: "hold anything
// before it fires." The cron skips a held row entirely (announcements-
// cron.ts), so it just sits in Scheduled until someone resumes or edits it.
export async function holdBroadcast(formData: FormData): Promise<void> {
  const trainer = await requireRole(["trainer", "admin"]);
  const broadcastId = formData.get("broadcast_id");
  if (typeof broadcastId !== "string") return;

  const supabase = await createClient();
  if (!(await canManageBroadcast(supabase, trainer, broadcastId))) return;
  await supabase
    .from("course_broadcasts")
    .update({ held_at: new Date().toISOString() })
    .eq("id", broadcastId)
    .eq("course_id", trainer.course_id ?? "")
    .is("sent_at", null);

  revalidateBroadcastPages();
}

export async function resumeBroadcast(formData: FormData): Promise<void> {
  const trainer = await requireRole(["trainer", "admin"]);
  const broadcastId = formData.get("broadcast_id");
  if (typeof broadcastId !== "string") return;

  const supabase = await createClient();
  if (!(await canManageBroadcast(supabase, trainer, broadcastId))) return;
  await supabase
    .from("course_broadcasts")
    .update({ held_at: null })
    .eq("id", broadcastId)
    .eq("course_id", trainer.course_id ?? "");

  revalidateBroadcastPages();
}

// Edit, Scheduled panel -- "editable at any point before it fires." Scoped
// with .is("sent_at", null) same as postBroadcastNow: a Scheduled row is by
// definition not yet sent, so there's never a partially-delivered cohort to
// protect here in this app's all-or-nothing send model (no per-recipient
// delivery tracking exists) -- the spec's "N recipients already have the
// original wording" notice is for a rolling-send mechanism this app doesn't
// have, so it never has anything to show for a row this action can reach.
export async function editBroadcast(_prevState: FormState, formData: FormData): Promise<FormState> {
  const trainer = await requireRole(["trainer", "admin"]);
  const broadcastId = formData.get("broadcast_id");
  if (typeof broadcastId !== "string") return { error: "Missing announcement." };

  const title = (formData.get("title") as string | null)?.trim();
  const body = (formData.get("body") as string | null)?.trim() || null;
  const pinned = formData.get("pinned") === "on";
  const keepOnDuplicate = formData.get("keep_on_duplicate") === "on";
  const anchorEventId = (formData.get("anchor_event_id") as string | null) || null;
  const anchorOffsetRaw = (formData.get("anchor_offset_days") as string | null) || null;
  const anchorOffsetDays = anchorOffsetRaw ? Number(anchorOffsetRaw) : null;

  if (!title) return { error: "Message text is required." };
  if (!anchorEventId || anchorOffsetDays === null || Number.isNaN(anchorOffsetDays)) {
    return { error: "Choose when this should send." };
  }

  const supabase = await createClient();
  if (!(await canManageBroadcast(supabase, trainer, broadcastId))) {
    return { error: "Announcements are managed by the main course tutor." };
  }
  const { error, count } = await supabase
    .from("course_broadcasts")
    .update(
      {
        title,
        body,
        pinned,
        keep_on_duplicate: keepOnDuplicate,
        anchor_event_id: anchorEventId,
        anchor_offset_days: anchorOffsetDays,
      },
      { count: "exact" }
    )
    .eq("id", broadcastId)
    .eq("course_id", trainer.course_id ?? "")
    .is("sent_at", null);

  if (error) {
    // The message above is what the person reads; this is what we read.
    console.error("[portfolio/[traineeId]/stream-actions.ts:editBroadcast]", error);
    return { error: "Could not save the changes." };
  }
  if (count === 0) return { error: "This announcement already sent -- it can no longer be edited." };

  revalidateBroadcastPages();
  return { error: null };
}
