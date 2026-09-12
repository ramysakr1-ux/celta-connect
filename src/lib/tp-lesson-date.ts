import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { halfTpDates } from "@/lib/rotation";

/**
 * The calendar date a candidate teaches a given TP round.
 *
 * The rotation model: a TP group is split into two halves that teach on
 * alternating dates, so a candidate's Nth round is the Nth date in THEIR
 * half's list, scoped to their own TP group (two groups teach in parallel).
 * Same derivation recordAssessedLesson uses for the CELTA 5 record -- pulled
 * out here so the two cannot drift, since one decides what the record says
 * and the other now decides when the candidate may write their
 * self-evaluation.
 *
 * Null when the candidate has no paired subgroup, which is the same honest
 * limit the rotation engine has everywhere else: there is no date system to
 * read a personal teaching date out of.
 */
export async function tpLessonDate(
  supabase: SupabaseClient<Database>,
  courseId: string,
  traineeId: string,
  tpNumber: number
): Promise<string | null> {
  const { data: membership } = await supabase
    .from("course_subgroup_members")
    .select("subgroup_id")
    .eq("trainee_id", traineeId)
    .maybeSingle();
  if (!membership?.subgroup_id) return null;

  const { data: subgroup } = await supabase
    .from("course_subgroups")
    .select("half_order, tp_group_id")
    .eq("id", membership.subgroup_id)
    .maybeSingle();
  if (!subgroup?.half_order) return null;

  const { data: tpEvents } = await supabase
    .from("course_timetable_events")
    .select("event_date, tp_group_scope_id")
    .eq("course_id", courseId)
    .eq("type", "tp");
  const scoped = (tpEvents ?? []).filter((e) => !e.tp_group_scope_id || e.tp_group_scope_id === subgroup.tp_group_id);
  return halfTpDates(scoped, subgroup.half_order)[tpNumber - 1] ?? null;
}
