// Writes the tutor's reply to the candidate's self-evaluation.
//
// tp_feedback.self_eval_comment is collected in step 3 of the tutor's form,
// saved by the action, and read on the candidate's page, in the assembled
// document and in the PDF record. The whole chain was built and had never
// once been used, so on every seeded lesson the feature was invisible and
// looked unbuilt -- I reported it as unbuilt on 14 Sep 2026, wrongly.
//
// Only a SUBMITTED round gets one: it is part of released feedback.
// Re-runnable. Run with: node scripts/fill-tp-self-eval-replies.mjs [--apply]
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { selfEvalReplyFor } from "./lib/tp-self-evaluations.mjs";

const env = fs.readFileSync(".env.local", "utf8");
const supabase = createClient(
  env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim(),
  env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim()
);
const apply = process.argv.includes("--apply");

const [{ data: profiles }, { data: feedback, error: fbErr }, { data: evals }] = await Promise.all([
  supabase.from("profiles").select("id").eq("role", "trainee").order("full_name"),
  supabase.from("tp_feedback").select("id, trainee_id, tp_plan_id, tp_number, submitted_at, self_eval_comment"),
  supabase.from("tp_self_evaluations").select("tp_plan_id, submitted_at"),
]);
if (fbErr) { console.error(fbErr.message); process.exit(1); }

const indexOf = new Map((profiles ?? []).map((p, i) => [p.id, i]));
// A reply to a reflection nobody has written would be nonsense.
const selfEvalIn = new Set((evals ?? []).filter((e) => e.submitted_at).map((e) => e.tp_plan_id));

let wrote = 0;
let already = 0;
let skipped = 0;

for (const f of feedback ?? []) {
  if (!f.submitted_at || !selfEvalIn.has(f.tp_plan_id)) { skipped += 1; continue; }
  if (f.self_eval_comment) { already += 1; continue; }
  if (apply) {
    const { error } = await supabase
      .from("tp_feedback")
      .update({ self_eval_comment: selfEvalReplyFor(indexOf.get(f.trainee_id) ?? 0, f.tp_number) })
      .eq("id", f.id);
    if (error) { console.error("  failed", f.id, error.message); continue; }
  }
  wrote += 1;
}

console.log(
  apply
    ? `Wrote ${wrote} replies. Already there: ${already}. Rounds skipped (unreleased, or no self-evaluation): ${skipped}.`
    : `Would write ${wrote}. Already there: ${already}. Skipped: ${skipped}.\nRe-run with --apply.`
);
