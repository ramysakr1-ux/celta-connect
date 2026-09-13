import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = fs.readFileSync(".env.local", "utf8");
const db = createClient(env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim(), env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim());
const { data: course } = await db.from("courses").select("id").eq("name","CELTA Walkthrough (Ramy)").single();
const { data: ps } = await db.from("profiles").select("id,full_name").eq("course_id",course.id).eq("role","trainee");
const name = new Map(ps.map(p=>[p.id,p.full_name]));
const { data: as } = await db.from("assignments")
  .select("id,assignment_type,trainee_id,first_status,resubmission_status,open_case_id,second_marker_id,in_double_marking_sample")
  .eq("course_id", course.id);
// One of each type per distinct state, so the walk covers every stage.
const seen = new Set(); const pick = [];
for (const a of as) {
  const k = `${a.assignment_type}|${a.first_status}|${a.resubmission_status}`;
  if (seen.has(k)) continue;
  seen.add(k); pick.push(a);
}
pick.sort((x,y)=>x.assignment_type.localeCompare(y.assignment_type));
for (const a of pick) console.log([a.assignment_type, name.get(a.trainee_id), a.first_status, a.resubmission_status, a.id].join(" :: "));
console.log("\nTOTAL", pick.length);
