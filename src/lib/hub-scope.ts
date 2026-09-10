import "server-only";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// Whose candidates a tutor is looking at.
//
// Ramy, 11 Sep 2026, on a course of twelve with two trainers: "if you log in
// as an MCT, you see your six trainees. If you log in as an ACT, you see your
// six trainees." Each tutor owns a TP group (course_tp_groups.tutor_profile_id)
// and their day-to-day work -- the lessons, the feedback, the roster -- is that
// group. The ACT was already scoped this way on Today and on Teaching
// Practice; the MCT saw the whole course everywhere, and the roster showed all
// twelve to both of them.
//
// The MCT is still responsible for the entire course (Cambridge makes them
// sign it off), so "only six" cannot be absolute for them. His call: their six
// by default, the full twelve one click away. That click is a cookie, read
// here, set by scope-actions.ts from the header pill. Like the ACT preview it
// changes what is SHOWN and never what is permitted -- write actions keep
// calling isMctOfCourse and never read this.
export const HUB_SCOPE_COOKIE = "hub_scope";

/** Has the MCT clicked through to the whole course? */
export async function seesWholeCourse(): Promise<boolean> {
  return (await cookies()).get(HUB_SCOPE_COOKIE)?.value === "all";
}

export interface TutorScope {
  /** null = no narrowing (whole course). */
  groupIds: Set<string> | null;
  traineeIds: Set<string> | null;
  groupNames: string[];
  /** How many candidates are in scope vs on the course, for "6 of 12". */
  inScope: number;
  onCourse: number;
}

/**
 * The tutor's own group(s), or the whole course. A group is theirs when
 * course_tp_groups names them as its tutor. If no group on the course is
 * staffed yet (tutor_profile_id null everywhere) scope stays the whole course
 * rather than an empty page -- honest about the setup rather than hiding it.
 */
export async function tutorScope(
  supabase: SupabaseClient<Database>,
  tutorId: string,
  courseId: string,
  wholeCourse: boolean
): Promise<TutorScope> {
  const [{ data: groups }, { data: subgroups }, { data: trainees }] = await Promise.all([
    supabase.from("course_tp_groups").select("id, name, tutor_profile_id").eq("course_id", courseId),
    supabase.from("course_subgroups").select("id, tp_group_id").eq("course_id", courseId),
    supabase.from("profiles").select("id").eq("course_id", courseId).eq("role", "trainee"),
  ]);
  const onCourse = (trainees ?? []).length;
  const none: TutorScope = { groupIds: null, traineeIds: null, groupNames: [], inScope: onCourse, onCourse };
  if (wholeCourse) return none;

  const mine = (groups ?? []).filter((g) => g.tutor_profile_id === tutorId);
  if (mine.length === 0) return none;

  const groupIds = new Set(mine.map((g) => g.id));
  const subIds = (subgroups ?? []).filter((s) => s.tp_group_id && groupIds.has(s.tp_group_id)).map((s) => s.id);
  const { data: members } = subIds.length
    ? await supabase.from("course_subgroup_members").select("trainee_id").in("subgroup_id", subIds)
    : { data: [] as { trainee_id: string }[] };
  const traineeIds = new Set((members ?? []).map((m) => m.trainee_id));
  return { groupIds, traineeIds, groupNames: mine.map((g) => g.name), inScope: traineeIds.size, onCourse };
}
