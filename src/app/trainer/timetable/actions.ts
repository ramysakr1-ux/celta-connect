"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

export interface FormState {
  error: string | null;
}

const EVENT_TYPES = ["input_session", "tp", "assignment_due", "resubmission_due", "milestone"] as const;

export async function addTimetableEvent(_prevState: FormState, formData: FormData): Promise<FormState> {
  const trainer = await requireRole("trainer");
  if (!trainer.course_id) return { error: "No course assigned." };

  const type = formData.get("type");
  const title = (formData.get("title") as string | null)?.trim();
  const eventDate = formData.get("event_date");
  const eventTime = (formData.get("event_time") as string | null) || null;
  const tag = (formData.get("tag") as string | null)?.trim() || null;
  const linkedAssignmentType = (formData.get("linked_assignment_type") as string | null) || null;
  const linkedTpNumberRaw = formData.get("linked_tp_number");
  const linkedTpNumber = linkedTpNumberRaw ? Number(linkedTpNumberRaw) : null;

  if (typeof type !== "string" || !EVENT_TYPES.includes(type as (typeof EVENT_TYPES)[number])) {
    return { error: "Invalid event type." };
  }
  if (!title) return { error: "Title is required." };
  if (typeof eventDate !== "string" || !eventDate) return { error: "Date is required." };

  const supabase = await createClient();
  const { error } = await supabase.from("course_timetable_events").insert({
    course_id: trainer.course_id,
    type: type as (typeof EVENT_TYPES)[number],
    title,
    event_date: eventDate,
    event_time: eventTime,
    tag,
    linked_assignment_type: linkedAssignmentType,
    linked_tp_number: linkedTpNumber && linkedTpNumber >= 1 && linkedTpNumber <= 8 ? linkedTpNumber : null,
    created_by: trainer.id,
  });

  if (error) return { error: "Could not save the event. It may already be locked." };

  revalidatePath("/trainer/timetable");
  return { error: null };
}

export async function deleteTimetableEvent(formData: FormData): Promise<void> {
  const trainer = await requireRole("trainer");
  const eventId = formData.get("event_id");
  if (typeof eventId !== "string") return;

  const supabase = await createClient();
  await supabase
    .from("course_timetable_events")
    .delete()
    .eq("id", eventId)
    .eq("course_id", trainer.course_id ?? "");

  revalidatePath("/trainer/timetable");
}

export async function setTimetableLock(formData: FormData): Promise<void> {
  const trainer = await requireRole("trainer");
  if (!trainer.course_id) return;
  const lock = formData.get("lock") === "true";

  const supabase = await createClient();
  await supabase
    .from("courses")
    .update({ timetable_locked_at: lock ? new Date().toISOString() : null })
    .eq("id", trainer.course_id);

  revalidatePath("/trainer/timetable");
}
