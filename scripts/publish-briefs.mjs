// Publishes the four default assignment briefs into a real centre that is
// missing one, without touching any brief the centre already has.
//
// Ramy, 13 Sep 2026, walking the redesigned assignment document on his own
// course: Elmswood had only Focus on the Learner (uploaded as a PDF) and the
// Plagiarism Reflection, so Language Related Tasks, Language Skills Related
// Task and Lessons from the Classroom all opened on "This assignment's brief
// hasn't been published" -- three of the five screens could not be walked.
//
// Re-runnable: a brief that already exists is kept, never overwritten.
// Wording comes from scripts/lib/default-briefs.mjs, the same module the
// demo seed uses, so no centre ends up with its own private variant.
//
// Run with: node scripts/publish-briefs.mjs "Elmswood English Centre"
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { publishMissingBriefs } from "./lib/default-briefs.mjs";

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim();
const supabase = createClient(url, key);

const centreName = process.argv[2];
if (!centreName) {
  console.error('Usage: node scripts/publish-briefs.mjs "<centre name>"');
  process.exit(1);
}

const { data: centre, error: centreErr } = await supabase
  .from("centers")
  .select("id, name")
  .eq("name", centreName)
  .maybeSingle();
if (centreErr) throw centreErr;
if (!centre) {
  console.error(`No centre called "${centreName}".`);
  process.exit(1);
}

const { written, kept } = await publishMissingBriefs(supabase, centre.id);
console.log(`${centre.name}:`);
console.log("  kept    :", kept.length ? kept.join(", ") : "(none)");
console.log("  written :", written.length ? written.join(", ") : "(none -- already complete)");

// Handbook June 2025 §9.2.1: "At least two of the assignments should be
// written in continuous prose." Reported, not enforced, because a centre is
// free to choose WHICH two -- this only says whether it has them.
const { data: after } = await supabase
  .from("assignment_templates")
  .select("assignment_type, format")
  .eq("center_id", centre.id)
  .neq("assignment_type", "Plagiarism Reflection");
const prose = (after ?? []).filter((t) => t.format === "prose");
console.log(`  prose   : ${prose.length} of ${(after ?? []).length} (${prose.map((p) => p.assignment_type).join(", ") || "none"})`);
if (prose.length < 2) console.log("  WARNING : Handbook 9.2.1 needs at least two briefs in continuous prose.");
