import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type MarkingGuidanceRow = Database["public"]["Tables"]["marking_guidance_entries"]["Row"];

// Keyed assignment_type -> criterion_key, matching how the review form and
// ASSIGNMENT_CRITERIA already key criteria marks.
export type MarkingGuidanceMap = Map<string, Map<string, MarkingGuidanceRow>>;

export async function getMarkingGuidance(
  supabase: SupabaseClient<Database>,
  centerId: string
): Promise<MarkingGuidanceMap> {
  const { data } = await supabase.from("marking_guidance_entries").select("*").eq("center_id", centerId);
  const map: MarkingGuidanceMap = new Map();
  for (const row of data ?? []) {
    if (!map.has(row.assignment_type)) map.set(row.assignment_type, new Map());
    map.get(row.assignment_type)!.set(row.criterion_key, row);
  }
  return map;
}

// The assessor pack's "Marking guidance" centre-document line (see
// assessor-pack-contents.ts) checks this instead of an uploaded file, now
// that the real thing lives in-app -- "there's no separate location for
// it." Present the moment any criterion has anything written against it;
// a centre mid-standardisation with one line filled in still counts.
export async function hasMarkingGuidance(supabase: SupabaseClient<Database>, centerId: string): Promise<boolean> {
  const { data } = await supabase
    .from("marking_guidance_entries")
    .select("id")
    .eq("center_id", centerId)
    .limit(1);
  return (data ?? []).length > 0;
}
