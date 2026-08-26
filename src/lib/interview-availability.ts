import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { toLocalIso, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";

export interface AvailabilityPattern {
  interviewer_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  mode: "online" | "face_to_face";
}

export interface AvailabilityBlock {
  interviewer_id: string | null;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
}

export interface GenerationSettings {
  slotMinutes: number;
  gapMinutes: number;
  weeksAhead: number;
  cutoffHours: number;
}

export interface GeneratedSlot {
  slot_date: string;
  slot_time: string;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}
function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}
function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}
function weekdayOf(dateIso: string): number {
  const [y, m, d] = dateIso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function isBlocked(interviewerId: string, dateIso: string, timeStr: string, blocks: AvailabilityBlock[]): boolean {
  const minutes = timeToMinutes(timeStr);
  return blocks.some((b) => {
    if (b.interviewer_id !== null && b.interviewer_id !== interviewerId) return false;
    if (dateIso < b.start_date || dateIso > b.end_date) return false;
    if (b.start_time === null || b.end_time === null) return true;
    return minutes >= timeToMinutes(b.start_time) && minutes < timeToMinutes(b.end_time);
  });
}

// Interview Availability.dc.html: "Slots are generated from a rule, not
// typed in every week." One pattern row -> every bookable slot it produces
// over the next `weeksAhead` weeks, stepped by slot length + gap ("plus a
// ten-minute gap, so an overrun does not push into the next applicant"),
// skipping anything inside a block or before the 24h-style booking cut-off
// ("nothing is bookable for tomorrow morning -- an interviewer needs the
// evening to read the task").
export function computeGeneratedSlots(
  pattern: AvailabilityPattern,
  settings: GenerationSettings,
  blocks: AvailabilityBlock[],
  now: Date,
  timeZone: string
): GeneratedSlot[] {
  const step = settings.slotMinutes + settings.gapMinutes;
  const startMin = timeToMinutes(pattern.start_time);
  const endMin = timeToMinutes(pattern.end_time);
  const cutoff = new Date(now.getTime() + settings.cutoffHours * 60 * 60 * 1000);

  const todayIso = toLocalIso(now, timeZone);
  const horizonIso = addDaysIso(todayIso, settings.weeksAhead * 7);

  const slots: GeneratedSlot[] = [];
  for (let dateIso = todayIso; dateIso <= horizonIso; dateIso = addDaysIso(dateIso, 1)) {
    if (weekdayOf(dateIso) !== pattern.weekday) continue;
    for (let mins = startMin; mins + settings.slotMinutes <= endMin; mins += step) {
      const timeStr = minutesToTime(mins);
      const slotStart = new Date(`${dateIso}T${timeStr}`);
      if (slotStart < cutoff) continue;
      if (isBlocked(pattern.interviewer_id, dateIso, timeStr, blocks)) continue;
      slots.push({ slot_date: dateIso, slot_time: timeStr });
    }
  }
  return slots;
}

export interface RegenerateResult {
  error?: string;
  created?: number;
}

// "Change the pattern and every unbooked slot regenerates; slots already
// booked stay exactly where they are." Deletes this interviewer's future
// unbooked slots and recreates them fresh from their current active
// pattern(s) -- simpler and more honest than trying to diff old vs new.
//
// interview_slots.intake_course_id is NOT NULL on an existing, live table
// (migration 0081) -- rather than a breaking schema change to make it
// nullable, a generated slot is created once per currently
// accepting_applications intake at the centre (typically one), matching
// how the existing by-hand creation form already asks "which intake" per
// slot.
export async function regenerateSlotsForInterviewer(
  supabase: SupabaseClient<Database>,
  centerId: string,
  interviewerId: string
): Promise<RegenerateResult> {
  const [{ data: center }, { data: patterns }, { data: blocks }, { data: openIntakes }] = await Promise.all([
    supabase
      .from("centers")
      .select("interview_slot_minutes, interview_gap_minutes, interview_weeks_ahead, interview_cutoff_hours, time_zone")
      .eq("id", centerId)
      .maybeSingle(),
    supabase.from("interview_availability_patterns").select("*").eq("interviewer_id", interviewerId).eq("active", true),
    supabase.from("interview_blocks").select("*").eq("center_id", centerId).or(`interviewer_id.eq.${interviewerId},interviewer_id.is.null`),
    supabase.from("courses").select("id").eq("center_id", centerId).eq("accepting_applications", true),
  ]);
  if (!center) return { error: "Centre not found." };
  if (!openIntakes || openIntakes.length === 0) return { error: "No intake is currently accepting applications." };

  const now = new Date();
  const todayIso = toLocalIso(now, center.time_zone ?? DEFAULT_TIMEZONE);

  const { error: deleteError } = await supabase
    .from("interview_slots")
    .delete()
    .eq("interviewer_id", interviewerId)
    .is("booked_applicant_id", null)
    .gte("slot_date", todayIso);
  if (deleteError) return { error: "Could not clear the old unbooked slots. Try again." };

  const settings: GenerationSettings = {
    slotMinutes: center.interview_slot_minutes,
    gapMinutes: center.interview_gap_minutes,
    weeksAhead: center.interview_weeks_ahead,
    cutoffHours: center.interview_cutoff_hours,
  };

  const rows: Database["public"]["Tables"]["interview_slots"]["Insert"][] = [];
  for (const pattern of patterns ?? []) {
    const slots = computeGeneratedSlots(pattern, settings, blocks ?? [], now, center.time_zone ?? DEFAULT_TIMEZONE);
    for (const s of slots) {
      for (const intake of openIntakes) {
        rows.push({
          center_id: centerId,
          intake_course_id: intake.id,
          interviewer_id: interviewerId,
          slot_date: s.slot_date,
          slot_time: s.slot_time,
          duration_minutes: settings.slotMinutes,
          mode: pattern.mode,
        });
      }
    }
  }

  if (rows.length === 0) return { created: 0 };
  const { error: insertError } = await supabase.from("interview_slots").insert(rows);
  if (insertError) return { error: "Could not create the new slots. Try again." };
  return { created: rows.length };
}
