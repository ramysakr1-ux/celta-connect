"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { buildSkeletonEvents, DEFAULT_TEACHING_DAYS, PART_TIME_SKELETON } from "@/lib/timetable-skeleton";
import { CELTA_CRITERIA_CODES } from "@/lib/celta-criteria";
import { generateStandardAnnouncements } from "@/lib/announcements-catalog";
import type { TimeBand } from "@/lib/supabase/types";

export interface FormState {
  error: string | null;
}

const EVENT_TYPES = ["input_session", "tp", "assignment_due", "resubmission_due", "milestone", "supervised_session"] as const;

// Free-typed, comma/space separated ("4c, 5f") rather than a 41-item picker
// -- this is a one-time data-entry pass against material the trainer
// already knows cold, not a menu they need to browse.
function parseCriteriaCodes(raw: string | null): string[] {
  if (!raw) return [];
  const codes = raw
    .split(/[,\s]+/)
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(codes.filter((c) => (CELTA_CRITERIA_CODES as readonly string[]).includes(c)))];
}

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
  const tpGroupScopeId = (formData.get("tp_group_scope_id") as string | null) || null;

  if (typeof type !== "string" || !EVENT_TYPES.includes(type as (typeof EVENT_TYPES)[number])) {
    return { error: "Invalid event type." };
  }
  if (!title) return { error: "Title is required." };
  // for-claude-code-supervised-review.md: "Never leave a bare 'Self-study'
  // label anywhere on the timetable going forward." A real submit-and-check
  // structure is what earns the "Supervised review"/"[X] writing" naming --
  // this is a naming guardrail, not a promise that the event itself has
  // that structure (a trainer could still create a genuine unsupervised
  // self-study slot, they just can't call it "self-study" and expect it to
  // read as contact time).
  if (/self.?study/i.test(title)) {
    return {
      error: 'Use "Supervised review" or "[assignment] writing" instead of "Self-study" -- only sessions with a real submit-and-check count as contact time.',
    };
  }
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
    input_session_criteria: type === "input_session" ? parseCriteriaCodes(formData.get("input_session_criteria") as string | null) : [],
    // Only meaningful on assignment_due -- a second row for the same
    // assignment_type on a different date, one per staggered group.
    tp_group_scope_id: type === "assignment_due" ? tpGroupScopeId : null,
    created_by: trainer.id,
  });

  if (error) return { error: "Could not save the event. It may already be locked." };

  revalidatePath("/trainer/timetable");
  return { error: null };
}

// specs/build-spec.md "Peer observation" -- lets a trainer annotate an
// input session ALREADY on the timetable with the criteria it covers,
// since most input sessions predate this feature and won't get recreated
// just to add it. No general event-editor exists (or is needed) -- this
// is narrowly scoped to the one field.
export async function setInputSessionCriteria(formData: FormData): Promise<void> {
  const trainer = await requireRole(["trainer", "admin"]);
  if (!trainer.course_id) return;

  const eventId = formData.get("event_id");
  if (typeof eventId !== "string") return;

  const supabase = await createClient();
  const { data: event } = await supabase
    .from("course_timetable_events")
    .select("id, course_id, type")
    .eq("id", eventId)
    .maybeSingle();
  if (!event || event.course_id !== trainer.course_id || event.type !== "input_session") return;

  const codes = parseCriteriaCodes(formData.get("input_session_criteria") as string | null);
  await supabase.from("course_timetable_events").update({ input_session_criteria: codes }).eq("id", eventId);

  revalidatePath("/trainer/timetable");
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

  // Part-time's rhythm is qualitatively different (two independent,
  // unpaired TP groups on their own fixed weekday each, not one group
  // split into daily-alternating halves) -- a distinct draft array, not
  // just a different day count/pattern on the standard one.
  const shape = formData.get("shape");
  const skeletonDrafts = shape === "part_time" ? PART_TIME_SKELETON : undefined;

  const supabase = await createClient();

  const { count } = await supabase
    .from("course_timetable_events")
    .select("id", { count: "exact", head: true })
    .eq("course_id", trainer.course_id);
  if (count && count > 0) {
    return { error: "The timetable already has events -- clear them first to regenerate the skeleton." };
  }

  const events = buildSkeletonEvents(startDate, totalTeachingDays, meetingDays, skeletonDrafts).map((event) => ({
    ...event,
    course_id: trainer.course_id!,
    created_by: trainer.id,
  }));

  const { error } = await supabase.from("course_timetable_events").insert(events);
  if (error) return { error: "Could not generate the skeleton. It may already be locked." };

  revalidatePath("/trainer/timetable");
  return { error: null };
}

// for-claude-code-timetable-drag.md -- dropping a tile on a clean target day
// applies immediately (no confirm), same trust level as any other edit here.
// Only the date moves; time/tag/everything else about the event is
// untouched. RLS already refuses this the same way it refuses insert/delete
// once timetable_locked_at is set (see addTimetableEvent's own comment) --
// no separate app-level lock check needed here.
export async function moveTimetableEvent(eventId: string, newDate: string): Promise<{ error: string | null }> {
  const trainer = await requireRole(["trainer", "admin"]);
  if (!trainer.course_id) return { error: "No course assigned." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("course_timetable_events")
    .update({ event_date: newDate })
    .eq("id", eventId)
    .eq("course_id", trainer.course_id);

  if (error) return { error: "Could not move the event -- the timetable may be locked." };

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

  // Stamped regardless of attendee count -- this is what tells "logged,
  // zero present" apart from "never logged" (for-claude-code-announcement-
  // infra-fixes.md item 2). Before this column, both looked identical: zero
  // volunteer_attendance rows for the event either way.
  await supabase.from("course_timetable_events").update({ register_submitted_at: new Date().toISOString() }).eq("id", eventId);

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

  // for-claude-code-announcements-list.md table A: the standard reminder
  // set fires "the moment the timetable is published" -- generated here,
  // once, idempotently (source_key) rather than re-derived by a cron every
  // day, since the anchors themselves (assignment due dates etc.) are
  // already fixed the moment the timetable locks.
  if (lock) {
    await generateStandardAnnouncements(supabase, trainer.course_id, trainer.id);
  }

  revalidatePath("/trainer/timetable");
  revalidatePath("/trainer/announcements");
}
