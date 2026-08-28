import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { TIT_PRE_COURSE_TASKS, TASK_RECORD_ITEM_COUNT } from "@/lib/trainer-in-training-constants";

export {
  HEADLINE_MIN_PCT,
  MIN_DELIVERED_SESSIONS,
  TASK12_STAGE1_REQUIRED,
  CANDIDATES_TO_FOLLOW,
  TASK_RECORD_ITEM_COUNT,
  INPUT_ASYNC_MAX_PCT,
  SHADOW_DAYS_REQUIRED,
  TIT_MODES,
  TIT_MODE_LABEL,
  TIT_PRE_COURSE_TASKS,
} from "@/lib/trainer-in-training-constants";

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
  inputAsyncCount: number;
  inputAsyncPct: number;
  tpObservedCount: number;
  tpTotalCount: number;
  tpObservedPct: number;
}

// "Headline stats: % of input observed, % of TP/feedback observed (both
// must reach 80% minimum, tracked separately since input can be up to 10%
// asynchronous but TP/feedback never can be)." Derived from the course's
// real timetable at read time, never stored as a percentage -- same
// "derived, not stored" principle rotation.ts already uses for TP dates.
// Ramy, 28 Aug 2026: inputAsyncPct was tracked in the schema (the
// `asynchronous` flag) but never actually computed or checked against the
// 10% ceiling -- a TinT could satisfy 80% input-observed entirely via
// recordings with no signal anywhere that the cap was blown.
export function computeHeadlineStats(
  timetableEvents: { id: string; type: string }[],
  observedSessions: { timetable_event_id: string; asynchronous: boolean }[]
): TitHeadlineStats {
  const observedByEventId = new Map(observedSessions.map((o) => [o.timetable_event_id, o]));
  const inputEvents = timetableEvents.filter((e) => e.type === "input_session");
  const tpEvents = timetableEvents.filter((e) => e.type === "tp");
  const inputObserved = inputEvents.filter((e) => observedByEventId.has(e.id));
  const tpObservedCount = tpEvents.filter((e) => observedByEventId.has(e.id)).length;
  const inputAsyncCount = inputObserved.filter((e) => observedByEventId.get(e.id)?.asynchronous).length;
  return {
    inputObservedCount: inputObserved.length,
    inputTotalCount: inputEvents.length,
    inputObservedPct: inputEvents.length > 0 ? Math.round((inputObserved.length / inputEvents.length) * 100) : 0,
    inputAsyncCount,
    inputAsyncPct: inputObserved.length > 0 ? Math.round((inputAsyncCount / inputObserved.length) * 100) : 0,
    tpObservedCount,
    tpTotalCount: tpEvents.length,
    tpObservedPct: tpEvents.length > 0 ? Math.round((tpObservedCount / tpEvents.length) * 100) : 0,
  };
}
