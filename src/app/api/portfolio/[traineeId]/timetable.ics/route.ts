import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCachedCenter } from "@/lib/supabase/cached-queries";
import { bandIndexFor, resolveTimeBands, zonedTimeToUtc, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";

// for-claude-code-trainee-interface.md's Timetable tab "Add to my
// calendar" action. Trainee-self, staff, or assessor can all fetch this --
// it's a read-only export of the same course-wide timetable those roles
// already see on-screen, not private data.
function icsEscape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function toIcsDate(date: string, time: string | null): string {
  const compact = date.replace(/-/g, "");
  if (!time) return `${compact}`;
  return `${compact}T${time.replace(/:/g, "").slice(0, 6).padEnd(6, "0")}`;
}

// A timestamp with no zone and no trailing Z is a "floating" time: every
// calendar app reads it in the READER's own timezone. So a candidate who
// added this feed from anywhere but the centre's own zone had every session
// at the wrong hour -- and the centre's timezone is real data here
// (centers.time_zone), not an assumption. Emitted in UTC instead, which no
// client can misread and which needs no VTIMEZONE block. Walked 14 Sep 2026.
function toUtcStamp(instant: Date): string {
  return `${instant.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;
}

export async function GET(_request: Request, { params }: { params: Promise<{ traineeId: string }> }) {
  const { traineeId } = await params;
  const session = await getCurrentProfile();
  const viewer = session?.profile ?? null;
  const isStaff = viewer?.role === "trainer" || viewer?.role === "admin";
  const isSelf = viewer?.role === "trainee" && viewer.id === traineeId;
  const assessorCourseId = !viewer ? await getAssessorCourseId() : null;

  if (!isStaff && !isSelf && !assessorCourseId) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const supabase = assessorCourseId ? createAdminClient() : await createClient();
  const { data: trainee } = await supabase.from("profiles").select("course_id, full_name").eq("id", traineeId).maybeSingle();
  if (!trainee?.course_id) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (assessorCourseId && trainee.course_id !== assessorCourseId) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { data: events } = await supabase
    .from("course_timetable_events")
    .select("id, title, event_date, event_time, type")
    .eq("course_id", trainee.course_id)
    .order("event_date");

  // The session's real length is its band's, the same source the grid draws
  // from. Every event used to be exactly an hour, which also made an event
  // starting at 23:30 end at 00:30 on the SAME date -- a negative-length
  // entry some clients drop outright.
  const { data: courseRow } = await supabase.from("courses").select("center_id, time_bands").eq("id", trainee.course_id).maybeSingle();
  const timeZone = (courseRow?.center_id ? await getCachedCenter(courseRow.center_id) : null)?.time_zone ?? DEFAULT_TIMEZONE;
  const timeBands = resolveTimeBands(courseRow?.time_bands);
  const stampNow = toUtcStamp(new Date());

  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Connect//Trainee Timetable//EN", "CALSCALE:GREGORIAN"];
  for (const e of events ?? []) {
    const isAllDay = !e.event_time;
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${e.id}@celtaconnect`);
    lines.push(`DTSTAMP:${stampNow}`);
    if (isAllDay) {
      lines.push(`DTSTART;VALUE=DATE:${toIcsDate(e.event_date, null)}`);
    } else {
      const startsAt = zonedTimeToUtc(e.event_date, e.event_time!, timeZone);
      const band = timeBands[bandIndexFor(e.event_time, timeBands)];
      const bandEnd = band ? zonedTimeToUtc(e.event_date, band.end, timeZone) : null;
      const endsAt = bandEnd && bandEnd.getTime() > startsAt.getTime() ? bandEnd : new Date(startsAt.getTime() + 60 * 60 * 1000);
      lines.push(`DTSTART:${toUtcStamp(startsAt)}`);
      lines.push(`DTEND:${toUtcStamp(endsAt)}`);
    }
    lines.push(`SUMMARY:${icsEscape(e.title)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");

  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${trainee.full_name.replace(/[^a-z0-9]/gi, "-")}-timetable.ics"`,
    },
  });
}
