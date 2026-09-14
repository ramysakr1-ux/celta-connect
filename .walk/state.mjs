import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = fs.readFileSync(".env.local", "utf8");
const db = createClient(env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim(), env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim());
const { data: p } = await db.from("profiles").select("id,full_name").eq("email","walk-amara@celtaconnect.com").single();
const { data: as } = await db.from("assignments")
  .select("id,assignment_type,first_status,resubmission_status,due_date,first_criteria_marks,first_overall_comment,marker_id,second_marker_id,in_double_marking_sample")
  .eq("trainee_id", p.id).order("due_date");
const { data: ap } = await db.from("assignment_appendices").select("assignment_id,label,file_name,round");
const { data: rs } = await db.from("assignment_section_responses").select("assignment_id,section_key,first_response,resubmission_response,first_comments");
console.log("AMARA:", p.id);
for (const a of as) {
  const mine = rs.filter(r=>r.assignment_id===a.id);
  const words = mine.reduce((n,r)=>n+((r.first_response||"").trim().split(/\s+/).filter(Boolean).length),0);
  const apx = ap.filter(x=>x.assignment_id===a.id);
  console.log(`${a.assignment_type.padEnd(22)} ${String(a.first_status).padEnd(22)} / ${String(a.resubmission_status).padEnd(14)} words=${String(words).padStart(4)} appendices=${apx.length} comments=${mine.filter(r=>r.first_comments).length}  ${a.id}`);
}
