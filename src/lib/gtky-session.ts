import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { toLocalIso, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";

export interface GtkySessionEvent {
  id: string;
  title: string;
  event_date: string;
  event_time: string | null;
}

/**
 * The getting-to-know-you session the timetable is pointing at right now.
 *
 * Ramy, 12 Sep 2026: "we said if we call it 'unassessed, getting to know you'
 * there shouldn't be a problem. So you're saying it doesn't follow the
 * timetable, it follows the words?" -- both are true, and the second was the
 * bug. The event is found in the timetable by its title (which is the agreed
 * contract: name the session and it is found), but the query then took
 * `.order("event_date").limit(1)` -- always the EARLIEST match, for ever.
 *
 * A CELTA course has two of these. One on day one, meeting the learners for
 * the first time; one at the level change before TP5, meeting a new class at
 * a new level. With the earliest-match rule the page showed the first one for
 * the rest of the course and never moved on to the second.
 *
 * So: the next one on or after today, and once they are all past, the most
 * recent, which is the one just taught.
 */
export async function findGtkySession(
  supabase: SupabaseClient<Database>,
  courseId: string,
  timeZone: string = DEFAULT_TIMEZONE
): Promise<GtkySessionEvent | null> {
  // What the slot IS, first: an unassessed teaching slot (migration 0296).
  // Ramy, 12 Sep 2026: "are they just following whatever is written on the
  // timetable?" They should follow the timetable's own structure, not its
  // prose. The title match stays as a fallback for a centre whose timetable
  // predates the type, or who names the session without typing it -- his
  // earlier rule, still honoured, but no longer the only way in.
  const { data: typed } = await supabase
    .from("course_timetable_events")
    .select("id, title, event_date, event_time")
    .eq("course_id", courseId)
    .eq("type", "unassessed_tp")
    .order("event_date");
  let events = (typed ?? []) as GtkySessionEvent[];
  if (events.length === 0) {
    const { data } = await supabase
      .from("course_timetable_events")
      .select("id, title, event_date, event_time")
      .eq("course_id", courseId)
      .neq("type", "tp")
      .or("title.ilike.%getting to know%,title.ilike.%gtky%")
      .order("event_date");
    events = (data ?? []) as GtkySessionEvent[];
  }
  if (events.length === 0) return null;
  const today = toLocalIso(new Date(), timeZone);
  return events.find((e) => e.event_date >= today) ?? events[events.length - 1];
}
