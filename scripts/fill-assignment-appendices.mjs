// Attaches the appendices the briefs have always demanded.
//
// Ramy, 14 Sep 2026: "backfill them." Every seeded Focus on the Learner and
// Skills assignment had been submitted with nothing attached -- a breach of
// the brief on one (sections D and E say "Attach one task in Appendix 1 /
// Appendix 2") and unmarkable on the other (syllabus 2.3 marks "task design
// in relation to the text").
//
// Re-runnable: an assignment that already has an appendix for a round is left
// alone. Only a round that was actually SUBMITTED gets one -- a draft nobody
// handed in is the candidate's, not ours to fill.
//
// Run with: node scripts/fill-assignment-appendices.mjs [--apply]
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import crypto from "crypto";
import { appendicesFor } from "./lib/assignment-appendix-materials.mjs";
import { renderAppendixPdf } from "./lib/appendix-pdf.mjs";

const env = fs.readFileSync(".env.local", "utf8");
const supabase = createClient(
  env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim(),
  env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim()
);
const apply = process.argv.includes("--apply");
const BUCKET = "assignment-appendices";

const [{ data: profiles }, { data: assignments }, { data: existing }] = await Promise.all([
  supabase.from("profiles").select("id, full_name, center_id").eq("role", "trainee").order("full_name"),
  supabase.from("assignments").select("id, assignment_type, trainee_id, first_status, resubmission_status"),
  supabase.from("assignment_appendices").select("assignment_id, round, label"),
]);

const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
// The SAME stable index fill-assignment-submissions.mjs uses, so the
// worksheet in the appendix is the worksheet the essay describes.
const indexOf = new Map((profiles ?? []).map((p, i) => [p.id, i]));
const has = new Set((existing ?? []).map((a) => `${a.assignment_id}|${a.round}|${a.label}`));

let attached = 0;
let already = 0;
let skipped = 0;

for (const a of assignments ?? []) {
  const profile = profileById.get(a.trainee_id);
  if (!profile) { skipped += 1; continue; }

  const set = appendicesFor(a.assignment_type, indexOf.get(a.trainee_id) ?? 0);
  if (set.length === 0) { skipped += 1; continue; }

  // Which rounds were handed in. A resubmission is a submission, so the
  // material goes with it too -- the tutor marking round 2 needs the text
  // in front of them exactly as much as the one who marked round 1.
  const rounds = [];
  if (a.first_status !== "not_submitted") rounds.push("first");
  if (a.resubmission_status !== "not_submitted") rounds.push("resubmission");
  if (rounds.length === 0) { skipped += 1; continue; }

  for (const round of rounds) {
    for (const spec of set) {
      if (has.has(`${a.id}|${round}|${spec.label}`)) { already += 1; continue; }
      if (!apply) { attached += 1; continue; }

      const buf = await renderAppendixPdf(spec);
      // {centre}/{trainee}/{assignment}/... -- the storage policies read the
      // first two folders, so this shape is not cosmetic.
      const storagePath = `${profile.center_id}/${a.trainee_id}/${a.id}/${crypto.randomUUID()}.pdf`;
      const up = await supabase.storage.from(BUCKET).upload(storagePath, buf, { contentType: "application/pdf" });
      if (up.error) {
        console.error("  upload failed", profile.full_name, a.assignment_type, up.error.message);
        continue;
      }
      const { error } = await supabase.from("assignment_appendices").insert({
        assignment_id: a.id,
        round,
        label: spec.label,
        storage_path: storagePath,
        file_name: spec.fileName,
        mime_type: "application/pdf",
        size_bytes: buf.length,
        uploaded_by: a.trainee_id,
      });
      if (error) {
        console.error("  insert failed", profile.full_name, a.assignment_type, error.message);
        await supabase.storage.from(BUCKET).remove([storagePath]);
        continue;
      }
      attached += 1;
    }
  }
}

console.log(
  apply
    ? `Attached ${attached}. Already there: ${already}. Assignments needing none or unsubmitted: ${skipped}.`
    : `Would attach ${attached}. Already there: ${already}. Assignments needing none or unsubmitted: ${skipped}.\nRe-run with --apply.`
);
