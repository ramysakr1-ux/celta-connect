// Fills course_timetable_events.linked_tp_number from the event's own title.
//
// The volunteer's class table has a Topic column that resolves through
// linked_tp_number -> plan_assignments -> the lesson's short_title. That
// column is NULL on every seeded TP event, so the lookup never fires and
// every row falls back to printing the course name -- twelve identical rows
// reading "CELTA Demo Course", which tells a volunteer nothing about what
// they attended.
//
// The number is already in the title ("TP1 · A"), so nothing needs guessing:
// this reads it back out. Safe to re-run; only touches rows where the column
// is NULL and the title actually parses.
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const readEnv = (file, keys) => {
  const t = fs.readFileSync(file, "utf8");
  return Object.fromEntries(keys.map((k) => [k, t.match(new RegExp(`^${k}=(.+)$`, "m"))?.[1]?.trim()]));
};
const env = readEnv(".env.migration", ["NEW_SUPABASE_URL", "NEW_SERVICE_ROLE_KEY"]);
const s = createClient(env.NEW_SUPABASE_URL, env.NEW_SERVICE_ROLE_KEY);

const { data: events } = await s
  .from("course_timetable_events")
  .select("id, title, linked_tp_number, course_id")
  .eq("type", "tp")
  .is("linked_tp_number", null);

let linked = 0;
let unparsed = 0;
for (const e of events ?? []) {
  const n = e.title?.match(/^TP\s*(\d+)/i)?.[1];
  if (!n) {
    unparsed++;
    continue;
  }
  const { error } = await s
    .from("course_timetable_events")
    .update({ linked_tp_number: Number(n) })
    .eq("id", e.id);
  if (!error) linked++;
}
console.log(`linked ${linked} events to their TP number` + (unparsed ? `, ${unparsed} titles did not parse` : ""));

const { count: remaining } = await s
  .from("course_timetable_events")
  .select("*", { count: "exact", head: true })
  .eq("type", "tp")
  .is("linked_tp_number", null);
console.log(`TP events still unlinked: ${remaining}`);
