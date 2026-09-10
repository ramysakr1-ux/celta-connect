import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { buildStreamDay, type StreamDay } from "@/lib/course-stream-day";
import type { TimetableEvent } from "@/lib/timetable-grid";
import { toLocalIso } from "@/lib/timetable-grid";
import { DayBar } from "@/components/day-bar";

// The clock in a landing's header.
//
// Ramy, 10 Sep 2026: "everyone should have a clock. Every landing page should
// have a clock." Two different things are being asked for there, and they do
// not have the same scope:
//
//   The CLOCK is the centre's wall time. Every landing can carry it, because
//   every landing belongs to a centre and a centre has one clock.
//
//   The DAY BAR is one course's teaching day. Only a landing that IS about one
//   course can carry it. A trainee has one course; so do a trainer, an assessor
//   (their token names it) and a volunteer. A centre manager may be looking at
//   four courses running at once, and a platform owner at four centres in four
//   zones -- for them there is no such thing as "the day", and drawing one
//   would be picking a course at random and calling it the centre's.
//
// So pass a courseId when there is exactly one, and leave it out when there is
// not: DayBar renders the bar plus the clock in the first case and the clock
// alone in the second. Nothing here guesses which course somebody meant.

const getCourseStreamDay = cache(
  async (
    supabase: SupabaseClient<Database>,
    courseId: string,
    dateIso: string,
    timeZone: string
  ): Promise<StreamDay> => {
    const [{ data: course }, { data: events }] = await Promise.all([
      supabase.from("courses").select("time_bands").eq("id", courseId).maybeSingle(),
      supabase.from("course_timetable_events").select("*").eq("course_id", courseId).eq("event_date", dateIso),
    ]);
    return buildStreamDay({
      events: (events ?? []) as TimetableEvent[],
      timeBands: course?.time_bands ?? null,
      dateIso,
      timeZone,
      // Nobody's own lesson: this is the course's day as a whole, which is what
      // an assessor, a volunteer or a tutor is looking at. The trainee's own
      // bar keeps its gold marker and comes from getTraineeStreamDay.
      mineEventIds: new Set<string>(),
      tpGroupId: null,
    });
  }
);

export async function HeaderClock({
  supabase,
  courseId,
  timeZone,
  accent,
  tone,
}: {
  supabase: SupabaseClient<Database>;
  /** Null when this landing is not about exactly one course -- clock only. */
  courseId?: string | null;
  timeZone: string;
  accent: string;
  tone: "dark" | "light";
}) {
  const serverNowMs = Date.now();
  const todayIso = toLocalIso(new Date(), timeZone);
  const day = courseId ? await getCourseStreamDay(supabase, courseId, todayIso, timeZone) : null;
  const anchor = day?.slots[0] ?? null;

  return (
    <DayBar
      items={
        day?.slots.map((s) => ({
          id: s.id,
          fromMin: s.fromMin,
          toMin: s.toMin,
          endsAtMs: s.endsAtMs,
          title: s.title,
        })) ?? []
      }
      windowStart={day?.windowStart ?? 0}
      windowEnd={day?.windowEnd ?? 24 * 60}
      anchorMs={anchor ? anchor.startsAtMs : serverNowMs}
      anchorMin={anchor ? anchor.fromMin : (day?.windowStart ?? 0)}
      accent={accent}
      tone={tone}
      serverNowMs={serverNowMs}
      timeZone={timeZone}
    />
  );
}
