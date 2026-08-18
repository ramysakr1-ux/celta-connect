import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// specs/for-claude-code-trainer-in-training.md's Screen 1a portfolio
// checklist, Route One / Training and Development programme -- "most
// common route," the spec's own framing.
export const TIT_PRE_COURSE_TASKS: { key: string; label: string }[] = [
  { key: "tracking_own_development", label: "Tracking your own development" },
  { key: "syllabus_and_assessment_guidelines", label: "Syllabus & Assessment Guidelines" },
  { key: "administration_handbook", label: "Administration Handbook" },
  { key: "syllabus_and_course_timetable", label: "Syllabus & course timetable" },
  { key: "candidate_reading", label: "Candidate reading" },
  { key: "candidate_selection", label: "Candidate selection" },
  { key: "observing_interviews", label: "Observing interviews" },
  { key: "standards_of_assessment", label: "Standards of assessment" },
];

export const HEADLINE_MIN_PCT = 80;
export const MIN_DELIVERED_SESSIONS = 4;
export const TASK12_STAGE1_REQUIRED = 2;
export const CANDIDATES_TO_FOLLOW = 2;
export const TASK_RECORD_ITEM_COUNT = 16;

// "Verification must precede training -- training done without prior
// Cambridge verification is never acknowledged, so the app should refuse
// to open a TinT record with no verification date." Enforced here rather
// than only at the RLS layer, since RLS governs who can read/write a row
// that exists, not whether one should exist yet.
export async function ensureTitRecord(
  supabase: SupabaseClient<Database>,
  courseTutorsId: string
): Promise<string | null> {
  const { data: existing } = await supabase.from("tit_records").select("id").eq("course_tutors_id", courseTutorsId).maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("tit_records")
    .insert({ course_tutors_id: courseTutorsId })
    .select("id")
    .single();
  if (error || !created) return null;

  await Promise.all([
    supabase.from("tit_pre_course_tasks").insert(TIT_PRE_COURSE_TASKS.map((t) => ({ tit_record_id: created.id, task_key: t.key }))),
    supabase
      .from("tit_task_record_items")
      .insert(Array.from({ length: TASK_RECORD_ITEM_COUNT }, (_, i) => ({ tit_record_id: created.id, item_number: i + 1 }))),
  ]);

  return created.id;
}

export interface TitHeadlineStats {
  inputObservedCount: number;
  inputTotalCount: number;
  inputObservedPct: number;
  tpObservedCount: number;
  tpTotalCount: number;
  tpObservedPct: number;
}

// "Headline stats: % of input observed, % of TP/feedback observed (both
// must reach 80% minimum, tracked separately since input can be up to 10%
// asynchronous but TP/feedback never can be)." Derived from the course's
// real timetable at read time, never stored as a percentage -- same
// "derived, not stored" principle rotation.ts already uses for TP dates.
export function computeHeadlineStats(
  timetableEvents: { id: string; type: string }[],
  observedEventIds: ReadonlySet<string>
): TitHeadlineStats {
  const inputEvents = timetableEvents.filter((e) => e.type === "input_session");
  const tpEvents = timetableEvents.filter((e) => e.type === "tp");
  const inputObservedCount = inputEvents.filter((e) => observedEventIds.has(e.id)).length;
  const tpObservedCount = tpEvents.filter((e) => observedEventIds.has(e.id)).length;
  return {
    inputObservedCount,
    inputTotalCount: inputEvents.length,
    inputObservedPct: inputEvents.length > 0 ? Math.round((inputObservedCount / inputEvents.length) * 100) : 0,
    tpObservedCount,
    tpTotalCount: tpEvents.length,
    tpObservedPct: tpEvents.length > 0 ? Math.round((tpObservedCount / tpEvents.length) * 100) : 0,
  };
}
