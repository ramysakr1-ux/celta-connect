import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, StandardRating } from "@/lib/supabase/types";
import {
  computeStage3Triggers,
  isStage3Mandatory,
  stage3Expected,
  assignmentFailRequiresStage3,
  STAGE3_TRIGGER_LABELS,
  type Stage3Trigger,
} from "@/lib/stage3-triggers";

// Who must be given Stage Three, read from the record as it stands.
//
// stage3-triggers.ts holds the rules (Handbook 10.2 / CELTA 5 p.20); this is
// the one place that feeds them real data, so the trainee's page, the
// tutor's page and the actions that write the flag cannot disagree. Until
// 12 Sep 2026 the trainee's page fed the "not making expected progress"
// triggers a list of nulls (`.map(() => null)`), so triggers b, c and d
// could never fire -- only "not to standard at Stage 2" and a failed
// assignment ever did.
//
// "Not making the expected progress in the second half" is read from the
// tutor's released grade on every TP taught after the Stage 2 record was
// completed. "Indications of Pass B or Pass A" is the provisional grade.

export interface Stage3Status {
  triggers: Stage3Trigger[];
  /** A Cambridge trigger fired -- the centre cannot opt this candidate out. */
  mandatory: boolean;
  /** Mandatory, or the centre gives Stage Three to everyone. */
  expected: boolean;
  /** The first mandatory trigger's wording, for the record. */
  reason: string | null;
  /** What the record says today (celta5_records.stage3_tutorial_required). */
  flagged: boolean;
}

export async function computeStage3Status(supabase: SupabaseClient<Database>, traineeId: string): Promise<Stage3Status | null> {
  const [{ data: record }, { data: profile }] = await Promise.all([
    supabase.from("celta5_records").select("*").eq("trainee_id", traineeId).maybeSingle(),
    supabase.from("profiles").select("center_id").eq("id", traineeId).maybeSingle(),
  ]);
  if (!record) return null;
  const rec = record as typeof record & { assignment_fail_override_reason?: string | null };

  const [{ data: feedback }, { data: assignments }, { data: center }] = await Promise.all([
    supabase.from("tp_feedback").select("tp_number, grade, submitted_at").eq("trainee_id", traineeId).not("submitted_at", "is", null).order("tp_number"),
    supabase.from("assignments").select("first_status, resubmission_status, resubmission_outcome").eq("trainee_id", traineeId),
    profile?.center_id
      ? supabase.from("centers").select("stage3_for_all_candidates").eq("id", profile.center_id).maybeSingle()
      : Promise.resolve({ data: null as { stage3_for_all_candidates: boolean } | null }),
  ]);

  const since = rec.stage2_completed_at;
  const postStage2TpOutcomes: (StandardRating | null)[] = since
    ? (feedback ?? []).filter((f) => f.submitted_at && f.submitted_at > since).map((f) => (f.grade as StandardRating | null) ?? null)
    : [];

  const assignmentFailed = assignmentFailRequiresStage3(
    (assignments ?? [])
      .filter((a) => true)
      .map((a) => ({
        terminallyFailed: a.resubmission_status === "approved" && a.resubmission_outcome === "fail",
        passed: a.first_status === "approved" || a.resubmission_outcome === "pass",
      })),
    rec.assignment_fail_override_reason ?? null
  );

  const triggers = computeStage3Triggers({
    stage2TutorOverall: (rec.stage2_tutor_overall as StandardRating | null) ?? null,
    postStage2TpOutcomes,
    higherGradeIndicated: rec.provisional_grade === "Pass B" || rec.provisional_grade === "Pass A",
    assignmentFailed,
    centreGivesStage3ToAll: Boolean((center as { stage3_for_all_candidates?: boolean } | null)?.stage3_for_all_candidates),
  });
  const mandatory = isStage3Mandatory(triggers);
  const first = triggers.find((t) => t !== "centre_gives_to_all");
  return {
    triggers,
    mandatory,
    expected: stage3Expected(triggers) || rec.stage3_tutorial_required,
    reason: first ? STAGE3_TRIGGER_LABELS[first] : null,
    flagged: rec.stage3_tutorial_required,
  };
}

/**
 * Writes the flag the roster and the tutorials grid read
 * (stage3_tutorial_required) the moment a Cambridge trigger fires -- on a
 * Stage 2 completion, on a released TP grade, on a terminal assignment
 * fail. Ramy, 29 Aug 2026: the centre may opt everyone in but never a
 * triggered candidate out, so this only ever sets the flag, never clears it.
 */
export async function ensureStage3Flag(supabase: SupabaseClient<Database>, traineeId: string): Promise<Stage3Status | null> {
  const status = await computeStage3Status(supabase, traineeId);
  if (status?.mandatory && !status.flagged) {
    await supabase.from("celta5_records").update({ stage3_tutorial_required: true }).eq("trainee_id", traineeId);
    return { ...status, flagged: true };
  }
  return status;
}
