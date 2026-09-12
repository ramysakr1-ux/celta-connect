import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { distinctTpDates, halfTpDates, type TpTimetableEvent } from "@/lib/rotation";

// design_handoff_timetable_decisions, for-claude-code-assignment-schedule-
// rule.md: "A group's submission or resubmission date must always fall on
// a day that group is not teaching TP -- i.e. on the day the *other* TP
// group has their session... this must be computed from the actual TP
// roster for that course instance, not hard-coded to a weekday." Ramy,
// 2026-08-17: "we just need to link it to the timetable, that's what
// matters" -- not the specific ABC/DEF letters, which are just this
// course's own subgroup names.
//
// Three different mechanisms, matching what the worked calendar actually
// does (cross-checked cell by cell against Timetable Refresh.dc.html's
// FULL four-week reference, not guessed from the summary table alone):
//
// - Focus on Learner and LRT are NOT group-split -- same calendar day for
//   everyone. FOL is due Day 12; LRT is due Day 10, exactly the FOL
//   divergence day -- both reuse course-day.ts's existing "Nth distinct
//   timetabled date" clock rather than inventing a second one.
// - Skills (SRT) is due the calendar day immediately after each half's OWN
//   TP3 -- which, because the two halves strictly alternate day by day, is
//   structurally always a TP day for the other half (the same round if
//   this half went first that day-pair, the next round if it went
//   second). Reproduced exactly against the reference for both halves.
// - LfC does NOT follow that same "day after your own last TP" pattern
//   (the reference shows a real gap after TP6 before it's due) -- it's
//   anchored to a fixed round instead: each half is due on the OTHER
//   half's TP7 date specifically, symmetric for both, leaving TP8 (the
//   final assessed lesson) out of the reflection's own deadline pressure.
//
// Ramy, 12 Sep 2026, settling three sources that disagreed: "the timetable
// due event wins." An `assignment_due` event carrying linked_assignment_type
// sets the date for the candidates it addresses -- the whole cohort, one TP
// group (tp_group_scope_id, as the add-event form scopes it), or one half
// when its title names the half's letters ("Assignment 2 (LRT) due · DEF").
// The rules below fill in only where the timetable is silent on a type.
//
// SRT/LfC's anchor rounds are the one interpretive judgment call here --
// tune SRT_ANCHOR_ROUND / LFC_ANCHOR_ROUND if the intended round differs.
const SRT_ANCHOR_ROUND = 3;
const LFC_ANCHOR_ROUND = 7;

const COHORT_DAY_ASSIGNMENTS: Partial<Record<Database["public"]["Tables"]["assignments"]["Row"]["assignment_type"], number>> = {
  "Focus on Learner": 12,
  LRT: 10,
};

interface TraineeGroupInfo {
  traineeId: string;
  halfOrder: 1 | 2 | null; // null = unpaired subgroup, or no subgroup at all
  tpGroupId: string | null;
}

interface TimetableDue {
  type: string;
  date: string;
  tpGroupId: string | null;
  half: 1 | 2 | null;
}

/** "· ABC" names the first half (Day A), "· DEF" the second -- letters are per group. */
export function halfFromTitle(title: string): 1 | 2 | null {
  if (/\bABC\b/i.test(title)) return 1;
  if (/\bDEF\b/i.test(title)) return 2;
  return null;
}

/**
 * The timetable's own due date for one candidate and type, if any: the most
 * specific event that addresses them (half and group beat group beats half
 * beats cohort-wide), earliest date on a tie.
 */
export function timetableDueFor(
  events: TimetableDue[],
  type: string,
  trainee: { halfOrder: 1 | 2 | null; tpGroupId: string | null }
): string | null {
  const matching = events.filter(
    (e) =>
      e.type === type &&
      (e.tpGroupId === null || e.tpGroupId === trainee.tpGroupId) &&
      (e.half === null || e.half === trainee.halfOrder)
  );
  if (matching.length === 0) return null;
  const score = (e: TimetableDue) => (e.tpGroupId ? 2 : 0) + (e.half ? 1 : 0);
  matching.sort((a, b) => score(b) - score(a) || a.date.localeCompare(b.date));
  return matching[0].date;
}

export interface DueDateResult {
  traineeId: string;
  assignmentType: Database["public"]["Tables"]["assignments"]["Row"]["assignment_type"];
  dueDate: string | null;
}

