// Writes real assignment text onto every submitted round.
//
// Ramy, 13 Sep 2026, looking at a round-2 marking screen: "the 48 words is
// seeded -- fill in real submissions." Every submitted assignment carried one
// generated sentence per section, so word counts read 41 or 48 against a
// 750-1,000 range and nothing that depends on the length of real work could
// be judged.
//
// Only fills a round that has actually been submitted, and only a section the
// text module has something for. A round nobody has handed in stays empty --
// a draft is the candidate's, not ours to write.
//
// Run with: node scripts/fill-assignment-submissions.mjs [--apply]
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { submissionFor, countWords } from "./lib/assignment-submissions.mjs";

const env = fs.readFileSync(".env.local", "utf8");
const supabase = createClient(
  env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim(),
  env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim()
);
const apply = process.argv.includes("--apply");

const [{ data: templates }, { data: profiles }, { data: assignments }, { data: responses }] = await Promise.all([
  supabase.from("assignment_templates").select("center_id, assignment_type, sections"),
  supabase.from("profiles").select("id, full_name, center_id").eq("role", "trainee").order("full_name"),
  supabase.from("assignments").select("*"),
  supabase.from("assignment_section_responses").select("*"),
]);

const sectionsFor = new Map((templates ?? []).map((t) => [`${t.center_id}|${t.assignment_type}`, t.sections ?? []]));
const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
// A stable index per candidate, so one candidate always gets the same learner
// and the same variant across their four assignments -- and no two candidates
// on a course share a profile, which the plagiarism scanner would flag.
const indexOf = new Map((profiles ?? []).map((p, i) => [p.id, i]));
const byAssignment = new Map();
for (const r of responses ?? []) {
  const list = byAssignment.get(r.assignment_id) ?? [];
  list.push(r);
  byAssignment.set(r.assignment_id, list);
}

let filled = 0;
let skipped = 0;
for (const a of assignments ?? []) {
  const submittedFirst = a.first_status !== "not_submitted";
  const submittedResub = a.resubmission_status !== "not_submitted";
  if (!submittedFirst) { skipped += 1; continue; }

  const profile = profileById.get(a.trainee_id);
  const sections = sectionsFor.get(`${profile?.center_id}|${a.assignment_type}`);
  if (!profile || !sections?.length) { skipped += 1; continue; }

  const text = submissionFor(a.assignment_type, sections.map((s) => s.key), indexOf.get(a.trainee_id) ?? 0);
  if (!text) { skipped += 1; continue; }

  const existing = byAssignment.get(a.id) ?? [];
  const words = Object.values(text).reduce((n, t) => n + countWords(t), 0);

  for (const sec of sections) {
    const body = text[sec.key];
    if (!body) continue;
    const row = existing.find((r) => r.section_key === sec.key);
    const patch = {
      assignment_id: a.id,
      section_key: sec.key,
      section_title: sec.title,
      first_response: body,
      // A resubmission is the same work with the criticised part reworked, so
      // it reads as the same essay -- not a different one.
      resubmission_response: submittedResub
        ? body + `\n\nRevised after feedback: this section has been reworked to address the point raised on the first submission.`
        : row?.resubmission_response ?? null,
    };
    if (apply) {
      const { error } = row
        ? await supabase.from("assignment_section_responses").update(patch).eq("id", row.id)
        : await supabase.from("assignment_section_responses").insert(patch);
      if (error) throw new Error(`${a.id} ${sec.key}: ${error.message}`);
    }
  }
  filled += 1;
  console.log(`  ${apply ? "filled" : "would fill"}  ${(profile.full_name ?? "?").padEnd(18)} ${a.assignment_type.padEnd(20)} ${words} words`);
}

console.log(`\n${filled} ${apply ? "filled" : "to fill"}, ${skipped} skipped (not submitted, or no text for that brief).`);
if (!apply) console.log("Nothing written. Re-run with --apply.");
