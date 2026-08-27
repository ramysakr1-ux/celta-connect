import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { findMatchedRuns, MATCH_THRESHOLD } from "@/lib/plagiarism/text-match";

export interface MaterialsOverlapFlag {
  traineeId: string;
  assignmentId: string;
  assignmentType: "LRT" | "Skills";
  tpNumber: number;
}

// Handbook 9.2 / build-spec.md's numbered rule 7: "Materials prepared for
// LRT or SRT must not be the basis of an assessed lesson, or vice versa --
// raise as a note to the tutor, never an accusation." No design file exists
// for this (Conflated Assignments.dc.html is referenced in
// specs/design-files.md but missing from specs/handoffs/ -- confirmed with
// Ramy 2026-08-18 to build without it).
//
// Reuses the plagiarism scanner's own shingle-overlap engine
// (src/lib/plagiarism/text-match.ts) rather than an LLM call -- the same
// "a real run of continuous writing" bar as candidate-to-candidate
// matching, just comparing a trainee's own assignment writing against
// their own TP materials description instead of another candidate's
// submission. A section's exact key is centre-template-specific (parsed
// from each centre's own uploaded brief), so this compares the whole
// assignment response rather than trying to isolate "the materials
// section" by a key that isn't stable across centres.
export async function findMaterialsOverlaps(
  supabase: SupabaseClient<Database>,
  courseId: string
): Promise<MaterialsOverlapFlag[]> {
  const [{ data: assignments }, { data: planRows }] = await Promise.all([
    supabase
      .from("assignments")
      .select("id, trainee_id, assignment_type")
      .eq("course_id", courseId)
      .in("assignment_type", ["LRT", "Skills"]),
    supabase
      .from("plan_assignments")
      .select("trainee_id, tp_number, materials_description")
      .eq("course_id", courseId)
      .not("materials_description", "is", null),
  ]);
  if (!assignments?.length || !planRows?.length) return [];

  const assignmentIds = assignments.map((a) => a.id);
  const { data: sections } = await supabase
    .from("assignment_section_responses")
    .select("assignment_id, first_response, resubmission_response")
    .in("assignment_id", assignmentIds);

  const textByAssignmentId = new Map<string, string>();
  for (const s of sections ?? []) {
    const text = [s.first_response, s.resubmission_response].filter(Boolean).join("\n");
    if (!text) continue;
    const existing = textByAssignmentId.get(s.assignment_id);
    textByAssignmentId.set(s.assignment_id, existing ? `${existing}\n${text}` : text);
  }

  const plansByTrainee = new Map<string, { tp_number: number; materials_description: string }[]>();
  for (const p of planRows) {
    if (!p.materials_description) continue;
    const list = plansByTrainee.get(p.trainee_id) ?? [];
    list.push({ tp_number: p.tp_number, materials_description: p.materials_description });
    plansByTrainee.set(p.trainee_id, list);
  }

  const flags: MaterialsOverlapFlag[] = [];
  for (const a of assignments) {
    const assignmentText = textByAssignmentId.get(a.id);
    if (!assignmentText) continue;
    const plans = plansByTrainee.get(a.trainee_id) ?? [];
    for (const plan of plans) {
      const runs = findMatchedRuns(assignmentText, plan.materials_description, "prose");
      if (runs.some((r) => r.length >= MATCH_THRESHOLD.prose)) {
        flags.push({
          traineeId: a.trainee_id,
          assignmentId: a.id,
          assignmentType: a.assignment_type as "LRT" | "Skills",
          tpNumber: plan.tp_number,
        });
        break;
      }
    }
  }
  return flags;
}
