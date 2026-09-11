import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getCachedCenter } from "@/lib/supabase/cached-queries";
import { toLocalIso, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";

/**
 * The course the demo is about: the one running at the centre today, or --
 * outside a course -- the most recent one to have started.
 *
 * Every demo entry point used to take "the latest course by start date",
 * which was the running course only for as long as it was the newest row.
 * On 12 Sep 2026 the seed gained a next intake so live applications had
 * somewhere to land, and /demo/assessor promptly minted its link for a
 * course five weeks in the future with no candidates on it. A demo course
 * is the one you can walk into, not the one furthest ahead.
 */
export async function pickDemoCourse<T extends { start_date: string }>(
  admin: SupabaseClient<Database>,
  centerId: string,
  select: string
): Promise<T | null> {
  const timeZone = (await getCachedCenter(centerId))?.time_zone ?? DEFAULT_TIMEZONE;
  const today = toLocalIso(new Date(), timeZone);
  const { data: started } = await admin
    .from("courses")
    .select(select)
    .eq("center_id", centerId)
    .lte("start_date", today)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (started) return started as unknown as T;
  // Nothing has started yet: the nearest upcoming one.
  const { data: upcoming } = await admin
    .from("courses")
    .select(select)
    .eq("center_id", centerId)
    .order("start_date", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (upcoming as unknown as T) ?? null;
}
