import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { rotationPosition, halfTpDates, type TpTimetableEvent } from "@/lib/rotation";
import { buildStreamDay, type StreamDay } from "@/lib/course-stream-day";
import type { TimetableEvent } from "@/lib/timetable-grid";

// One trainee's day, fetched once per request.
//
// design_handoff_trainee_landing §1b, on the header's day bar: "It is the same
// clock and the same timetable rows as the main track -- never a second
// source." The bar renders from layout.tsx and the track from today-tab.tsx,
// which are different components with no way to pass props between them, so
// without this they would each go and ask the database separately and could
// answer differently.
//
// React's cache() dedupes by argument within a single render pass: both call
// sites get the identical object, and the queries below run once.

export interface TraineeDay extends StreamDay {
  /** The timetable row this trainee teaches today, if any. */
  mineEventId: string | null;
}

export const getTraineeStreamDay = cache(
  async (
    supabase: SupabaseClient<Database>,
    traineeId: string,
    courseId: string,
    dateIso: string,
    timeZone: string
  ): Promise<TraineeDay> => {
    const [{ data: course }, { data: todaysEvents }, { data: subgroupMember }] = await Promise.all([
      supabase.from("courses").select("time_bands").eq("id", courseId).maybeSingle(),
      supabase.from("course_timetable_events").select("*").eq("course_id", courseId).eq("event_date", dateIso),
      supabase.from("course_subgroup_members").select("subgroup_id, base_slot").eq("trainee_id", traineeId).maybeSingle(),
    ]);

    const subgroup = subgroupMember
      ? (
          await supabase
            .from("course_subgroups")
            .select("half_order, tp_group_id")
            .eq("id", subgroupMember.subgroup_id)
            .maybeSingle()
        ).data
      : null;

    // Which of today's TP slots is this trainee's. A TP day runs one slot per
    // trainee in the subgroup, in rotation order, so the trainee teaching third
    // teaches in the third slot of the day -- not the first, which is what the
    // hero used to assume for everyone.
    let mineEventId: string | null = null;
    if (subgroupMember && subgroup?.half_order) {
      const [{ data: members }, { data: allTp }, { data: plans }] = await Promise.all([
        supabase.from("course_subgroup_members").select("trainee_id").eq("subgroup_id", subgroupMember.subgroup_id),
        supabase.from("course_timetable_events").select("event_date").eq("course_id", courseId).eq("type", "tp"),
        supabase.from("plan_assignments").select("tp_number, taught_at").eq("trainee_id", traineeId),
      ]);
      const halfDates = halfTpDates((allTp ?? []) as TpTimetableEvent[], subgroup.half_order);
      const tpIndex = halfDates.indexOf(dateIso);
      const tpNumber = tpIndex >= 0 ? tpIndex + 1 : null;
      const plan = tpNumber ? (plans ?? []).find((p) => p.tp_number === tpNumber) : null;
      if (tpNumber && plan && !plan.taught_at && (members ?? []).length > 0) {
        const order = rotationPosition(subgroupMember.base_slot, (members ?? []).length, tpNumber) + 1;
        const todaysTp = ((todaysEvents ?? []) as TimetableEvent[])
          .filter((e) => e.type === "tp")
          .sort((a, b) => (a.event_time ?? "").localeCompare(b.event_time ?? ""));
        mineEventId = (todaysTp[order - 1] ?? todaysTp[0])?.id ?? null;
      }
    }

    const day = buildStreamDay({
      events: (todaysEvents ?? []) as TimetableEvent[],
      timeBands: course?.time_bands ?? null,
      dateIso,
      timeZone,
      mineEventIds: new Set(mineEventId ? [mineEventId] : []),
      tpGroupId: subgroup?.tp_group_id ?? null,
    });

    return { ...day, mineEventId };
  }
);
