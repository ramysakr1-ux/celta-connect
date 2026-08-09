"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { buildSkeletonEvents, DEFAULT_TEACHING_DAYS } from "@/lib/timetable-skeleton";
import type { TimeBand } from "@/lib/supabase/types";

export interface FormState {
  error: string | null;
}

const EVENT_TYPES = ["input_session", "tp", "assignment_due", "resubmission_due", "milestone"] as const;

export async function addTimetableEvent(_prevState: FormState, formData: FormData): Promise<FormState> {
  const trainer = await requireRole(["trainer", "admin"]);
  if (!trainer.course_id) return { error: "No course assigned." };

  const type = formData.get("type");
  const title = (formData.get("title") as string | null)?.trim();
  const eventDate = formData.get("event_date");
  const eventTime = (formData.get("event_time") as string | null) || null;
  const tag = (formData.get("tag") as string | null)?.trim() || null;
  const zoomUrl = (formData.get("zoom_url") as string | null)?.trim() || null;
  const linkedAssignmentType = (formData.get("linked_assignment_type") as string | null) || null;
  const linkedTpNumberRaw = formData.get("linked_tp_number");
  const linkedTpNumber = linkedTpNumberRaw ? Number(linkedTpNumberRaw) : null;
  const isAsynchronous = formData.get("is_asynchronous") === "on";
  const linkedLiveSessionEventId = (formData.get("linked_live_session_event_id") as string | null) || null;

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
    zoom_url: zoomUrl,
    linked_assignment_type: linkedAssignmentType,
    linked_tp_number: linkedTpNumber && linkedTpNumber >= 1 && linkedTpNumber <= 8 ? linkedTpNumber : null,
    // Only meaningful on input_session rows -- Handbook 2.2: async input
    // needs a real linked live follow-up slot, not free text.
    is_asynchronous: type === "input_session" ? isAsynchronous : false,
    linked_live_session_event_id: type === "input_session" ? linkedLiveSessionEventId : null,
    created_by: trainer.id,
  });

  if (error) return { error: "Could not save the event. It may already be locked." };

  revalidatePath("/trainer/timetable");
  return { error: null };
}

// §1.1a-skel -- "nobody builds a course from a blank grid." Only offered
// (see page.tsx) when the timetable is empty, so this never silently piles
// duplicate events on top of a trainer's real edits -- to regenerate,
// clear the existing events first via the plain list editor.
export async function generateTimetableSkeleton(_prevState: FormState, formData: FormData): Promise<FormState> {
  const trainer = await requireRole(["trainer", "admin"]);
  if (!trainer.course_id) return { error: "No course assigned." };

  const startDate = formData.get("start_date");
  if (typeof startDate !== "string" || !startDate) return { error: "Start date is required." };

  const totalTeachingDaysRaw = Number(formData.get("total_teaching_days"));
  const totalTeachingDays =
    Number.isInteger(totalTeachingDaysRaw) && totalTeachingDaysRaw >= 5 && totalTeachingDaysRaw <= 60
      ? totalTeachingDaysRaw
      : DEFAULT_TEACHING_DAYS;

  const meetingDays = formData
    .getAll("meeting_day")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  if (meetingDays.length === 0) return { error: "Pick at least one day the course meets on." };

  const supabase = await createClient();

  const { count } = await supabase
    .from("course_timetable_events")
    .select("id", { count: "exact", head: true })
    .eq("course_id", trainer.course_id);
  if (count && count > 0) {
    return { error: "The timetable already has events -- clear them first to regenerate the skeleton." };
  }

  const events = buildSkeletonEvents(startDate, totalTeachingDays, meetingDays).map((event) => ({
    ...event,
    course_id: trainer.course_id!,
    created_by: trainer.id,
  }));

  const { error } = await supabase.from("course_timetable_events").insert(events);
  if (error) return { error: "Could not generate the skeleton. It may already be locked." };

  revalidatePath("/trainer/timetable");
  return { error: null };
}

