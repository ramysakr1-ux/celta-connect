import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Connect//Trainee Timetable//EN", "CALSCALE:GREGORIAN"];
  for (const e of events ?? []) {
    const start = toIcsDate(e.event_date, e.event_time);
    const isAllDay = !e.event_time;
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${e.id}@celtaconnect`);
    lines.push(isAllDay ? `DTSTART;VALUE=DATE:${start}` : `DTSTART:${start}`);
    if (!isAllDay) {
      const [h, m] = e.event_time!.split(":").map(Number);
      const endH = String((h + 1) % 24).padStart(2, "0");
      lines.push(`DTEND:${e.event_date.replace(/-/g, "")}T${endH}${String(m).padStart(2, "0")}00`);
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