// Resolves a due date for every trainee, every assignment type, from the
// course's REAL timetable and REAL subgroup pairing -- nothing hard-coded
// to a weekday or a fixed ABC/DEF pair. Call this fresh whenever it
// matters (skeleton generated, pairing changed, or on demand) rather than
// keeping it as stored state that can go stale.
export async function resolveAssignmentDueDates(
  supabase: SupabaseClient<Database>,
  courseId: string
): Promise<DueDateResult[]> {
  // Perf/scope, 6 Sep 2026. Two things were wrong here:
  //
  //   1. course_subgroup_members was read with NO filter -- every subgroup
  //      membership on the platform, to answer a question about one course.
  //      On the service-role client there is no RLS to catch that, and a
  //      trainee who appears in another course's subgroup would have shifted
  //      this course's due dates. Scoped to this course's own subgroups.
  //   2. The course's timetable events were fetched twice, the second time
  //      only to filter type = 'tp'. Ask for the type once and split in
  //      memory; the rows are the same rows.
  const [{ data: allEvents }, { data: trainees }, { data: subgroups }] = await Promise.all([
    supabase.from("course_timetable_events").select("event_date, type, title, linked_assignment_type, tp_group_scope_id").eq("course_id", courseId),
    supabase.from("profiles").select("id").eq("course_id", courseId).eq("role", "trainee"),
    supabase.from("course_subgroups").select("id, tp_group_id, half_order").eq("course_id", courseId),
  ]);
  const subgroupIds = (subgroups ?? []).map((s) => s.id);
  const { data: members } = subgroupIds.length
    ? await supabase.from("course_subgroup_members").select("trainee_id, subgroup_id").in("subgroup_id", subgroupIds)
    : { data: [] as { trainee_id: string; subgroup_id: string }[] };
  const tpEvents: TpTimetableEvent[] = (allEvents ?? []).filter((e) => e.type === "tp").map((e) => ({ event_date: e.event_date }));

  const subgroupById = new Map((subgroups ?? []).map((s) => [s.id, s]));
  const memberBySubgroupId = new Map((members ?? []).map((m) => [m.trainee_id, m.subgroup_id]));

  const traineeGroups: TraineeGroupInfo[] = (trainees ?? []).map((t) => {
    const subgroupId = memberBySubgroupId.get(t.id);
    const subgroup = subgroupId ? subgroupById.get(subgroupId) : null;
    const halfOrder = subgroup?.half_order === 1 || subgroup?.half_order === 2 ? subgroup.half_order : null;
    return { traineeId: t.id, halfOrder, tpGroupId: subgroup?.tp_group_id ?? null };
  });

  // The timetable's own word on due dates -- wins wherever it speaks.
  const timetableDue: TimetableDue[] = (allEvents ?? [])
    .filter((e) => e.type === "assignment_due" && e.linked_assignment_type)
    .map((e) => ({ type: e.linked_assignment_type as string, date: e.event_date, tpGroupId: e.tp_group_scope_id ?? null, half: halfFromTitle(e.title ?? "") }));
  const fromTimetable = (type: string, trainee: TraineeGroupInfo) => timetableDueFor(timetableDue, type, trainee);

  const cohortTpDates = distinctTpDates(tpEvents);
  const allDistinctDates = distinctTpDates((allEvents ?? []) as TpTimetableEvent[]);

  const results: DueDateResult[] = [];

  // Focus on Learner / LRT -- whole cohort, same date for everyone.
  for (const assignmentType of ["Focus on Learner", "LRT"] as const) {
    const cohortDay = COHORT_DAY_ASSIGNMENTS[assignmentType]!;
    const dueDate = allDistinctDates[cohortDay - 1] ?? null;
    for (const trainee of traineeGroups) {
      results.push({ traineeId: trainee.traineeId, assignmentType, dueDate: fromTimetable(assignmentType, trainee) ?? dueDate });
    }
  }

  // Skills (SRT) -- due the next TP date after this half's own round-3 date.
  for (const trainee of traineeGroups) {
    let dueDate: string | null = null;
    if (trainee.halfOrder) {
      const ownRoundDate = halfTpDates(tpEvents, trainee.halfOrder)[SRT_ANCHOR_ROUND - 1];
      dueDate = ownRoundDate ? (cohortTpDates.find((d) => d > ownRoundDate) ?? null) : null;
    } else {
      // Unpaired subgroup / no subgroup yet -- no alternation to resolve;
      // fall back to the cohort's own round-3 date.
      dueDate = cohortTpDates[SRT_ANCHOR_ROUND - 1] ?? null;
    }
    results.push({ traineeId: trainee.traineeId, assignmentType: "Skills", dueDate: fromTimetable("Skills", trainee) ?? dueDate });
  }

  // LfC -- due on the OTHER half's fixed round-7 date.
  for (const trainee of traineeGroups) {
    let dueDate: string | null;
    if (trainee.halfOrder === 1) {
      dueDate = halfTpDates(tpEvents, 2)[LFC_ANCHOR_ROUND - 1] ?? null;
    } else if (trainee.halfOrder === 2) {
      dueDate = halfTpDates(tpEvents, 1)[LFC_ANCHOR_ROUND - 1] ?? null;
    } else {
      dueDate = cohortTpDates[LFC_ANCHOR_ROUND - 1] ?? null;
    }
    results.push({ traineeId: trainee.traineeId, assignmentType: "LfC", dueDate: fromTimetable("LfC", trainee) ?? dueDate });
  }

  return results;
}

// Writes the resolved dates onto each trainee's own assignments.due_date --
// the field the rest of the app (at-risk, Today's "Waiting on you", roster)
// actually reads. Only touches rows that still belong to this course and
// this trainee (assignments are per-trainee already, migration 0001).
export async function syncAssignmentDueDates(supabase: SupabaseClient<Database>, courseId: string): Promise<void> {
  const results = await resolveAssignmentDueDates(supabase, courseId);
  await Promise.all(
    results.map((r) =>
      supabase
        .from("assignments")
        .update({ due_date: r.dueDate })
        .eq("course_id", courseId)
        .eq("trainee_id", r.traineeId)
        .eq("assignment_type", r.assignmentType)
    )
  );
}
