import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { resolveTimeBands } from "@/lib/timetable-grid";

// Ramy, 30 Aug 2026: "the assessor meeting... it's been announced, there's a
// countdown for it, it's one of the announcements made by the MCT. And then
// there's the grades meeting. And all of this will be on the timetable, so it
// should be kind of easy for the system."
//
// It wasn't on the timetable. Nothing created it: the demo course had one
// only because the seed placed it by hand, and Elmswood's real November
// course had a visit date with no assessor meeting -- and, as it turned out,
// no events on that day at all. So the announcement composer's day-offset
// anchoring, which is the countdown Ramy is describing, had nothing to anchor
// to on any real course.
//
// This puts the one event on the timetable that belongs to the candidates:
// the assessor meeting them. The GRADING meeting deliberately does not go
// here -- "the timetable is for the trainees, and the grades meeting is not
// for the trainees... I'd rather not." It lives in the assessment timetable
// panel of the pack instead (assessor/page.tsx), which is the assessor's
// document rather than the cohort's.

/**
 * Matched on rather than a marker column, the same way today-tab.tsx already
 * identifies the day's "Feedback" session by exact title. A course has at
 * most one of these.
 */
export const ASSESSOR_MEETING_TITLE = "Assessor meeting";

const ASSESSOR_MEETING_DETAIL = "Private, without tutors present";

/**
 * Keeps the assessor meeting on the timetable in step with the visit date.
 *
 * Deliberately non-destructive:
 *
 * - An existing meeting is MOVED, not replaced, so a time the MCT chose by
 *   hand and any detail they wrote survive a date change.
 * - Clearing the visit date does NOT delete the meeting. Silently removing a
 *   session the candidates can already see, and may have planned around, is
 *   worse than leaving one the MCT can delete themselves.
 *
 * Safe to call on every save; a no-op when the date hasn't moved.
 */
export async function syncAssessorMeetingEvent(
  supabase: SupabaseClient<Database>,
  courseId: string,
  visitDate: string | null
): Promise<void> {
  if (!visitDate) return;

  const { data: existing } = await supabase
    .from("course_timetable_events")
    .select("id, event_date")
    .eq("course_id", courseId)
    .eq("title", ASSESSOR_MEETING_TITLE)
    .maybeSingle();

  if (existing) {
    if (existing.event_date !== visitDate) {
      await supabase.from("course_timetable_events").update({ event_date: visitDate }).eq("id", existing.id);
    }
    return;
  }

  const [{ data: course }, { data: dayEvents }] = await Promise.all([
    supabase.from("courses").select("time_bands").eq("id", courseId).maybeSingle(),
    supabase
      .from("course_timetable_events")
      .select("title, event_time")
      .eq("course_id", courseId)
      .eq("event_date", visitDate),
  ]);

  await supabase.from("course_timetable_events").insert({
    course_id: courseId,
    type: "supervised_session",
    title: ASSESSOR_MEETING_TITLE,
    event_date: visitDate,
    event_time: pickMeetingTime(course?.time_bands, dayEvents ?? []),
    tag: "group_room",
    detail: ASSESSOR_MEETING_DETAIL,
  } as never);
}

/**
 * A starting time the MCT will usually keep, and can always move.
 *
 * The meeting follows the day's teaching and the feedback on it -- Handbook
 * 14.2 has the assessor observe TP, then observe feedback, then meet the
 * candidates without tutors present. So: the band after that day's "Feedback"
 * session where there is one, and otherwise the last band of the day, which
 * is late enough not to collide with teaching on a day whose timetable hasn't
 * been built yet.
 */
function pickMeetingTime(
  courseTimeBands: Database["public"]["Tables"]["courses"]["Row"]["time_bands"] | undefined,
  dayEvents: { title: string | null; event_time: string | null }[]
): string {
  const bands = resolveTimeBands(courseTimeBands);
  const lastBand = bands[bands.length - 1].start;

  const feedback = dayEvents
    .filter((e) => e.title === "Feedback" && e.event_time)
    .map((e) => (e.event_time ?? "").slice(0, 5))
    .sort()
    .pop();
  if (!feedback) return lastBand;

  const afterFeedback = bands.find((b) => b.start > feedback);
  return afterFeedback?.start ?? lastBand;
}

/**
 * Handbook 14.2 has the assessor co-observe two candidates teaching. A visit
 * date with no teaching practice on it cannot deliver that, and nothing said
 * so -- Elmswood's November course is in exactly this state right now: a
 * visit booked for the 30th, and not one event on the day.
 *
 * Returns null when there is nothing to say.
 */
export async function assessorVisitDayProblem(
  supabase: SupabaseClient<Database>,
  courseId: string,
  visitDate: string | null
): Promise<string | null> {
  if (!visitDate) return null;

  const { data: dayEvents } = await supabase
    .from("course_timetable_events")
    .select("type")
    .eq("course_id", courseId)
    .eq("event_date", visitDate);

  if (!dayEvents || dayEvents.length === 0) {
    return "Nothing is timetabled on the visit date at all. The assessor has to co-observe two candidates teaching and then observe the feedback, so this day needs teaching practice on it before the visit is workable.";
  }
  if (!dayEvents.some((e) => e.type === "tp")) {
    return "There is no teaching practice timetabled on the visit date. The assessor has to co-observe two candidates teaching (Handbook 14.2), so either the timetable or the visit date needs to move.";
  }
  return null;
}
