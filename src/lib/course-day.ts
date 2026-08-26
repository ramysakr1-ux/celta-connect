import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { toLocalIso, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";
import { getCachedCenter } from "@/lib/supabase/cached-queries";

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
  const [{ data }, { data: course }] = await Promise.all([
    supabase.from("course_timetable_events").select("event_date").eq("course_id", courseId).order("event_date", { ascending: true }),
    supabase.from("courses").select("center_id").eq("id", courseId).maybeSingle(),
  ]);
  if (!data || !course) return false;

  const distinctDates = Array.from(new Set(data.map((row) => row.event_date))).sort();
  const targetDate = distinctDates[dayNumber - 1];
  if (!targetDate) return false;

  const center = await getCachedCenter(course.center_id);
  const today = toLocalIso(new Date(), center?.time_zone ?? DEFAULT_TIMEZONE);
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
  const [{ data }, { data: course }] = await Promise.all([
    supabase.from("course_timetable_events").select("event_date").eq("course_id", courseId).order("event_date", { ascending: true }),
    supabase.from("courses").select("center_id").eq("id", courseId).maybeSingle(),
  ]);
  if (!data || data.length === 0) return null;

  const distinctDates = Array.from(new Set(data.map((row) => row.event_date))).sort();
  const center = course ? await getCachedCenter(course.center_id) : null;
  const today = toLocalIso(new Date(), center?.time_zone ?? DEFAULT_TIMEZONE);
  const daysReached = distinctDates.filter((d) => d <= today).length;
  if (daysReached === 0) return null;

  return { currentDay: Math.min(daysReached, distinctDates.length), totalDays: distinctDates.length };
}
