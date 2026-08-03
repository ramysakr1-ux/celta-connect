"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

export interface FormState {
  error: string | null;
}

export async function postBroadcast(
  traineeId: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const trainer = await requireRole("trainer");
  if (!trainer.course_id) return { error: "No course assigned." };

  const title = (formData.get("title") as string | null)?.trim();
  const body = (formData.get("body") as string | null)?.trim() || null;
  const zoomUrl = (formData.get("zoom_url") as string | null)?.trim() || null;
  const zoomTime = (formData.get("zoom_time") as string | null) || null;
  const attachmentName = (formData.get("attachment_name") as string | null)?.trim() || null;
  const attachmentUrl = (formData.get("attachment_url") as string | null)?.trim() || null;
  const linkedTimetableEventId = (formData.get("linked_timetable_event_id") as string | null) || null;
  const pinned = formData.get("pinned") === "on";

  if (!title) return { error: "Title is required." };

  const supabase = await createClient();
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
  });

  if (error) return { error: "Could not post the announcement." };

  revalidatePath(`/portfolio/${traineeId}`);
  return { error: null };
}

export async function deleteBroadcast(formData: FormData): Promise<void> {
  const trainer = await requireRole("trainer");
  const broadcastId = formData.get("broadcast_id");
  const traineeId = formData.get("trainee_id");
  if (typeof broadcastId !== "string" || typeof traineeId !== "string") return;

  const supabase = await createClient();
  await supabase
    .from("course_broadcasts")
    .delete()
    .eq("id", broadcastId)
    .eq("course_id", trainer.course_id ?? "");

  revalidatePath(`/portfolio/${traineeId}`);
}
