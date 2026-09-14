// Signs the Stage 1 records the seed filed without a signature.
//
// 14 Sep 2026: 20 of 20 completed Stage 1 records had
// stage1_tutor_signature_name null, while Stage 2 (22/22), Stage 3 (3/3) and
// the final sign-off all carried one. updateStage1 refuses to mark a stage
// complete without the tutor's signature, so filed-but-unsigned is a state
// the real app cannot reach -- the seed wrote the record directly and
// skipped the guard. The candidate's page therefore showed
// "Tutor's signature: —" on a form the real CELTA 5 requires signed (p15).
//
// The signature follows the candidate's TP group, the same convention Stage 2
// uses: group A signs M. Webb, group B signs J. Blake.
//
// Re-runnable. Run: node scripts/fill-stage1-tutor-signatures.mjs [--apply]
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = fs.readFileSync(".env.local", "utf8");
const supabase = createClient(
  env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim(),
  env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim()
);
const apply = process.argv.includes("--apply");

const { data: records, error } = await supabase
  .from("celta5_records")
  .select("id, trainee_id, stage1_completed_at, stage1_tutor_signature_name");
if (error) { console.error(error.message); process.exit(1); }

// Which TP group each candidate is in, so the signature matches Stage 2's.
const { data: members } = await supabase
  .from("course_subgroup_members")
  .select("trainee_id, course_subgroups(name)");
const groupOf = new Map(
  (members ?? []).map((m) => [m.trainee_id, String(m.course_subgroups?.name ?? "A").trim().charAt(0).toUpperCase()])
);

let signed = 0, already = 0, skipped = 0;
for (const r of records ?? []) {
  if (!r.stage1_completed_at) { skipped += 1; continue; }
  if (r.stage1_tutor_signature_name) { already += 1; continue; }
  const name = groupOf.get(r.trainee_id) === "B" ? "J. Blake" : "M. Webb";
  if (apply) {
    const { error: uErr } = await supabase
      .from("celta5_records")
      .update({ stage1_tutor_signature_name: name })
      .eq("id", r.id);
    if (uErr) { console.error("  failed", r.id, uErr.message); continue; }
  }
  signed += 1;
}

console.log(
  apply
    ? `Signed ${signed}. Already signed: ${already}. Stage 1 not filed: ${skipped}.`
    : `Would sign ${signed}. Already signed: ${already}. Not filed: ${skipped}.\nRe-run with --apply.`
);
