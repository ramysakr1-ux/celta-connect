"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { isMctOnCourse } from "@/lib/course-mct";
import { buildSkeletonEvents, DEFAULT_TEACHING_DAYS, PART_TIME_SKELETON } from "@/lib/timetable-skeleton";
import { CELTA_CRITERIA_CODES } from "@/lib/celta-criteria";
import { generateStandardAnnouncements } from "@/lib/announcements-catalog";
import { syncAssignmentDueDates } from "@/lib/assignment-due-dates";
import { halfTpDates, distinctTpDates, checkIntensiveTpBreaks } from "@/lib/rotation";
import { sendPushToOwners } from "@/lib/push/send";
import { extractZoomMeetingId } from "@/lib/zoom/meeting-id";
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

// Ramy, 2026-08-23: "ACT... doesn't need to make changes to the timetable
// so they don't need to see those options" -- MCT-only editing, mirroring
// the celta5-actions.ts grade-approval gates' isMctOnCourse() pattern.
// Admins keep full access, same as every other role check in this file.
const NOT_MCT_ERROR = "Only the main course tutor can edit the timetable.";

async function requireTimetableEditAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  trainer: { role: string; id: string; course_id: string | null }
): Promise<boolean> {
  if (trainer.role === "admin" || !trainer.course_id) return true;
  return isMctOnCourse(supabase, trainer.course_id, trainer.id);
}

