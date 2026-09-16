import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { toLocalIso, zonedTimeToUtc, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";
import { getCurrentProfile } from "@/lib/auth/get-profile";

// The demo clock (for-claude-code-demo-clock.md).
//
// The demo centre is seeded at one frozen moment, so every demo link drops the
// visitor into the middle of week two. The course story wants each card to open
// on its own day, as that role, which means "now" has to be movable.
//
// Two rules hold it in place:
//
//   1. Only reads about COURSE STATE move. A timestamp written to the database
//      is always the real one -- a demo visitor's actions are happening now,
//      whatever day the course is pretending to be.
//   2. Only the demo centre moves. The cookie is ignored unless the viewer's
//      own centre (or the course they hold a token for) is flagged is_demo, so
//      a real centre can never be shifted by a cookie picked up earlier.
//
// Day N is the Nth distinct timetabled date of the demo course -- the same
// clock course-day.ts counts with. Day 0 is the day before Day 1, negatives run
// back from there, and anything past the last day runs forward from it, so
// Day 23 and Day 40 are real calendar dates. That is what the close-out and
// wipe gates need.
export const DEMO_DAY_COOKIE = "demo_day";

/** The `?day=N` a demo link was opened with, or null. Negatives are pre-course. */
export function parseDemoDay(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined || raw.trim() === "") return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < -90 || n > 120) return null;
  return n;
}

/** The day pinned in this visitor's cookie, or null for the real clock. */
export const demoDay = cache(async (): Promise<number | null> => {
  try {
    const store = await cookies();
    return parseDemoDay(store.get(DEMO_DAY_COOKIE)?.value ?? null);
  } catch {
    // No request scope (a cron route, a script). Always the real clock.
    return null;
  }
});

/**
 * The calendar date Day N falls on, given a course's distinct timetabled dates
 * in ascending order. Outside 1..dates.length it counts calendar days from the
 * nearest end, which is what "Day 40 = wiped" means.
 */
export function dateForCourseDay(dates: string[], day: number): string | null {
  if (dates.length === 0) return null;
  if (day >= 1 && day <= dates.length) return dates[day - 1];
  const anchor = day < 1 ? dates[0] : dates[dates.length - 1];
  const offset = day < 1 ? day - 1 : day - dates.length;
  const d = new Date(`${anchor}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

/** Is this course's centre a demo one? Cached per request. */
const courseIsDemo = cache(async (courseId: string): Promise<boolean> => {
  const { data } = await createAdminClient()
    .from("courses")
    .select("centers(is_demo)")
    .eq("id", courseId)
    .maybeSingle();
  return Boolean((data as { centers?: { is_demo?: boolean } } | null)?.centers?.is_demo);
});

/** Is the signed-in viewer's own centre a demo one? Cached per request. */
const viewerIsOnDemoCentre = cache(async (): Promise<boolean> => {
  const session = await getCurrentProfile();
  const centerId = session?.profile?.center_id;
  if (!centerId) return false;
  const { data } = await createAdminClient().from("centers").select("is_demo").eq("id", centerId).maybeSingle();
  return Boolean(data?.is_demo);
});

/** The demo course the clock counts against -- its distinct timetabled dates. */
const demoCourseDates = cache(async (courseId?: string): Promise<string[]> => {
  const admin = createAdminClient();
  let id = courseId;
  if (!id) {
    const { data: centre } = await admin
      .from("centers")
      .select("id")
      .eq("is_demo", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!centre) return [];
    // The RUNNING course, not the newest. The seed gained a next intake on
    // 12 Sep 2026 so live applications had somewhere to land; it starts five
    // weeks out and has no timetable, so "newest by start_date" resolved to a
    // course with no days and the clock quietly fell back to the real one.
    // Same rule as pickDemoCourse, on the real clock because that is what this
    // function exists to shift.
    const { data: course } = await admin
      .from("courses")
      .select("id")
      .eq("center_id", centre.id)
      .lte("start_date", new Date().toISOString().slice(0, 10))
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    id = course?.id;
  }
  if (!id) return [];
  const { data } = await admin
    .from("course_timetable_events")
    .select("event_date")
    .eq("course_id", id)
    .order("event_date", { ascending: true });
  return [...new Set((data ?? []).map((e) => e.event_date))].sort();
});

/**
 * The instant to treat as "now" for course state.
 *
 * `courseId` is how a token viewer (volunteer, assessor) proves which course
 * they are looking at; a signed-in viewer is checked against their own centre.
 * The real time of day is kept, so the day bar and Your day still move while
 * somebody is looking at them.
 */
export async function demoNow(timeZone: string = DEFAULT_TIMEZONE, courseId?: string): Promise<Date> {
  const real = new Date();
  const day = await demoDay();
  if (day === null) return real;

  const allowed = courseId ? await courseIsDemo(courseId) : await viewerIsOnDemoCentre();
  if (!allowed) return real;

  const target = dateForCourseDay(await demoCourseDates(courseId), day);
  if (!target) return real;

  const hhmm = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(real);
  return zonedTimeToUtc(target, hhmm, timeZone);
}

/** `today` in the centre's own zone, on the demo clock where one is pinned. */
export async function demoToday(timeZone: string = DEFAULT_TIMEZONE, courseId?: string): Promise<string> {
  return toLocalIso(await demoNow(timeZone, courseId), timeZone);
}

/** "Demo · Day N" for the header tag, or null when the clock is real. */
export async function demoClockTag(courseId?: string): Promise<string | null> {
  const day = await demoDay();
  if (day === null) return null;
  const allowed = courseId ? await courseIsDemo(courseId) : await viewerIsOnDemoCentre();
  return allowed ? `Demo · Day ${day}` : null;
}