export async function deleteTimetableEvent(formData: FormData): Promise<void> {
  const trainer = await requireRole(["trainer", "admin"]);
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

// Attendance is tracked per TP-type timetable event (migration 0030) --
// this syncs the full set of "attended" volunteer_students for one event to
// whichever checkboxes were checked, rather than toggling one at a time.
export async function setAttendance(formData: FormData): Promise<void> {
  const trainer = await requireRole(["trainer", "admin"]);
  const eventId = formData.get("event_id");
  if (typeof eventId !== "string") return;

  const supabase = await createClient();
  const { data: event } = await supabase
    .from("course_timetable_events")
    .select("id")
    .eq("id", eventId)
    .eq("course_id", trainer.course_id ?? "")
    .maybeSingle();
  if (!event) return;

  const attendedIds = formData.getAll("attended_volunteer_id").filter((v): v is string => typeof v === "string");

  await supabase.from("volunteer_attendance").delete().eq("timetable_event_id", eventId);
  if (attendedIds.length > 0) {
    await supabase.from("volunteer_attendance").insert(
      attendedIds.map((volunteerStudentId) => ({
        volunteer_student_id: volunteerStudentId,
        timetable_event_id: eventId,
        marked_by: trainer.id,
      }))
    );
  }

  revalidatePath("/trainer/timetable");
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// §2 -- daily time-band structure, editable per course instead of the one
// hardcoded shape every course used to share (see DEFAULT_TIME_BANDS in
// timetable-grid.ts). Bands are stored in course order (courses.time_bands)
// and must be non-overlapping and ascending -- bandIndexFor()/buildDayRows()
// bucket events into whichever band their time falls in, so a malformed
// band list would silently misfile events across the whole grid.
export async function setTimeBands(_prevState: FormState, formData: FormData): Promise<FormState> {
  const trainer = await requireRole(["trainer", "admin"]);
  if (!trainer.course_id) return { error: "No course assigned." };

  const starts = formData.getAll("band_start").map(String);
  const ends = formData.getAll("band_end").map(String);
  if (starts.length === 0 || starts.length !== ends.length) {
    return { error: "Add at least one time band." };
  }
  if (starts.length > 12) return { error: "Too many time bands -- 12 is the practical limit for the grid." };

  const bands: TimeBand[] = [];
  for (let i = 0; i < starts.length; i += 1) {
    const start = starts[i];
    const end = ends[i];
    if (!TIME_RE.test(start) || !TIME_RE.test(end)) return { error: `Band ${i + 1}: enter valid times (HH:MM).` };
    if (start >= end) return { error: `Band ${i + 1}: end time must be after its start time.` };
    if (i > 0 && start < bands[i - 1].end) {
      return { error: `Band ${i + 1} overlaps the one before it -- bands must run in order.` };
    }
    bands.push({ start, end, label: `${start}–${end}` });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("courses").update({ time_bands: bands }).eq("id", trainer.course_id);
  if (error) return { error: "Could not save the time bands." };

  revalidatePath("/trainer/timetable");
  return { error: null };
}

export async function resetTimeBands(): Promise<void> {
  const trainer = await requireRole(["trainer", "admin"]);
  if (!trainer.course_id) return;

  const supabase = await createClient();
  await supabase.from("courses").update({ time_bands: null }).eq("id", trainer.course_id);
  revalidatePath("/trainer/timetable");
}

export async function setTimetableLock(formData: FormData): Promise<void> {
  const trainer = await requireRole(["trainer", "admin"]);
  if (!trainer.course_id) return;
  const lock = formData.get("lock") === "true";

  const supabase = await createClient();

  // remaining-compliance.md item 3: refuse (not warn) locking the
  // timetable while an asynchronous input session has no linked live
  // follow-up slot -- this is one of the rules an assessor checks directly
  // on any course with an online element.
  if (lock) {
    const { data: unlinkedAsync } = await supabase
      .from("course_timetable_events")
      .select("id")
      .eq("course_id", trainer.course_id)
      .eq("type", "input_session")
      .eq("is_asynchronous", true)
      .is("linked_live_session_event_id", null)
      .limit(1);
    if (unlinkedAsync && unlinkedAsync.length > 0) {
      redirect("/trainer/timetable?lock_error=async_missing_link");
    }
  }

  await supabase
    .from("courses")
    .update({ timetable_locked_at: lock ? new Date().toISOString() : null })
    .eq("id", trainer.course_id);

  revalidatePath("/trainer/timetable");
}
