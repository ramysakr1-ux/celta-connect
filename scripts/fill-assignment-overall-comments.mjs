// Writes the tutor's overall comment onto every marked round.
//
// Found 14 Sep 2026 walking an APPROVED assignment from the candidate's side:
// the page said "Passed on first submission" and showed nothing the tutor had
// written, because first_overall_comment was NULL on all 42 marked rounds.
// The marking screen will not release a round without one, so no real
// assignment can be in that state -- only seeded ones were.
//
// Re-runnable: a round that already has a comment is left alone.
// Run with: node scripts/fill-assignment-overall-comments.mjs [--apply]
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { overallCommentFor } from "./lib/assignment-submissions.mjs";

const env = fs.readFileSync(".env.local", "utf8");
const supabase = createClient(
  env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim(),
  env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim()
);
const apply = process.argv.includes("--apply");

const { data: assignments, error: fetchError } = await supabase
  .from("assignments")
  .select("id, assignment_type, first_status, resubmission_status, resubmission_outcome, first_overall_comment, resubmission_overall_comment");

if (fetchError) { console.error("fetch failed:", fetchError.message); process.exit(1); }
let wrote = 0;
let already = 0;
let skipped = 0;

for (const a of assignments ?? []) {
  const patch = {};

  if (a.first_status === "approved" || a.first_status === "resubmission_required") {
    if (a.first_overall_comment) already += 1;
    else {
      const text = overallCommentFor(a.assignment_type, "first", a.first_status);
      if (text) patch.first_overall_comment = text;
    }
  }
  if (a.resubmission_status === "approved") {
    if (a.resubmission_overall_comment) already += 1;
    else {
      const text = overallCommentFor(a.assignment_type, "resubmission", a.resubmission_outcome);
      if (text) patch.resubmission_overall_comment = text;
    }
  }

  if (Object.keys(patch).length === 0) { skipped += 1; continue; }
  if (apply) {
    const { error } = await supabase.from("assignments").update(patch).eq("id", a.id);
    if (error) { console.error("  failed", a.id, error.message); continue; }
  }
  wrote += Object.keys(patch).length;
}

console.log(
  apply
    ? `Wrote ${wrote} overall comments. Already there: ${already}. Rounds needing none: ${skipped}.`
    : `Would write ${wrote}. Already there: ${already}. Rounds needing none: ${skipped}.\nRe-run with --apply.`
);
