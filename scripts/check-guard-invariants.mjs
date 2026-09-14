// Tests the data against the rules the server actions enforce.
//
// Three times on 14 Sep 2026 the code was correct and the DATA made it look
// broken: an assignment released with no overall comment, a Stage 1 filed
// with no tutor signature, an LRT sent back for resubmission with no
// criterion marked. Every one came from a seed writing the table directly
// and skipping the guard in the action, which produces a state the product
// itself forbids -- so walking the demo shows something that could never
// happen to a real candidate.
//
// Each entry below mirrors an `if (X && !Y) return { error: ... }` in a
// server action. A violation means something wrote around it.
//
// Run: node scripts/check-guard-invariants.mjs    (exits 1 on any violation)
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = fs.readFileSync(".env.local", "utf8");
const db = createClient(env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim(), env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim());

// Each entry is an invariant a server action ENFORCES. If rows violate it,
// something wrote the table directly and skipped the guard.
let violations = 0;

const CHECKS = [
  ["tp_feedback",     "submitted_at",             "grade",                        "TP feedback released without a grade (Handbook 10.2)"],
  ["celta5_records",  "stage1_completed_at",      "stage1_tutor_signature_name",  "Stage 1 complete, tutor unsigned"],
  ["celta5_records",  "stage2_completed_at",      "stage2_tutor_signature_name",  "Stage 2 complete, tutor unsigned"],
  ["celta5_records",  "stage2_completed_at",      "stage2_tutor_overall",         "Stage 2 complete without a standard"],
  ["celta5_records",  "stage2_completed_at",      "stage2_tutorial_given",        "Stage 2 complete without the tutorial"],
  ["celta5_records",  "stage3_finalized_at",      "stage3_tutor_signature_name",  "Stage 3 finalized, tutor unsigned"],
  ["celta5_records",  "stage3_finalized_at",      "stage3_tutor_overall",         "Stage 3 finalized without a standard"],
  ["celta5_records",  "trainer_signoff_final_at", "final_tutor_signature_name",   "Final signed off, tutor unsigned"],
  ["assignments",     "first_overall_comment",    "marker_id",                    "assignment marked with no marker recorded"],
];

for (const [table, whenSet, mustAlsoBeSet, label] of CHECKS) {
  const { data, error } = await db.from(table).select(`${whenSet},${mustAlsoBeSet}`);
  if (error) { console.log(`  ?  ${label.padEnd(52)} ${error.message.slice(0,40)}`); continue; }
  const scoped = data.filter(r => r[whenSet]);
  const bad = scoped.filter(r => r[mustAlsoBeSet] === null || r[mustAlsoBeSet] === false);
  if (bad.length) violations += 1;
  const mark = bad.length ? "!!" : "ok";
  console.log(`  ${mark} ${label.padEnd(52)} ${bad.length} / ${scoped.length}`);
}

// The assignment release guards, which live in returnAssignment.
const { data: a } = await db.from("assignments").select("first_status,resubmission_status,first_criteria_marks,first_overall_comment,resubmission_overall_comment");
const marked = a.filter(x => ["approved","resubmission_required"].includes(x.first_status));
console.log(`  ${marked.filter(x=>!x.first_overall_comment).length?"!!":"ok"} ${"assignment round released without an overall comment".padEnd(52)} ${marked.filter(x=>!x.first_overall_comment).length} / ${marked.length}`);
console.log(`  ${marked.filter(x=>!x.first_criteria_marks||!Object.keys(x.first_criteria_marks).length).length?"!!":"ok"} ${"assignment released with no criteria marked".padEnd(52)} ${marked.filter(x=>!x.first_criteria_marks||!Object.keys(x.first_criteria_marks).length).length} / ${marked.length}`);

// The unassessed teaching slot is a TYPE, not a title (migration 0296,
// Ramy asked three times). A course whose slots are typed as something else
// drops out of every place that counts teaching -- and Ramy's own
// walkthrough course was in exactly that state on 14 Sep 2026, cloned
// before the type existed.
const { data: unassessed } = await db
  .from("course_timetable_events")
  .select("course_id, title, type, event_date")
  .ilike("title", "%unassessed teach%");
const mistyped = (unassessed ?? []).filter((e) => !/prep/i.test(e.title) && e.type !== "unassessed_tp");
console.log(`  ${mistyped.length ? "!!" : "ok"} ${"unassessed teaching slot not typed unassessed_tp".padEnd(52)} ${mistyped.length} / ${(unassessed ?? []).length}`);
if (mistyped.length) violations += 1;

// A TP recorded as taught on a day that TP was not timetabled. Amara's TP8
// on the walkthrough course was stamped taught on 12 September, before the
// TP7 she had not taught and on a day with no TP8 anywhere on the board
// (walked 14 Sep 2026) -- the clone had emptied her plan and feedback but
// left the record claiming the lesson happened.
const { data: taughtRows } = await db.from("plan_assignments").select("course_id, tp_number, taught_at").not("taught_at", "is", null);
const { data: tpRows } = await db.from("course_timetable_events").select("course_id, event_date, linked_tp_number").eq("type", "tp").not("linked_tp_number", "is", null);
const tpDates = new Map();
for (const e of tpRows ?? []) {
  const key = `${e.course_id}|${e.linked_tp_number}`;
  tpDates.set(key, (tpDates.get(key) ?? new Set()).add(e.event_date));
}
const offTimetable = (taughtRows ?? []).filter((r) => {
  const dates = tpDates.get(`${r.course_id}|${r.tp_number}`);
  return dates && dates.size > 0 && !dates.has(r.taught_at.slice(0, 10));
});
console.log(`  ${offTimetable.length ? "!!" : "ok"} ${"TP taught on a day it was not timetabled".padEnd(52)} ${offTimetable.length} / ${(taughtRows ?? []).length}`);
if (offTimetable.length) violations += 1;

const noComment = marked.filter((x) => !x.first_overall_comment).length;
const noMarks = marked.filter((x) => !x.first_criteria_marks || !Object.keys(x.first_criteria_marks).length).length;
violations += (noComment ? 1 : 0) + (noMarks ? 1 : 0);
console.log(violations === 0 ? "\nNo violations." : `\n${violations} invariant(s) violated.`);
process.exit(violations === 0 ? 0 : 1);
