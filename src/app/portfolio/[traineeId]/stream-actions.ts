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

  // for-claude-code-announcements-list.md table D: "course-wide broadcast:
  // MCT only." Fails OPEN, not closed -- if no main_course_tutor is
  // assigned on this course yet (tutor_role is frequently null on real
  // courses, confirmed in the DB), blocking everyone would leave the
  // course unable to broadcast at all. Admin is never blocked (centre
  // owner). This composer only ever produces course-wide posts today (no
  // group-targeting UI yet), so every call here IS the course-wide case.
  if (trainer.role === "trainer") {
    const { data: mct } = await supabase
      .from("course_tutors")
      .select("profile_id")
      .eq("course_id", trainer.course_id)
      .eq("tutor_role", "main_course_tutor")
      .is("left_at", null)
      .maybeSingle();
    if (mct && mct.profile_id !== trainer.id) {
      return { error: "Course-wide announcements are sent by the main course tutor." };
    }
  }

  const { error } = await supabase.from("course_broadcasts").insert({
    course_id: trainer.course_id,
    author_id: trainer.id,
    title,
    body,
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

  if (error) return { error: "Could not post the announcement." };

  revalidateBroadcastPages();
  return { error: null };
}

export async function deleteBroadcast(formData: FormData): Promise<void> {
  const trainer = await requireRole(["trainer", "admin"]);
  const broadcastId = formData.get("broadcast_id");
  if (typeof broadcastId !== "string") return;

  const supabase = await createClient();
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
  await supabase
    .from("course_broadcasts")
    .update({ sent_at: new Date().toISOString() })
    .eq("id", broadcastId)
    .eq("course_id", trainer.course_id ?? "")
    .is("sent_at", null);

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

  if (error) return { error: "Could not save the changes." };
  if (count === 0) return { error: "This announcement already sent -- it can no longer be edited." };

  revalidateBroadcastPages();
  return { error: null };
}
