import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { computeSessionTicks, creditedHours, TICK_THRESHOLD_MINUTES, CERTIFICATE_HOURS_THRESHOLD } from "@/lib/volunteer-attendance";
import { TP_LESSON_LENGTH_MINUTES } from "@/lib/tp-plan-content";
import { DEFAULT_TIMEZONE, toLocalIso } from "@/lib/timetable-grid";

export { TICK_THRESHOLD_MINUTES, CERTIFICATE_HOURS_THRESHOLD };

export interface VolunteerClassSummary {
  id: string; // volunteer_students.id this event belongs to (for materials scoping)
  courseId: string;
  courseName: string;
  eventId: string;
  eventDate: string;
  eventTime: string | null;
  attended: boolean | null; // null = date hasn't passed yet (upcoming)
  zoomUrl: string | null;
  // Free text the centre sets per event (migration 0229) -- in practice the
  // room, which the volunteer's own card had no way to show. Ramy: "there's
  // no room number on the hero card."
  detail: string | null;
  linkedTpNumber: number | null; // for matching volunteer_shared_materials -> tp_plans.tp_number
  // The centre's own IANA zone, carried per class rather than per page.
  // A volunteer's identity spans courses, and since multi-centre support
  // those courses can sit in different cities -- Diane's own two branches
  // are New York and Los Angeles. "Has this class happened yet" has to be
  // asked in the zone the class is actually taught in, not in one zone
  // borrowed from whichever course the token happened to be issued for.
  timeZone: string;
}

// Volunteer View.dc.html: "Hours are the unit, never levels or courses" --
// a volunteer's identity (volunteer_people, migration 0125) can span
// several courses, so "your classes"/"your hours" read across every
// volunteer_students row linked to the same person, not just the one this
// token happens to be for. Same computeSessionTicks math the centre's own
// Volunteer Pool already totals cross-course with (src/app/centre/page.tsx)
// -- reused here rather than reimplemented.
export async function getVolunteerIdentityData(
  admin: SupabaseClient<Database>,
  volunteerStudentId: string
): Promise<{
  hoursCredited: number;
  classes: VolunteerClassSummary[];
  memberVolunteerStudentIds: string[];
}> {
  const { data: self } = await admin.from("volunteer_students").select("id, course_id, volunteer_person_id").eq("id", volunteerStudentId).maybeSingle();
  if (!self) return { hoursCredited: 0, classes: [], memberVolunteerStudentIds: [volunteerStudentId] };

  const { data: siblings } = self.volunteer_person_id
    ? await admin.from("volunteer_students").select("id, course_id").eq("volunteer_person_id", self.volunteer_person_id)
    : { data: [{ id: self.id, course_id: self.course_id }] };
  const members = siblings && siblings.length > 0 ? siblings : [{ id: self.id, course_id: self.course_id }];
  const memberIds = members.map((m) => m.id);
  const courseIds = [...new Set(members.map((m) => m.course_id))];

  const [{ data: courses }, { data: tpEvents }, { data: attendanceRows }] = await Promise.all([
    admin.from("courses").select("id, name, center_id").in("id", courseIds),
    admin.from("course_timetable_events").select("id, event_date, event_time, course_id, zoom_url, detail, linked_tp_number").in("course_id", courseIds).eq("type", "tp"),
    admin.from("volunteer_attendance").select("volunteer_student_id, timetable_event_id").in("volunteer_student_id", memberIds),
  ]);
  const courseNameById = new Map((courses ?? []).map((c) => [c.id, c.name]));

  const centerIds = [...new Set((courses ?? []).map((c) => c.center_id).filter(Boolean))] as string[];
  const { data: centers } = centerIds.length
    ? await admin.from("centers").select("id, time_zone").in("id", centerIds)
    : { data: null };
  const tzByCenterId = new Map((centers ?? []).map((c) => [c.id, c.time_zone || DEFAULT_TIMEZONE]));
  const tzByCourseId = new Map(
    (courses ?? []).map((c) => [c.id, (c.center_id ? tzByCenterId.get(c.center_id) : null) ?? DEFAULT_TIMEZONE])
  );
  const attendedEventIds = new Set((attendanceRows ?? []).map((a) => a.timetable_event_id));

  const sessions = computeSessionTicks(
    (tpEvents ?? []).map((e) => ({ id: e.id, event_date: e.event_date })),
    attendedEventIds,
    TP_LESSON_LENGTH_MINUTES
  );
  const hoursCredited = creditedHours(sessions);

  // Was `new Date().toISOString().slice(0, 10)` -- the calendar date in
  // UTC, which is not the calendar date at any centre off UTC. For
  // Europe/Istanbul (GMT+3, the app default) every class between midnight
  // and 03:00 local read as still upcoming; for the Los Angeles branch
  // (GMT-7) an evening class flipped to "past" hours before it was taught.
  const now = new Date();
  const classes: VolunteerClassSummary[] = (tpEvents ?? [])
    .map((e) => ({
      id: memberIds.find((id) => members.find((m) => m.id === id)?.course_id === e.course_id) ?? volunteerStudentId,
      courseId: e.course_id,
      courseName: courseNameById.get(e.course_id) ?? "Unknown course",
      eventId: e.id,
      eventDate: e.event_date,
      eventTime: e.event_time,
      attended: e.event_date < toLocalIso(now, tzByCourseId.get(e.course_id) ?? DEFAULT_TIMEZONE) ? attendedEventIds.has(e.id) : null,
      zoomUrl: e.zoom_url,
      detail: e.detail,
      linkedTpNumber: e.linked_tp_number,
      timeZone: tzByCourseId.get(e.course_id) ?? DEFAULT_TIMEZONE,
    }))
    // Date only was not enough to order a day that holds several TP rounds
    // -- 10:00, 10:45, 11:30 all compared equal and kept whatever order the
    // query happened to return them in.
    .sort((a, b) => {
      if (a.eventDate !== b.eventDate) return a.eventDate < b.eventDate ? 1 : -1;
      return (b.eventTime ?? "").localeCompare(a.eventTime ?? "");
    });

  return { hoursCredited, classes, memberVolunteerStudentIds: memberIds };
}
