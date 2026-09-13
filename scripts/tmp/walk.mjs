import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = fs.readFileSync(".env.local", "utf8");
const db = createClient(env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim(), env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim());
const { data: co } = await db.from("courses").select("id").eq("name","CELTA Walkthrough (Ramy)").single();
const { data: ps } = await db.from("profiles").select("id,full_name").eq("course_id", co.id).eq("role","trainee");
const nameOf = new Map(ps.map(p=>[p.id,p.full_name]));
const { data: a } = await db.from("assignments").select("id,trainee_id,assignment_type,first_status,resubmission_status,resubmission_outcome,marker_id,second_marker_id,second_marks_recorded_at,first_marks_saved_at").eq("course_id", co.id);
const want = [
  ["Aoife Byrne","Skills"], ["Ines Marchetti","Skills"], ["Leila Haddad","LRT"],
  ["Amara Okafor","Focus on Learner"], ["Ines Marchetti","Focus on Learner"], ["Kofi Mensah","Plagiarism Reflection"],
];
for (const [n,t] of want) {
  const r = a.find(x=>nameOf.get(x.trainee_id)===n && x.assignment_type===t);
  if (!r) { console.log(n, t, "-- none"); continue; }
  console.log(`${n} · ${t}\n   first=${r.first_status} resub=${r.resubmission_status} outcome=${r.resubmission_outcome ?? "-"} draft=${r.first_marks_saved_at?"yes":"no"} 2nd=${r.second_marker_id?"assigned":"-"}\n   /portfolio/${r.trainee_id}/assignments/${r.id}`);
}
