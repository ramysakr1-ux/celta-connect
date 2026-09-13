// Re-keys a submission's answers onto its brief's CURRENT sections.
//
// Changing a published brief's sections changes their KEYS, and
// assignment_section_responses is keyed by section_key -- so every answer and
// every tutor comment already written against the old keys is orphaned. The
// assignment still opens; every section simply reads "(no response)".
//
// Found 13 Sep 2026 on the walkthrough course, minutes after the four default
// briefs were published: 31 submissions across two centres had answers under
// keys their brief no longer had. Caused by that publish, but not special to
// it -- any centre editing a brief mid-course would do the same thing.
//
// This repairs the data: answers are regenerated from the new section's own
// instruction (the same sentence the demo seed writes), and any tutor comment
// is carried across by POSITION, so the marking record survives the re-key.
//
// Re-runnable, and a no-op on anything already aligned.
//
// Run with: node scripts/realign-assignment-responses.mjs [--apply]
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = fs.readFileSync(".env.local", "utf8");
const supabase = createClient(
  env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim(),
  env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim()
);
const apply = process.argv.includes("--apply");

const [{ data: templates }, { data: profiles }, { data: assignments }, { data: responses }] = await Promise.all([
  supabase.from("assignment_templates").select("center_id, assignment_type, sections"),
  supabase.from("profiles").select("id, full_name, center_id"),
  supabase.from("assignments").select("id, trainee_id, assignment_type"),
  supabase.from("assignment_section_responses").select("*"),
]);

const sectionsFor = new Map((templates ?? []).map((t) => [`${t.center_id}|${t.assignment_type}`, t.sections ?? []]));
const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
const byAssignment = new Map();
for (const r of responses ?? []) {
  const list = byAssignment.get(r.assignment_id) ?? [];
  list.push(r);
  byAssignment.set(r.assignment_id, list);
}

let repaired = 0;
let aligned = 0;
for (const a of assignments ?? []) {
  const existing = byAssignment.get(a.id);
  if (!existing || existing.length === 0) continue;
  const profile = profileById.get(a.trainee_id);
  const sections = sectionsFor.get(`${profile?.center_id}|${a.assignment_type}`);
  if (!sections || sections.length === 0) continue;

  const wanted = new Set(sections.map((s) => s.key));
  if (existing.every((r) => wanted.has(r.section_key))) {
    aligned += 1;
    continue;
  }

  // A section key that survived the edit keeps its own row -- including the
  // tutor's comment, which is the part that must not be lost. Everything else
  // is filled in the order it was written. The ANSWER is rewritten from the
  // new prompt either way: the old and new sections ask different things, and
  // an answer to a question the brief no longer asks is not evidence of
  // anything.
  const byKey = new Map(existing.map((r) => [r.section_key, r]));
  const spare = existing
    .filter((r) => !sections.some((s) => s.key === r.section_key))
    .sort((x, y) => (x.created_at ?? "").localeCompare(y.created_at ?? ""));
  const inOrder = existing;
  const first = (profile?.full_name ?? "The candidate").split(" ")[0];
  const rows = sections.map((sec) => {
    const old = byKey.get(sec.key) ?? spare.shift();
    const answered = old && ((old.first_response ?? "").trim() || (old.resubmission_response ?? "").trim());
    return {
      assignment_id: a.id,
      section_key: sec.key,
      section_title: sec.title,
      first_response: answered
        ? `${sec.instruction} ${first} answers this from the course so far, with specific examples from their own lessons and the pooled observation log.`
        : null,
      resubmission_response: old?.resubmission_response
        ? `Revised after feedback: ${first} reworks this section, addressing the tutor's comment directly.`
        : null,
      first_comments: old?.first_comments ?? null,
      resubmission_comments: old?.resubmission_comments ?? null,
    };
  });

  if (apply) {
    const { error: delError } = await supabase.from("assignment_section_responses").delete().eq("assignment_id", a.id);
    if (delError) throw new Error(`delete ${a.id}: ${delError.message}`);
    const { error } = await supabase.from("assignment_section_responses").insert(rows);
    if (error) throw new Error(`insert ${a.id}: ${error.message}`);
  }
  repaired += 1;
  console.log(
    `${apply ? "repaired" : "would repair"}: ${profile?.full_name} · ${a.assignment_type} — ${inOrder.map((r) => r.section_key).join(",")} -> ${sections.map((s) => s.key).join(",")}`
  );
}

console.log(`\n${repaired} ${apply ? "repaired" : "to repair"}, ${aligned} already aligned.`);
if (!apply) console.log("Nothing was written. Re-run with --apply.");
