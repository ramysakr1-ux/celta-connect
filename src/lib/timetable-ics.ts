import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TimeBand } from "@/lib/supabase/types";
import { getCachedCenter } from "@/lib/supabase/cached-queries";
import { bandIndexFor, resolveTimeBands, zonedTimeToUtc, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";
import { oneTpCardPerSlot } from "@/lib/timetable-one-per-slot";

// One course timetable, as a calendar file. Written once and shared by the
// candidate's "Add to my calendar" and the tutor's own link (Ramy, 14 Sep
// 2026: "give the tutor the calendar link and a print view") -- two doors to
// the same schedule should not be two implementations of it.

function icsEscape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

// A timestamp with no zone and no trailing Z is a "floating" time: every
// calendar app reads it in the READER's own timezone. So anyone who added
// this feed from outside the centre's own zone had every session at the
// wrong hour -- and the centre's timezone is real data here
// (centers.time_zone), not an assumption. Emitted in UTC instead, which no
// client can misread and which needs no VTIMEZONE block.
function toUtcStamp(instant: Date): string {
  return `${instant.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;
}

interface IcsEvent {
  id: string;
  title: string;
  event_date: string;
  event_time: string | null;
  detail?: string | null;
}

/** The calendar text for a set of events, in the centre's own timezone. */
export function buildTimetableIcs(events: IcsEvent[], timeZone: string, timeBands: TimeBand[]): string {
  const stampNow = toUtcStamp(new Date());
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Connect//Course Timetable//EN", "CALSCALE:GREGORIAN"];
  for (const e of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${e.id}@celtaconnect`);
    lines.push(`DTSTAMP:${stampNow}`);
    if (!e.event_time) {
      lines.push(`DTSTART;VALUE=DATE:${e.event_date.replace(/-/g, "")}`);
    } else {
      // The session's real length is its band's, the same source the grid
      // draws from. Every event used to be exactly an hour, which also made
      // an event starting at 23:30 end at 00:30 on the SAME date -- a
      // negative-length entry some clients drop outright.
      const startsAt = zonedTimeToUtc(e.event_date, e.event_time, timeZone);
      const band = timeBands[bandIndexFor(e.event_time, timeBands)];
      const bandEnd = band ? zonedTimeToUtc(e.event_date, band.end, timeZone) : null;
      const endsAt = bandEnd && bandEnd.getTime() > startsAt.getTime() ? bandEnd : new Date(startsAt.getTime() + 60 * 60 * 1000);
      lines.push(`DTSTART:${toUtcStamp(startsAt)}`);
      lines.push(`DTEND:${toUtcStamp(endsAt)}`);
    }
    lines.push(`SUMMARY:${icsEscape(e.title)}`);
    if (e.detail) lines.push(`DESCRIPTION:${icsEscape(e.detail)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

/** Reads one course's timetable and returns it as a calendar file's text. */
export async function courseTimetableIcs(
  supabase: SupabaseClient<Database>,
  courseId: string,
  /** The reader's own TP group(s), so their calendar carries their lessons. */
  viewerGroupIds: Set<string> | null = null
): Promise<string> {
  const [{ data: events }, { data: course }] = await Promise.all([
    supabase
      .from("course_timetable_events")
      .select("id, type, title, event_date, event_time, detail, tp_group_scope_id")
      .eq("course_id", courseId)
      .order("event_date"),
    supabase.from("courses").select("center_id, time_bands").eq("id", courseId).maybeSingle(),
  ]);
  const timeZone = (course?.center_id ? await getCachedCenter(course.center_id) : null)?.time_zone ?? DEFAULT_TIMEZONE;
  // One entry per TP slot, the same rule the board draws by -- a calendar
  // with every lesson twice is the doubling again, in the download.
  return buildTimetableIcs(oneTpCardPerSlot(events ?? [], viewerGroupIds), timeZone, resolveTimeBands(course?.time_bands));
}

/** The TP group a candidate belongs to, for the rule above. */
export async function tpGroupIdForTrainee(supabase: SupabaseClient<Database>, traineeId: string): Promise<string | null> {
  const { data: member } = await supabase.from("course_subgroup_members").select("subgroup_id").eq("trainee_id", traineeId).maybeSingle();
  if (!member) return null;
  const { data: subgroup } = await supabase.from("course_subgroups").select("tp_group_id").eq("id", member.subgroup_id).maybeSingle();
  return subgroup?.tp_group_id ?? null;
}

/** The TP group(s) a tutor runs. */
export async function tpGroupIdsForTutor(supabase: SupabaseClient<Database>, courseId: string, profileId: string): Promise<Set<string>> {
  const { data: groups } = await supabase.from("course_tp_groups").select("id").eq("course_id", courseId).eq("tutor_profile_id", profileId);
  return new Set((groups ?? []).map((g) => g.id));
}

/** `Content-Disposition` for a download named after whoever asked for it. */
export function icsFilename(name: string): string {
  return `attachment; filename="${name.replace(/[^a-z0-9]/gi, "-")}-timetable.ics"`;
}