export async function addTimetableEvent(_prevState: FormState, formData: FormData): Promise<FormState> {
  const trainer = await requireRole(["trainer", "admin"]);
  if (!trainer.course_id) return { error: "No course assigned." };
  const supabase = await createClient();
  if (!(await requireTimetableEditAccess(supabase, trainer))) return { error: NOT_MCT_ERROR };

  const type = formData.get("type");
  const title = (formData.get("title") as string | null)?.trim();
  const eventDate = formData.get("event_date");
  const eventTime = (formData.get("event_time") as string | null) || null;
  const tag = (formData.get("tag") as string | null)?.trim() || null;
  const detail = (formData.get("detail") as string | null)?.trim() || null;
  const zoomUrl = (formData.get("zoom_url") as string | null)?.trim() || null;
  const linkedAssignmentType = (formData.get("linked_assignment_type") as string | null) || null;
  const linkedTpNumberRaw = formData.get("linked_tp_number");
  const linkedTpNumber = linkedTpNumberRaw ? Number(linkedTpNumberRaw) : null;
  const isAsynchronous = formData.get("is_asynchronous") === "on";
  const linkedLiveSessionEventId = (formData.get("linked_live_session_event_id") as string | null) || null;
  const tpGroupScopeId = (formData.get("tp_group_scope_id") as string | null) || null;
  const sharesMaterials = formData.get("shares_materials") === "on";

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

  const { error } = await supabase.from("course_timetable_events").insert({
    course_id: trainer.course_id,
    type: type as (typeof EVENT_TYPES)[number],
    title,
    event_date: eventDate,
    event_time: eventTime,
    tag,
    detail,
    zoom_url: zoomUrl,
    zoom_meeting_id: extractZoomMeetingId(zoomUrl),
    linked_assignment_type: linkedAssignmentType,
    linked_tp_number: linkedTpNumber && linkedTpNumber >= 1 && linkedTpNumber <= 8 ? linkedTpNumber : null,
    // Only meaningful on input_session rows -- Handbook 3.4: async input
    // needs a real linked live follow-up slot, not free text.
    is_asynchronous: type === "input_session" ? isAsynchronous : false,
    linked_live_session_event_id: type === "input_session" ? linkedLiveSessionEventId : null,
    input_session_criteria: type === "input_session" ? parseCriteriaCodes(formData.get("input_session_criteria") as string | null) : [],
    // Only meaningful on assignment_due -- a second row for the same
    // assignment_type on a different date, one per staggered group.
    tp_group_scope_id: type === "assignment_due" ? tpGroupScopeId : null,
    // TP already has its own materials system (tp_materials); this flag is
    // only meaningful for everything else on the timetable, and only when
    // a trainer explicitly opts in -- "I don't want it to read lunch for
    // the trainees" (Ramy, 25 Aug 2026), so the session-materials pickers
    // don't have to guess from type/title.
    shares_materials: type !== "tp" ? sharesMaterials : false,
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
  if (!(await requireTimetableEditAccess(supabase, trainer))) return;
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

// Timetable View (standalone).html's per-card subtitle -- display-only free
// text, any event type (unlike input_session-only criteria above).
export async function setEventDetail(formData: FormData): Promise<void> {
  const trainer = await requireRole(["trainer", "admin"]);
  if (!trainer.course_id) return;

  const eventId = formData.get("event_id");
  if (typeof eventId !== "string") return;

  const supabase = await createClient();
  if (!(await requireTimetableEditAccess(supabase, trainer))) return;
  const { data: event } = await supabase
    .from("course_timetable_events")
    .select("id, course_id")
    .eq("id", eventId)
    .maybeSingle();
  if (!event || event.course_id !== trainer.course_id) return;

  const detail = (formData.get("detail") as string | null)?.trim() || null;
  await supabase.from("course_timetable_events").update({ detail }).eq("id", eventId);

  revalidatePath("/trainer/timetable");
}

// specs/course-modes.md §2/§4, mixed-mode delivery: which mode this TP
// round is in. Manual per-round tag (Ramy, 2026-08-19) -- only meaningful
// on a mixed-mode course, but not enforced here since a course changing
// delivery_mode after rounds are tagged shouldn't silently wipe data.
export async function setTpEventMode(formData: FormData): Promise<void> {
  const trainer = await requireRole(["trainer", "admin"]);
  if (!trainer.course_id) return;

  const eventId = formData.get("event_id");
  const mode = formData.get("mode");
  if (typeof eventId !== "string") return;
  if (mode !== "f2f" && mode !== "online" && mode !== "") return;

  const supabase = await createClient();
  if (!(await requireTimetableEditAccess(supabase, trainer))) return;
  const { data: event } = await supabase
    .from("course_timetable_events")
    .select("id, course_id, type")
    .eq("id", eventId)
    .maybeSingle();
  if (!event || event.course_id !== trainer.course_id || event.type !== "tp") return;

  await supabase
    .from("course_timetable_events")
    .update({ mode: mode === "" ? null : mode })
    .eq("id", eventId);

  revalidatePath("/trainer/timetable");
}

// §1.1a-skel -- "nobody builds a course from a blank grid." Only offered
// (see page.tsx) when the timetable is empty, so this never silently piles
// duplicate events on top of a trainer's real edits -- to regenerate,
// clear the existing events first via the plain list editor.
export async function generateTimetableSkeleton(_prevState: FormState, formData: FormData): Promise<FormState> {
  const trainer = await requireRole(["trainer", "admin"]);
  if (!trainer.course_id) return { error: "No course assigned." };
  const supabase = await createClient();
  if (!(await requireTimetableEditAccess(supabase, trainer))) return { error: NOT_MCT_ERROR };

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

  // The one point in the app where full-time vs part-time is ever actually
  // chosen -- persisted here so it survives past this one form (see
  // migration 0172's own comment for why this didn't already exist).
  await supabase.from("courses").update({ is_part_time: shape === "part_time" }).eq("id", trainer.course_id);

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
  if (!(await requireTimetableEditAccess(supabase, trainer))) return { error: NOT_MCT_ERROR };
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
  if (!(await requireTimetableEditAccess(supabase, trainer))) return;
  await supabase
    .from("course_timetable_events")
    .delete()
    .eq("id", eventId)
    .eq("course_id", trainer.course_id ?? "");

  revalidatePath("/trainer/timetable");
}

const CANCEL_EVENT_TYPE_LABEL: Record<(typeof EVENT_TYPES)[number], string> = {
  input_session: "Input session",
  tp: "TP",
  assignment_due: "Assignment deadline",
  resubmission_due: "Resubmission deadline",
  milestone: "Session",
  supervised_session: "Supervised session",
};

// individual-tutorial-actions.ts's cancelIndividualTutorialInvite left this
// deliberately unbuilt (2026-08-19): "there's no general 'cancel a TP'
// anywhere in the app... deliberately scoped to individual tutorial
// cancellation specifically, not a general timetable-cancellation push."
// The missing piece was a real cancel action distinct from delete -- plain
// deleteTimetableEvent has no confirm step and is also how a trainer fixes
// a typo (delete + re-add, since there's no generic edit), so hanging a
// push off every delete would push "cancelled" on ordinary corrections too.
// This is that missing real feature: a separate, explicit action a trainer
// chooses only when they mean it, per for-claude-code-announcements.md's
// "push notification only for cancellation, room change, or something
// already late." Cohort-wide (not group-scoped) because tp-type timetable
// events carry no subgroup column -- only assignment_due rows ever get
// tp_group_scope_id (see addTimetableEvent above).
export async function cancelTimetableEvent(formData: FormData): Promise<void> {
  const trainer = await requireRole(["trainer", "admin"]);
  const eventId = formData.get("event_id");
  if (typeof eventId !== "string") return;

  const supabase = await createClient();
  if (!(await requireTimetableEditAccess(supabase, trainer))) return;
  const { data: event } = await supabase
    .from("course_timetable_events")
    .select("id, title, type, event_date, event_time")
    .eq("id", eventId)
    .eq("course_id", trainer.course_id ?? "")
    .maybeSingle();
  if (!event) return;

  await supabase
    .from("course_timetable_events")
    .delete()
    .eq("id", eventId)
    .eq("course_id", trainer.course_id ?? "");

  const { data: cohort } = await supabase
    .from("profiles")
    .select("id")
    .eq("course_id", trainer.course_id ?? "")
    .eq("role", "trainee")
    .eq("course_status", "active");

  const profileIds = (cohort ?? []).map((p) => p.id);
  if (profileIds.length > 0) {
    const label = CANCEL_EVENT_TYPE_LABEL[event.type as (typeof EVENT_TYPES)[number]] ?? "Session";
    const dateLabel = new Date(`${event.event_date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
    await sendPushToOwners(
      { profileIds },
      {
        title: `${label} cancelled`,
        body: `"${event.title}" on ${dateLabel} has been cancelled.`,
        url: "/dashboard",
      }
    );
  }

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
  const accessCheckClient = await createClient();
  if (!(await requireTimetableEditAccess(accessCheckClient, trainer))) return { error: NOT_MCT_ERROR };

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

  const { error } = await accessCheckClient.from("courses").update({ time_bands: bands }).eq("id", trainer.course_id);
  if (error) return { error: "Could not save the time bands." };

  revalidatePath("/trainer/timetable");
  return { error: null };
}

export async function resetTimeBands(): Promise<void> {
  const trainer = await requireRole(["trainer", "admin"]);
  if (!trainer.course_id) return;

  const supabase = await createClient();
  if (!(await requireTimetableEditAccess(supabase, trainer))) return;
  await supabase.from("courses").update({ time_bands: null }).eq("id", trainer.course_id);
  revalidatePath("/trainer/timetable");
}

export async function setTimetableLock(formData: FormData): Promise<void> {
  const trainer = await requireRole(["trainer", "admin"]);
  if (!trainer.course_id) return;
  const lock = formData.get("lock") === "true";

  const supabase = await createClient();
  if (!(await requireTimetableEditAccess(supabase, trainer))) return;

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

    // build-spec.md compliance-audit item 1 (Handbook 9.1.3): "A candidate
    // cannot teach twice in one day." Under correct rotation (rotation.ts'
    // distinctTpDates/halfTpDates), one calendar date hosts exactly one TP
    // round -- one half teaching, the other not. That invariant can only be
    // broken by a manual override landing two different TP rounds on the
    // same date, which is exactly the case rotation.ts' own deduplicated
    // date list can't see (a Set silently merges same-date rows) -- so this
    // checks the RAW events directly rather than through that helper. Two
    // tp events sharing a date means whichever half owns both is being
    // asked to teach twice that day.
    const { data: tpEvents } = await supabase
      .from("course_timetable_events")
      .select("event_date, mode")
      .eq("course_id", trainer.course_id)
      .eq("type", "tp");
    const tpDateCounts = new Map<string, number>();
    for (const e of tpEvents ?? []) {
      tpDateCounts.set(e.event_date, (tpDateCounts.get(e.event_date) ?? 0) + 1);
    }
    const doubleBookedDate = [...tpDateCounts.entries()].find(([, count]) => count > 1)?.[0];
    if (doubleBookedDate) {
      redirect(`/trainer/timetable?lock_error=tp_double_booked&date=${doubleBookedDate}`);
    }

    // course-modes.md §1 (Handbook 3.5), the last piece of delivery-
    // mode.ts's "not yet built" list: "A TP group teaches in only one mode
    // at a time... never a mix inside one group at one stage." Checked per
    // half (each half's own ordered TP rounds, via rotation.ts'
    // halfTpDates) rather than across the whole course, since the two
    // halves run their own independent f2f/online split. Only the rounds
    // someone has actually tagged a mode on are checked -- an untagged
    // round can't yet violate anything, and requiring every round tagged
    // before ANY course can lock would block courses that aren't
    // mixed-mode at all. More than one switch means the block isn't clean.
    const { data: courseForMode } = await supabase.from("courses").select("delivery_mode").eq("id", trainer.course_id).maybeSingle();
    if (courseForMode?.delivery_mode === "mixed") {
      const modeByDate = new Map((tpEvents ?? []).map((e) => [e.event_date, e.mode]));
      for (const halfOrder of [1, 2] as const) {
        const modes = halfTpDates(tpEvents ?? [], halfOrder)
          .map((d) => modeByDate.get(d))
          .filter((m): m is "f2f" | "online" => m === "f2f" || m === "online");
        let switches = 0;
        for (let i = 1; i < modes.length; i += 1) {
          if (modes[i] !== modes[i - 1]) switches += 1;
        }
        if (switches > 1) {
          redirect(`/trainer/timetable?lock_error=mode_not_blocked&half=${halfOrder}`);
        }
      }
    }

    // connect-spec-corrections-for-claude-code.md item 2 (Handbook 9.1.3):
    // "no more than 6 consecutive days of TP before the break" -- refuse,
    // not just the rotation page's existing advisory display
    // (checkIntensiveTpBreaks was already computing this, just never
    // gated locking on it).
    const breakCheck = checkIntensiveTpBreaks(distinctTpDates(tpEvents ?? []));
    if (breakCheck.exceedsMaxConsecutive) {
      redirect(`/trainer/timetable?lock_error=intensive_no_break&run=${breakCheck.longestConsecutiveRun}`);
    }
  }

  await supabase
    .from("courses")
    .update({ timetable_locked_at: lock ? new Date().toISOString() : null })
    .eq("id", trainer.course_id);

  // design_handoff_timetable_decisions: due dates are resolved from the
  // real TP rotation, not a fixed weekday -- locking is the natural point
  // to fix them, same moment the comment below already treats "assignment
  // due dates etc." as settled. Runs before the announcements below, which
  // reference these dates.
  if (lock) {
    await syncAssignmentDueDates(supabase, trainer.course_id);
  }

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

// Manual safety net alongside the automatic lock/pairing-change hooks
// (syncAssignmentDueDates' other two call sites) -- covers any edge case
// those don't, e.g. a course whose timetable was locked before this
// feature existed.
export async function recomputeAssignmentDueDates(): Promise<void> {
  const trainer = await requireRole(["trainer", "admin"]);
  if (!trainer.course_id) return;

  const supabase = await createClient();
  if (!(await requireTimetableEditAccess(supabase, trainer))) return;
  await syncAssignmentDueDates(supabase, trainer.course_id);
  revalidatePath("/trainer/timetable");
  revalidatePath("/trainer/roster");
}

// zoom-auto-attendance.md §4/§5: resolving one row from the "needs review"
// list the webhook couldn't confidently match on its own. Same access level
// as setAttendance (not MCT-gated) -- this is still register-taking, just
// confirming who a Zoom participant was, not a timetable edit.
export async function resolveZoomParticipant(formData: FormData): Promise<void> {
  const trainer = await requireRole(["trainer", "admin"]);
  const unmatchedId = formData.get("unmatched_id");
  const volunteerStudentId = (formData.get("volunteer_student_id") as string | null) || null;
  if (typeof unmatchedId !== "string") return;

  const supabase = await createClient();
  const { data: unmatched } = await supabase
    .from("zoom_unmatched_participants")
    .select("id, timetable_event_id, joined_at, left_at")
    .eq("id", unmatchedId)
    .maybeSingle();
  if (!unmatched) return;

  // zoom_unmatched_participants carries no course_id of its own -- confirm
  // via the event it points at rather than trusting a client-supplied id.
  const { data: event } = await supabase
    .from("course_timetable_events")
    .select("id, course_id")
    .eq("id", unmatched.timetable_event_id)
    .maybeSingle();
  if (!event || event.course_id !== trainer.course_id) return;

  if (volunteerStudentId) {
    await supabase.from("volunteer_attendance").upsert(
      {
        volunteer_student_id: volunteerStudentId,
        timetable_event_id: unmatched.timetable_event_id,
        marked_by: trainer.id,
        source: "zoom",
        joined_at: unmatched.joined_at,
        left_at: unmatched.left_at,
      },
      { onConflict: "volunteer_student_id,timetable_event_id" }
    );
  }

  await supabase
    .from("zoom_unmatched_participants")
    .update({ resolved_at: new Date().toISOString(), resolved_volunteer_student_id: volunteerStudentId, resolved_by: trainer.id })
    .eq("id", unmatchedId);

  revalidatePath("/trainer/timetable");
}
