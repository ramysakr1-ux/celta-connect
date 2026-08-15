import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// "Day N" of the course = the Nth distinct timetabled date, not a raw
// calendar-day count -- ties FOL's Day 1/10/12 language to the same clock
// the rest of the app already reads (course_timetable_events is "the clock
// the whole app reads from," per the trainer-homepage spec). Mirrors the
// SQL fol_divergence_session_reached() function in migration 0088 -- kept
// in sync deliberately, one in SQL for the RLS gate on
// volunteer_signup_profiles, one in TS for the claim-submission timing
// check server actions do outside RLS.
export async function isCourseDayReached(
  supabase: SupabaseClient<Database>,
  courseId: string,
  dayNumber: number
): Promise<boolean> {
  const { data } = await supabase
    .from("course_timetable_events")
    .select("event_date")
    .eq("course_id", courseId)
    .order("event_date", { ascending: true });
  if (!data) return false;

  const distinctDates = Array.from(new Set(data.map((row) => row.event_date))).sort();
  const targetDate = distinctDates[dayNumber - 1];
  if (!targetDate) return false;

  const today = new Date().toISOString().slice(0, 10);
  return today >= targetDate;
}

// for-claude-code-trainee-interface.md's header "Day N of 20" counter --
// same distinct-timetabled-date clock as isCourseDayReached above, just
// exposed as a count instead of a single-day boolean gate. Null before the
// first timetabled date exists/has arrived (nothing sensible to show yet).
export async function computeCourseDayProgress(
  supabase: SupabaseClient<Database>,
  courseId: string
): Promise<{ currentDay: number; totalDays: number } | null> {
  const { data } = await supabase
    .from("course_timetable_events")
    .select("event_date")
    .eq("course_id", courseId)
    .order("event_date", { ascending: true });
  if (!data || data.length === 0) return null;

  const distinctDates = Array.from(new Set(data.map((row) => row.event_date))).sort();
  const today = new Date().toISOString().slice(0, 10);
  const daysReached = distinctDates.filter((d) => d <= today).length;
  if (daysReached === 0) return null;

  return { currentDay: Math.min(daysReached, distinctDates.length), totalDays: distinctDates.length };
}
