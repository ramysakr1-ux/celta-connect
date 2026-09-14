// Fills the three self-evaluation answers the seed never wrote.
//
// 14 Sep 2026: 108 of 109 submitted self-evaluations answered two of six
// questions. The form does not gate submit on completeness, so a partial one
// is reachable -- every one being partial in the same way is not, and it made
// the candidate's own band of the assembled document read as a stub.
//
// Re-runnable: an answer that is already there is left alone.
// Run with: node scripts/fill-tp-self-evaluations.mjs [--apply]
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { selfEvaluationFor } from "./lib/tp-self-evaluations.mjs";

const env = fs.readFileSync(".env.local", "utf8");
const supabase = createClient(
  env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim(),
  env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim()
);
const apply = process.argv.includes("--apply");

const [{ data: profiles }, { data: evals, error: evalErr }] = await Promise.all([
  supabase.from("profiles").select("id").eq("role", "trainee").order("full_name"),
  supabase.from("tp_self_evaluations").select("id, trainee_id, tp_number, submitted_at, what_went_well, what_not_as_planned, evidence_of_learning, what_differently, next_tp_focus"),
]);
if (evalErr) { console.error(evalErr.message); process.exit(1); }

// The same stable candidate index the other fill scripts use.
const indexOf = new Map((profiles ?? []).map((p, i) => [p.id, i]));
const FIELDS = ["what_went_well", "what_not_as_planned", "evidence_of_learning", "what_differently", "next_tp_focus"];

// The two the seed did write were one placeholder sentence each, identical on
// all 109 rows. Leaving them beside the new answers would put two voices in
// one reflection, so they are replaced -- and ONLY they are: anything a real
// candidate typed is matched by neither string and is left alone.
const PLACEHOLDERS = new Set([
  "The lead-in got strong engagement and the timing worked well.",
  "Ran short on freer practice time.",
]);

let filled = 0;
let already = 0;
let skipped = 0;

for (const e of evals ?? []) {
  // A draft nobody has handed in is the candidate's, not ours to write.
  if (!e.submitted_at) { skipped += 1; continue; }
  const source = selfEvaluationFor(indexOf.get(e.trainee_id) ?? 0, e.tp_number);
  const patch = {};
  for (const f of FIELDS) {
    if (e[f] && !PLACEHOLDERS.has(String(e[f]).trim())) { already += 1; continue; }
    patch[f] = source[f];
  }
  if (Object.keys(patch).length === 0) { skipped += 1; continue; }
  if (apply) {
    const { error } = await supabase.from("tp_self_evaluations").update(patch).eq("id", e.id);
    if (error) { console.error("  failed", e.id, error.message); continue; }
  }
  filled += Object.keys(patch).length;
}

console.log(
  apply
    ? `Filled ${filled} answers. Already written: ${already}. Rows left alone: ${skipped}.`
    : `Would fill ${filled}. Already written: ${already}. Rows left alone: ${skipped}.\nRe-run with --apply.`
);
