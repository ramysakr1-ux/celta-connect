import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = fs.readFileSync(".env.local", "utf8");
const db = createClient(env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim(), env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim());
const { data: c } = await db.from("courses").select("id").eq("name","CELTA Walkthrough (Ramy)").single();
const { data: ps } = await db.from("profiles").select("id,full_name,email").eq("course_id",c.id).eq("role","trainee");
const byId = new Map(ps.map(p=>[p.id,p]));
const { data: as } = await db.from("assignments").select("id,assignment_type,trainee_id,first_status,resubmission_status").eq("course_id",c.id);
const want = [
  ["LfC","not_submitted","not_submitted"],
  ["Skills","submitted","not_submitted"],
  ["Focus on Learner","approved","not_submitted"],
  ["Focus on Learner","resubmission_required","approved"],
  ["LRT","resubmission_required","submitted"],
  ["Plagiarism Reflection",null,null],
];
const picks = [];
for (const [t,f,r] of want) {
  const a = as.find(x=>x.assignment_type===t && (f===null || (x.first_status===f && x.resubmission_status===r)));
  if (a) picks.push({...a, who: byId.get(a.trainee_id)});
}
fs.writeFileSync(".walk/picks.json", JSON.stringify(picks,null,1));
for (const p of picks) console.log(`${p.assignment_type.padEnd(22)} ${p.who.full_name.padEnd(16)} ${p.first_status}/${p.resubmission_status}`);
