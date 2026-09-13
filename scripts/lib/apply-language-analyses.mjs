// Writes a real language analysis onto every seeded plan whose main aim is a
// language aim. Skills lessons get none, which is correct.
//
// Only ever fills a sheet that is EMPTY, so anything a candidate (or Ramy,
// walking the course) has written by hand is left alone.

import { analysisForAim } from "./language-analyses.mjs";

function isEmptySheet(row) {
  if (!row) return true;
  const blocks = row.blocks ?? [];
  const vocab = row.vocab_rows ?? [];
  const hasBlock = blocks.some((b) => b && (b.item || b.marker || b.meaning));
  const hasVocab = vocab.some((r) => r && (r.item || r.definition));
  return !hasBlock && !hasVocab && !(row.context ?? "").trim();
}

export async function applyLanguageAnalyses(supabase, courseId) {
  const { data: plans } = await supabase
    .from("tp_plans")
    .select("id, trainee_id, main_aims")
    .eq("course_id", courseId);
  if (!plans || plans.length === 0) return { written: 0, skipped: 0, kept: 0 };

  const ids = plans.map((p) => p.id);
  const { data: existing } = await supabase
    .from("tp_language_analyses")
    .select("id, tp_plan_id, context, blocks, vocab_rows")
    .in("tp_plan_id", ids);
  const byPlan = new Map((existing ?? []).map((r) => [r.tp_plan_id, r]));

  let written = 0;
  let skipped = 0;
  let kept = 0;

  for (const plan of plans) {
    const sheet = analysisForAim(plan.main_aims);
    if (!sheet) {
      skipped += 1; // a skills lesson: no analysis sheet, by design
      continue;
    }
    const row = byPlan.get(plan.id);
    if (row && !isEmptySheet(row)) {
      kept += 1; // somebody wrote one: leave it
      continue;
    }
    const payload = { ...sheet, tp_plan_id: plan.id, trainee_id: plan.trainee_id };
    const { error } = row
      ? await supabase.from("tp_language_analyses").update(payload).eq("id", row.id)
      : await supabase.from("tp_language_analyses").insert(payload);
    if (error) throw new Error(`tp_language_analyses ${plan.id}: ${error.message}`);
    written += 1;
  }

  return { written, skipped, kept };
}
